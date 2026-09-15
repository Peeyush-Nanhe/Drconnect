-- ============================================================================
-- Nursing: bring the engagement-offer layer into the staging chain.
--
-- 20260913140000 (offers) and 20260913150000 (named nurse) live only in the
-- root supabase/migrations folder, which BUILD_STATUS.md says is never replayed
-- into staging. 20260913160000 and 20260913170000 then call into objects that
-- folder creates, so the staging history cannot run: booking with a preferred
-- nurse raises 42P01 and nursing_engagements has no assignment_state at all.
--
-- This file is the offer layer, written idempotently so it is safe on a fresh
-- database and on one where the root files were applied by hand. It also pins
-- the accept-required behaviour as the winner: choosing a nurse offers the work
-- to her, it never assigns her.
--
-- After this lands, delete the two root files so the ambiguity cannot come back.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.nursing_assignment_state AS ENUM
    ('seeking_nurse','assigned','unfilled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.nursing_engagements
  ADD COLUMN IF NOT EXISTS assignment_state public.nursing_assignment_state
    NOT NULL DEFAULT 'seeking_nurse',
  ADD COLUMN IF NOT EXISTS assigned_at        timestamptz,
  ADD COLUMN IF NOT EXISTS preferred_nurse_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS broadcast_after    timestamptz,
  ADD COLUMN IF NOT EXISTS last_broadcast_at  timestamptz,
  ADD COLUMN IF NOT EXISTS offers_sent        integer NOT NULL DEFAULT 0;

ALTER TABLE public.nursing_settings
  ADD COLUMN IF NOT EXISTS preferred_grace_seconds integer NOT NULL DEFAULT 600;

CREATE TABLE IF NOT EXISTS public.nursing_engagement_offers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES public.nursing_engagements(id) ON DELETE CASCADE,
  nurse_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_amount  integer NOT NULL,
  days_offered  integer NOT NULL,
  notified_at   timestamptz NOT NULL DEFAULT now(),
  response      text CHECK (response IN ('accepted','declined','lost')),
  responded_at  timestamptz,
  UNIQUE (engagement_id, nurse_id)
);
CREATE INDEX IF NOT EXISTS nursing_eng_offers_nurse_idx
  ON public.nursing_engagement_offers (nurse_id, notified_at DESC);

-- broadcast_nursing_engagement is redefined in 20260915092000 with a nurse-only,
-- radius-bounded roster. This is the placeholder so the chain is runnable from
-- this point forward; do not rely on its roster.
CREATE OR REPLACE FUNCTION public.broadcast_nursing_engagement(p_engagement_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_eng public.nursing_engagements; v_n integer := 0;
BEGIN
  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = p_engagement_id;
  IF NOT FOUND OR v_eng.assignment_state <> 'seeking_nurse' THEN RETURN 0; END IF;

  INSERT INTO public.nursing_engagement_offers
    (engagement_id, nurse_id, offer_amount, days_offered)
  SELECT p_engagement_id, ur.user_id, v_eng.total_amount, v_eng.days_scheduled
    FROM public.user_roles ur
   WHERE ur.role = 'provider'
     AND ur.user_id IS DISTINCT FROM v_eng.patient_id
   LIMIT 100
  ON CONFLICT (engagement_id, nurse_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.nursing_engagements
     SET last_broadcast_at = now(), offers_sent = offers_sent + v_n
   WHERE id = p_engagement_id;
  RETURN v_n;
END $$;

-- First nurse to accept takes the whole package. The row lock plus the
-- seeking_nurse check means two nurses tapping together cannot both win.
-- Redefined in 20260915093000 to add the nurse-side calendar conflict check.
CREATE OR REPLACE FUNCTION public.accept_nursing_engagement(p_engagement_id uuid)
RETURNS public.nursing_engagements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_eng public.nursing_engagements;
BEGIN
  IF NOT public.has_role(v_uid, 'provider') THEN
    RAISE EXCEPTION 'NURSING_FORBIDDEN: Only an approved provider can accept nursing work.';
  END IF;
  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = p_engagement_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NURSING_NOT_FOUND: That booking no longer exists.';
  END IF;
  IF v_eng.assignment_state <> 'seeking_nurse' OR v_eng.primary_nurse_id IS NOT NULL THEN
    UPDATE public.nursing_engagement_offers SET response='lost', responded_at=now()
     WHERE engagement_id = p_engagement_id AND nurse_id = v_uid AND response IS NULL;
    RAISE EXCEPTION 'NURSING_ALREADY_TAKEN: Another nurse accepted this booking first.';
  END IF;
  -- An offer is required. Without this a nurse who was never asked, or who was
  -- asked and declined, can still claim the work by calling the RPC directly.
  IF NOT EXISTS (SELECT 1 FROM public.nursing_engagement_offers o
                  WHERE o.engagement_id = p_engagement_id AND o.nurse_id = v_uid
                    AND o.response IS DISTINCT FROM 'declined') THEN
    RAISE EXCEPTION 'NURSING_NOT_OFFERED: This booking was not offered to you.';
  END IF;

  UPDATE public.nursing_engagements
     SET primary_nurse_id = v_uid, assignment_state = 'assigned',
         assigned_at = now(), updated_at = now()
   WHERE id = p_engagement_id RETURNING * INTO v_eng;

  UPDATE public.nursing_visits
     SET assigned_nurse_id = v_uid, payout_to = v_uid, updated_at = now()
   WHERE engagement_id = p_engagement_id
     AND assigned_nurse_id IS NULL
     AND status = 'scheduled';

  UPDATE public.nursing_engagement_offers SET response='accepted', responded_at=now()
   WHERE engagement_id = p_engagement_id AND nurse_id = v_uid;
  UPDATE public.nursing_engagement_offers SET response='lost', responded_at=now()
   WHERE engagement_id = p_engagement_id AND nurse_id <> v_uid AND response IS NULL;

  RETURN v_eng;
END $$;

-- Opens a named request to everyone once the grace period has passed. The
-- server owns the clock, so calling this early is a no-op rather than a way to
-- skip the preferred nurse's turn.
CREATE OR REPLACE FUNCTION public.escalate_nursing_engagement(p_engagement_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_eng public.nursing_engagements;
BEGIN
  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = p_engagement_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_eng.assignment_state <> 'seeking_nurse' OR v_eng.primary_nurse_id IS NOT NULL THEN
    RETURN 0;
  END IF;
  IF v_eng.broadcast_after IS NOT NULL AND now() < v_eng.broadcast_after THEN
    RETURN 0;
  END IF;
  RETURN public.broadcast_nursing_engagement(p_engagement_id);
END $$;

CREATE OR REPLACE FUNCTION public.nursing_escalation_tick()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_n integer := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.nursing_engagements
     WHERE assignment_state = 'seeking_nurse'
       AND primary_nurse_id IS NULL
       AND broadcast_after IS NOT NULL
       AND now() >= broadcast_after
     LIMIT 200
  LOOP
    PERFORM public.escalate_nursing_engagement(v_id);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

-- A decline by the preferred nurse ends the wait immediately. Anyone else
-- declining is one fewer taker in a broadcast that is already open.
CREATE OR REPLACE FUNCTION public.decline_nursing_engagement(p_engagement_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_preferred uuid;
BEGIN
  UPDATE public.nursing_engagement_offers
     SET response = 'declined', responded_at = now()
   WHERE engagement_id = p_engagement_id
     AND nurse_id = auth.uid()
     AND response IS NULL;

  SELECT preferred_nurse_id INTO v_preferred
    FROM public.nursing_engagements WHERE id = p_engagement_id;

  IF v_preferred IS NOT NULL AND v_preferred = auth.uid() THEN
    UPDATE public.nursing_engagements
       SET broadcast_after = now(), updated_at = now()
     WHERE id = p_engagement_id AND assignment_state = 'seeking_nurse';
    PERFORM public.escalate_nursing_engagement(p_engagement_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.list_nursing_engagement_offers()
RETURNS SETOF public.nursing_engagements
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.* FROM public.nursing_engagements e
   WHERE e.status = 'active'
     AND (
       e.primary_nurse_id = auth.uid()
       OR (e.assignment_state = 'seeking_nurse' AND EXISTS (
             SELECT 1 FROM public.nursing_engagement_offers o
              WHERE o.engagement_id = e.id AND o.nurse_id = auth.uid()
                AND o.response IS DISTINCT FROM 'declined'))
     )
   ORDER BY e.start_date
   LIMIT 100;
$$;

-- A package nobody took by its start is unfilled. The patient has paid, so this
-- must surface rather than sit silently as 'active'.
CREATE OR REPLACE FUNCTION public.nursing_sweep_unfilled()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  UPDATE public.nursing_engagements
     SET assignment_state = 'unfilled', updated_at = now()
   WHERE assignment_state = 'seeking_nurse'
     AND status = 'active'
     AND (start_date + COALESCE(slot_time, time '08:00'))::timestamptz < now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- Catch up anything booked before this file.
UPDATE public.nursing_engagements
   SET assignment_state = 'assigned', assigned_at = COALESCE(assigned_at, updated_at)
 WHERE primary_nurse_id IS NOT NULL AND assignment_state = 'seeking_nurse';

-- ------------------------------------------------------------------ RLS ----
ALTER TABLE public.nursing_engagement_offers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.nursing_engagement_offers TO authenticated;
GRANT ALL ON public.nursing_engagement_offers TO service_role;

DROP POLICY IF EXISTS "engagement offer readable to that nurse"
  ON public.nursing_engagement_offers;
CREATE POLICY "engagement offer readable to that nurse"
  ON public.nursing_engagement_offers FOR SELECT TO authenticated
  USING (nurse_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "engagement readable to parties" ON public.nursing_engagements;
CREATE POLICY "engagement readable to parties" ON public.nursing_engagements
  FOR SELECT TO authenticated USING (
    patient_id = auth.uid() OR primary_nurse_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.nursing_visits v
                WHERE v.engagement_id = id AND v.assigned_nurse_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.nursing_engagement_offers o
                WHERE o.engagement_id = id AND o.nurse_id = auth.uid()));

GRANT EXECUTE ON FUNCTION public.accept_nursing_engagement(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_nursing_engagement(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_nursing_engagement_offers()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_nursing_engagement(uuid)      TO authenticated;
REVOKE ALL ON FUNCTION public.broadcast_nursing_engagement(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nursing_sweep_unfilled()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nursing_escalation_tick()          FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nursing_sweep_unfilled()  TO service_role;
GRANT EXECUTE ON FUNCTION public.nursing_escalation_tick() TO service_role;

ALTER TABLE public.nursing_engagements REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.nursing_engagements;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.nursing_engagement_offers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

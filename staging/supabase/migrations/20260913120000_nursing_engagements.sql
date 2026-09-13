-- ============================================================================
-- Multi-day home nursing
--
-- A package is an engagement with one visit row per day, so a single day can be
-- cancelled, covered by a substitute or missed without disturbing the rest.
--
-- Policy, as agreed:
--   * Family cancels a day  -> that day is cancelled and ONE EXTRA DAY is added
--     to the end. Money stays; care is still delivered in full.
--   * Nurse cannot attend   -> the day is released and broadcast to other nurses
--     at the day rate. First to accept takes it.
--   * Substitute payout     -> that day's money moves to the covering nurse. The
--     original nurse loses it.
--   * Professional score    -> everyone starts each month on 100.
--       no notice / no-show ............ -10
--       notice under 12 hours .......... -5
--       notice 12h+ and locum found .... 0
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.nursing_engagement_status AS ENUM
    ('active','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nursing_visit_status AS ENUM
    ('scheduled','seeking_cover','en_route','arrived','completed',
     'cancelled_by_family','no_show_patient','missed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------- settings ----
CREATE TABLE IF NOT EXISTS public.nursing_settings (
  id                     integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  day_rate               integer NOT NULL DEFAULT 800,
  -- Notice at or above this earns no penalty, provided cover is found.
  free_notice_hours      integer NOT NULL DEFAULT 12,
  penalty_no_notice      integer NOT NULL DEFAULT 10,
  penalty_late_notice    integer NOT NULL DEFAULT 5,
  monthly_starting_score integer NOT NULL DEFAULT 100,
  updated_at             timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.nursing_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------- engagements ----
CREATE TABLE IF NOT EXISTS public.nursing_engagements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind             text NOT NULL DEFAULT 'General Duty Nurse',
  days_booked      integer NOT NULL CHECK (days_booked BETWEEN 1 AND 60),
  -- Grows when a family cancellation pushes a replacement day onto the end.
  days_scheduled   integer NOT NULL,
  day_rate         integer NOT NULL,
  total_amount     integer NOT NULL,
  paid_at          timestamptz,
  start_date       date NOT NULL,
  slot_time        time,
  address_snapshot text,
  lat              double precision,
  lng              double precision,
  primary_nurse_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status           public.nursing_engagement_status NOT NULL DEFAULT 'active',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nursing_eng_patient_idx
  ON public.nursing_engagements (patient_id, created_at DESC);

-- ---------------------------------------------------------------- visits ---
CREATE TABLE IF NOT EXISTS public.nursing_visits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id     uuid NOT NULL REFERENCES public.nursing_engagements(id) ON DELETE CASCADE,
  seq               integer NOT NULL,
  visit_date        date NOT NULL,
  status            public.nursing_visit_status NOT NULL DEFAULT 'scheduled',

  assigned_nurse_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Kept so a substitute payout can be traced back to who lost it.
  original_nurse_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at       timestamptz,
  release_reason    text,
  notice_hours      numeric(6,2),

  en_route_at       timestamptz,
  arrived_at        timestamptz,
  completed_at      timestamptz,
  arrival_otp       text,

  payout_to         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payout_amount     integer,

  cancel_reason     text,
  -- Set on the extra day created to replace a family cancellation.
  replaces_visit_id uuid REFERENCES public.nursing_visits(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, seq)
);
CREATE INDEX IF NOT EXISTS nursing_visits_open_idx
  ON public.nursing_visits (status, visit_date)
  WHERE status IN ('scheduled','seeking_cover');
CREATE INDEX IF NOT EXISTS nursing_visits_nurse_idx
  ON public.nursing_visits (assigned_nurse_id, visit_date);

-- Who was offered an uncovered day. First accept wins.
CREATE TABLE IF NOT EXISTS public.nursing_visit_offers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id     uuid NOT NULL REFERENCES public.nursing_visits(id) ON DELETE CASCADE,
  nurse_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_amount integer NOT NULL,
  notified_at  timestamptz NOT NULL DEFAULT now(),
  response     text CHECK (response IN ('accepted','declined','lost')),
  responded_at timestamptz,
  UNIQUE (visit_id, nurse_id)
);
CREATE INDEX IF NOT EXISTS nursing_offers_nurse_idx
  ON public.nursing_visit_offers (nurse_id, notified_at DESC);

-- ------------------------------------------------- professional scoring ----
-- One row per provider per month. Applies to nurses, doctors and
-- physiotherapists alike, so it is keyed on the user, not on a role.
CREATE TABLE IF NOT EXISTS public.provider_scores (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period     date NOT NULL,           -- first day of the month
  score      integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period)
);

-- Every deduction is logged. A score a provider cannot see the reasons for is
-- a score they cannot dispute.
CREATE TABLE IF NOT EXISTS public.provider_score_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period     date NOT NULL,
  delta      integer NOT NULL,
  reason     text NOT NULL,
  visit_id   uuid REFERENCES public.nursing_visits(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_score_events_idx
  ON public.provider_score_events (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.apply_provider_score(
  p_user uuid, p_delta integer, p_reason text, p_visit uuid DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_period date := date_trunc('month', now())::date; v_start integer; v_score integer;
BEGIN
  IF p_user IS NULL OR p_delta = 0 THEN RETURN NULL; END IF;
  SELECT monthly_starting_score INTO v_start FROM public.nursing_settings WHERE id = 1;
  INSERT INTO public.provider_scores (user_id, period, score)
  VALUES (p_user, v_period, COALESCE(v_start,100))
  ON CONFLICT (user_id, period) DO NOTHING;

  -- Floor at zero: a score below nothing communicates nothing extra.
  UPDATE public.provider_scores
     SET score = greatest(0, score + p_delta), updated_at = now()
   WHERE user_id = p_user AND period = v_period
   RETURNING score INTO v_score;

  INSERT INTO public.provider_score_events (user_id, period, delta, reason, visit_id)
  VALUES (p_user, v_period, p_delta, p_reason, p_visit);
  RETURN v_score;
END $$;

-- --------------------------------------------------------- create package --
CREATE OR REPLACE FUNCTION public.create_nursing_engagement(
  p_days       integer,
  p_start_date date,
  p_slot_time  time DEFAULT NULL,
  p_kind       text DEFAULT 'General Duty Nurse',
  p_address    text DEFAULT NULL,
  p_lat        double precision DEFAULT NULL,
  p_lng        double precision DEFAULT NULL
) RETURNS public.nursing_engagements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_eng public.nursing_engagements; v_rate integer; v_i integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NURSING_AUTH_REQUIRED: Sign in to book home nursing.';
  END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 60 THEN
    RAISE EXCEPTION 'NURSING_BAD_DAYS: Choose between 1 and 60 days.';
  END IF;
  IF p_start_date IS NULL OR p_start_date < current_date THEN
    RAISE EXCEPTION 'NURSING_BAD_DATE: Pick today or a later date.';
  END IF;

  SELECT day_rate INTO v_rate FROM public.nursing_settings WHERE id = 1;
  v_rate := COALESCE(v_rate, 800);

  INSERT INTO public.nursing_engagements (
    patient_id, kind, days_booked, days_scheduled, day_rate, total_amount,
    start_date, slot_time, address_snapshot, lat, lng, paid_at)
  VALUES (v_uid, p_kind, p_days, p_days, v_rate, v_rate * p_days,
          p_start_date, p_slot_time, p_address, p_lat, p_lng, now())
  RETURNING * INTO v_eng;

  -- One row per day. This is what makes "day 3 did not happen" expressible.
  FOR v_i IN 1..p_days LOOP
    INSERT INTO public.nursing_visits (engagement_id, seq, visit_date, payout_amount)
    VALUES (v_eng.id, v_i, p_start_date + (v_i - 1), v_rate);
  END LOOP;

  RETURN v_eng;
END $$;

-- ------------------------------------------------- family cancels a day ----
-- The day is cancelled and an extra day is appended, so the family still
-- receives every day they paid for.
CREATE OR REPLACE FUNCTION public.cancel_nursing_visit_by_family(
  p_visit_id uuid, p_reason text DEFAULT NULL
) RETURNS public.nursing_visits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_visit public.nursing_visits;
        v_eng public.nursing_engagements; v_last date; v_seq integer; v_new public.nursing_visits;
BEGIN
  SELECT * INTO v_visit FROM public.nursing_visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NURSING_VISIT_NOT_FOUND: That visit no longer exists.';
  END IF;
  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = v_visit.engagement_id;
  IF v_eng.patient_id <> v_uid AND NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'NURSING_FORBIDDEN: Only the patient can cancel their visit.';
  END IF;
  IF v_visit.status IN ('completed','cancelled_by_family','missed') THEN
    RAISE EXCEPTION 'NURSING_VISIT_CLOSED: That day is already closed.';
  END IF;

  UPDATE public.nursing_visits
     SET status = 'cancelled_by_family', cancel_reason = p_reason,
         payout_to = NULL, updated_at = now()
   WHERE id = p_visit_id RETURNING * INTO v_visit;

  -- Append the replacement day after the current last one.
  SELECT max(visit_date), max(seq) INTO v_last, v_seq
    FROM public.nursing_visits WHERE engagement_id = v_eng.id;
  INSERT INTO public.nursing_visits
    (engagement_id, seq, visit_date, payout_amount, assigned_nurse_id, replaces_visit_id)
  VALUES (v_eng.id, v_seq + 1, v_last + 1, v_eng.day_rate, v_eng.primary_nurse_id, p_visit_id)
  RETURNING * INTO v_new;

  UPDATE public.nursing_engagements
     SET days_scheduled = days_scheduled + 1, updated_at = now()
   WHERE id = v_eng.id;

  -- The nurse loses nothing: no score change, and the payout follows the new day.
  RETURN v_new;
END $$;

-- --------------------------------------------- nurse releases a day --------
-- Applies the notice rule, then opens the day to other nurses at the day rate.
CREATE OR REPLACE FUNCTION public.release_nursing_visit(
  p_visit_id uuid, p_reason text DEFAULT NULL
) RETURNS public.nursing_visits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_visit public.nursing_visits;
        v_eng public.nursing_engagements; v_due timestamptz; v_notice numeric;
        v_free integer; v_late integer; v_offers integer := 0;
BEGIN
  SELECT * INTO v_visit FROM public.nursing_visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NURSING_VISIT_NOT_FOUND: That visit no longer exists.';
  END IF;
  IF v_visit.assigned_nurse_id IS DISTINCT FROM v_uid AND NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'NURSING_FORBIDDEN: Only the assigned nurse can release this day.';
  END IF;
  IF v_visit.status NOT IN ('scheduled','seeking_cover') THEN
    RAISE EXCEPTION 'NURSING_VISIT_CLOSED: That day can no longer be released.';
  END IF;

  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = v_visit.engagement_id;
  SELECT free_notice_hours, penalty_late_notice INTO v_free, v_late
    FROM public.nursing_settings WHERE id = 1;

  v_due := (v_visit.visit_date + COALESCE(v_eng.slot_time, time '09:00'))::timestamptz;
  v_notice := EXTRACT(epoch FROM (v_due - now())) / 3600.0;

  UPDATE public.nursing_visits
     SET status = 'seeking_cover',
         original_nurse_id = COALESCE(original_nurse_id, v_visit.assigned_nurse_id),
         assigned_nurse_id = NULL,
         released_at = now(), release_reason = p_reason,
         notice_hours = round(v_notice, 2), updated_at = now()
   WHERE id = p_visit_id RETURNING * INTO v_visit;

  -- Under the free-notice threshold is a late cancellation and costs points now.
  -- At or above it, the penalty depends on whether cover is found, which is
  -- settled in nursing_tick() rather than guessed here.
  IF v_notice < COALESCE(v_free, 12) THEN
    PERFORM public.apply_provider_score(
      v_visit.original_nurse_id, -COALESCE(v_late, 5),
      'Late cancellation, under ' || COALESCE(v_free,12) || ' hours notice', p_visit_id);
  END IF;

  -- Broadcast to every other nurse. First to accept takes the day.
  -- IS DISTINCT FROM, not <>: a NULL on either side would make the whole
  -- predicate NULL and silently offer the day to nobody at all.
  INSERT INTO public.nursing_visit_offers (visit_id, nurse_id, offer_amount)
  SELECT p_visit_id, cand.id, COALESCE(v_visit.payout_amount, v_eng.day_rate, 800)
    FROM (
      -- Read the roster from user_roles, not profiles. profiles carries a
      -- restrictive SELECT policy that limits an authenticated caller to their
      -- own row, which would quietly offer the day to nobody.
      SELECT ur.user_id AS id
        FROM public.user_roles ur
       WHERE ur.role = 'provider'
         AND ur.user_id IS DISTINCT FROM v_visit.original_nurse_id
         AND ur.user_id IS DISTINCT FROM v_eng.patient_id
       LIMIT 50
    ) AS cand
  ON CONFLICT (visit_id, nurse_id) DO NOTHING;
  GET DIAGNOSTICS v_offers = ROW_COUNT;

  RETURN v_visit;
END $$;

-- ------------------------------------------------ substitute accepts -------
-- First accept wins: the row lock plus the assigned_nurse_id IS NULL check
-- means two nurses tapping together cannot both take the day.
CREATE OR REPLACE FUNCTION public.accept_nursing_visit(p_visit_id uuid)
RETURNS public.nursing_visits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_visit public.nursing_visits;
BEGIN
  IF NOT public.has_role(v_uid,'provider') THEN
    RAISE EXCEPTION 'NURSING_FORBIDDEN: Only an approved provider can accept a visit.';
  END IF;
  SELECT * INTO v_visit FROM public.nursing_visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NURSING_VISIT_NOT_FOUND: That visit no longer exists.';
  END IF;
  IF v_visit.status <> 'seeking_cover' OR v_visit.assigned_nurse_id IS NOT NULL THEN
    UPDATE public.nursing_visit_offers SET response = 'lost', responded_at = now()
     WHERE visit_id = p_visit_id AND nurse_id = v_uid AND response IS NULL;
    RAISE EXCEPTION 'NURSING_ALREADY_TAKEN: Another nurse accepted this day first.';
  END IF;

  -- The day's money follows the work: the covering nurse is paid, the original
  -- nurse loses it.
  UPDATE public.nursing_visits
     SET assigned_nurse_id = v_uid, status = 'scheduled',
         payout_to = v_uid, updated_at = now()
   WHERE id = p_visit_id RETURNING * INTO v_visit;

  UPDATE public.nursing_visit_offers SET response = 'accepted', responded_at = now()
   WHERE visit_id = p_visit_id AND nurse_id = v_uid;
  UPDATE public.nursing_visit_offers SET response = 'lost', responded_at = now()
   WHERE visit_id = p_visit_id AND nurse_id <> v_uid AND response IS NULL;

  RETURN v_visit;
END $$;

-- ------------------------------------------------------- visit progress ----
CREATE OR REPLACE FUNCTION public.advance_nursing_visit(
  p_visit_id uuid, p_status public.nursing_visit_status
) RETURNS public.nursing_visits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_visit public.nursing_visits;
BEGIN
  SELECT * INTO v_visit FROM public.nursing_visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NURSING_VISIT_NOT_FOUND: That visit no longer exists.';
  END IF;
  IF v_visit.assigned_nurse_id IS DISTINCT FROM v_uid AND NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'NURSING_FORBIDDEN: Only the assigned nurse can update this visit.';
  END IF;
  IF p_status NOT IN ('en_route','arrived','completed','no_show_patient') THEN
    RAISE EXCEPTION 'NURSING_BAD_STATUS: Not a status the nurse can set.';
  END IF;

  UPDATE public.nursing_visits
     SET status = p_status,
         en_route_at  = CASE WHEN p_status='en_route'  THEN now() ELSE en_route_at END,
         arrived_at   = CASE WHEN p_status='arrived'   THEN now() ELSE arrived_at END,
         completed_at = CASE WHEN p_status='completed' THEN now() ELSE completed_at END,
         payout_to    = CASE WHEN p_status='completed'
                             THEN COALESCE(payout_to, assigned_nurse_id) ELSE payout_to END,
         updated_at = now()
   WHERE id = p_visit_id RETURNING * INTO v_visit;

  -- Close the engagement once no day is left open.
  UPDATE public.nursing_engagements e SET status = 'completed', updated_at = now()
   WHERE e.id = v_visit.engagement_id
     AND NOT EXISTS (SELECT 1 FROM public.nursing_visits v
                      WHERE v.engagement_id = e.id
                        AND v.status IN ('scheduled','seeking_cover','en_route','arrived'));
  RETURN v_visit;
END $$;

-- --------------------------------------------------------- the sweeper -----
-- A day nobody marked is the silent failure this whole design exists to catch.
-- Run on a schedule: anything still open after its date becomes 'missed', and
-- the responsible nurse loses points.
CREATE OR REPLACE FUNCTION public.nursing_tick()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row record; v_n integer := 0; v_no_notice integer; v_late integer; v_free integer;
BEGIN
  SELECT penalty_no_notice, penalty_late_notice, free_notice_hours
    INTO v_no_notice, v_late, v_free FROM public.nursing_settings WHERE id = 1;

  FOR v_row IN
    SELECT v.*, e.slot_time FROM public.nursing_visits v
      JOIN public.nursing_engagements e ON e.id = v.engagement_id
     WHERE v.status IN ('scheduled','seeking_cover','en_route','arrived')
       AND (v.visit_date + COALESCE(e.slot_time, time '09:00'))::timestamptz
           < now() - interval '6 hours'
     LIMIT 500
  LOOP
    UPDATE public.nursing_visits
       SET status = 'missed', payout_to = NULL, updated_at = now()
     WHERE id = v_row.id;

    IF v_row.assigned_nurse_id IS NOT NULL THEN
      -- Assigned and simply did not turn up: the full no-notice penalty.
      PERFORM public.apply_provider_score(v_row.assigned_nurse_id, -COALESCE(v_no_notice,10),
        'Absent without notice', v_row.id);
    ELSIF v_row.original_nurse_id IS NOT NULL
          AND COALESCE(v_row.notice_hours, 0) >= COALESCE(v_free,12) THEN
      -- Gave proper notice but no locum was found, so the day was still lost.
      PERFORM public.apply_provider_score(v_row.original_nurse_id, -COALESCE(v_late,5),
        'Released with notice but no cover was found', v_row.id);
    END IF;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

-- ---------------------------------------------------------------- reads ----
CREATE OR REPLACE FUNCTION public.list_nursing_offers()
RETURNS SETOF public.nursing_visits
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.* FROM public.nursing_visits v
   WHERE (v.assigned_nurse_id = auth.uid() AND v.status IN ('scheduled','en_route','arrived'))
      OR (v.status = 'seeking_cover' AND EXISTS (
            SELECT 1 FROM public.nursing_visit_offers o
             WHERE o.visit_id = v.id AND o.nurse_id = auth.uid()
               AND o.response IS DISTINCT FROM 'declined'))
   ORDER BY v.visit_date
   LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.my_provider_score()
RETURNS TABLE (period date, score integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.period, s.score FROM public.provider_scores s
   WHERE s.user_id = auth.uid() ORDER BY s.period DESC LIMIT 12;
$$;

-- ------------------------------------------------------------------ RLS ----
ALTER TABLE public.nursing_engagements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nursing_visits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nursing_visit_offers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_scores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_score_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nursing_settings       ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.nursing_engagements, public.nursing_visits,
                public.nursing_visit_offers, public.provider_scores,
                public.provider_score_events, public.nursing_settings
  TO authenticated;
GRANT ALL ON public.nursing_engagements, public.nursing_visits,
             public.nursing_visit_offers, public.provider_scores,
             public.provider_score_events, public.nursing_settings
  TO service_role;

DROP POLICY IF EXISTS "engagement readable to parties" ON public.nursing_engagements;
CREATE POLICY "engagement readable to parties" ON public.nursing_engagements
  FOR SELECT TO authenticated USING (
    patient_id = auth.uid() OR primary_nurse_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.nursing_visits v
                WHERE v.engagement_id = id AND v.assigned_nurse_id = auth.uid()));

DROP POLICY IF EXISTS "visit readable to parties" ON public.nursing_visits;
CREATE POLICY "visit readable to parties" ON public.nursing_visits
  FOR SELECT TO authenticated USING (
    assigned_nurse_id = auth.uid() OR original_nurse_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.nursing_engagements e
                WHERE e.id = engagement_id AND e.patient_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.nursing_visit_offers o
                WHERE o.visit_id = id AND o.nurse_id = auth.uid()));

DROP POLICY IF EXISTS "offer readable to that nurse" ON public.nursing_visit_offers;
CREATE POLICY "offer readable to that nurse" ON public.nursing_visit_offers
  FOR SELECT TO authenticated
  USING (nurse_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- A provider sees their own score and every deduction behind it, nobody else's.
DROP POLICY IF EXISTS "own score readable" ON public.provider_scores;
CREATE POLICY "own score readable" ON public.provider_scores
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own score events readable" ON public.provider_score_events;
CREATE POLICY "own score events readable" ON public.provider_score_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "nursing settings readable" ON public.nursing_settings;
CREATE POLICY "nursing settings readable" ON public.nursing_settings
  FOR SELECT TO authenticated USING (true);

GRANT EXECUTE ON FUNCTION public.create_nursing_engagement(
  integer, date, time, text, text, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_nursing_visit_by_family(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_nursing_visit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_nursing_visit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_nursing_visit(
  uuid, public.nursing_visit_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_nursing_offers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_provider_score() TO authenticated;

-- Postgres grants EXECUTE to PUBLIC by default and anon inherits it. A
-- SECURITY DEFINER function reachable by anon is a hole even when it checks
-- auth.uid() inside, so revoke across the module and keep the grants above.
DO $$
DECLARE v_fn record;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('create_nursing_engagement','cancel_nursing_visit_by_family',
         'release_nursing_visit','accept_nursing_visit','advance_nursing_visit',
         'list_nursing_offers','my_provider_score','apply_provider_score','nursing_tick')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', v_fn.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', v_fn.sig);
  END LOOP;
END $$;

-- Internal only: the sweeper and the score writer are never called by a client.
REVOKE ALL ON FUNCTION public.nursing_tick() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_provider_score(uuid, integer, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nursing_tick() TO service_role;

ALTER TABLE public.nursing_visits REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.nursing_visits;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.nursing_visit_offers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

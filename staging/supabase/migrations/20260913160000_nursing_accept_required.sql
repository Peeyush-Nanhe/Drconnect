-- ============================================================================
-- A nurse booking is only booked once a nurse accepts.
--
-- Choosing a nurse no longer assigns her. It offers the work to her first and
-- waits. If she has not accepted within the grace period, the request opens to
-- everyone and the first to accept takes it. This is what the picker already
-- promises the patient: "Your favourites get the request first. We broadcast to
-- all nurses only if they don't take it within 10 minutes."
-- ============================================================================

ALTER TABLE public.nursing_engagements
  ADD COLUMN IF NOT EXISTS preferred_nurse_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS broadcast_after timestamptz;

ALTER TABLE public.nursing_settings
  ADD COLUMN IF NOT EXISTS preferred_grace_seconds integer NOT NULL DEFAULT 600;

-- Replacing a function cannot change its signature; two overloads would make
-- every call fail with "function is not unique". Drop the old one first.
DROP FUNCTION IF EXISTS public.create_nursing_engagement(
  integer, date, time, text, text, double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION public.create_nursing_engagement(
  p_days       integer,
  p_start_date date,
  p_slot_time  time DEFAULT NULL,
  p_kind       text DEFAULT 'General Duty Nurse',
  p_address    text DEFAULT NULL,
  p_lat        double precision DEFAULT NULL,
  p_lng        double precision DEFAULT NULL,
  p_nurse_id   uuid DEFAULT NULL
) RETURNS public.nursing_engagements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_eng public.nursing_engagements;
  v_rate integer; v_i integer; v_grace integer;
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
  -- Read user_roles directly: has_role() answers for the caller, not for the
  -- person being named, so it returns false for a perfectly valid nurse.
  IF p_nurse_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p_nurse_id AND ur.role = 'provider') THEN
    RAISE EXCEPTION 'NURSING_BAD_NURSE: That nurse is not available for booking.';
  END IF;

  SELECT day_rate, preferred_grace_seconds INTO v_rate, v_grace
    FROM public.nursing_settings WHERE id = 1;
  v_rate  := COALESCE(v_rate, 800);
  v_grace := COALESCE(v_grace, 600);

  -- Always seeking_nurse. Nothing is assigned and no visit has a nurse until
  -- somebody accepts.
  INSERT INTO public.nursing_engagements (
    patient_id, kind, days_booked, days_scheduled, day_rate, total_amount,
    start_date, slot_time, address_snapshot, lat, lng, paid_at,
    preferred_nurse_id, assignment_state, broadcast_after)
  VALUES (v_uid, p_kind, p_days, p_days, v_rate, v_rate * p_days,
          p_start_date, p_slot_time, p_address, p_lat, p_lng, now(),
          p_nurse_id, 'seeking_nurse'::public.nursing_assignment_state,
          CASE WHEN p_nurse_id IS NULL THEN now()
               ELSE now() + make_interval(secs => v_grace) END)
  RETURNING * INTO v_eng;

  FOR v_i IN 1..p_days LOOP
    INSERT INTO public.nursing_visits (engagement_id, seq, visit_date, payout_amount)
    VALUES (v_eng.id, v_i, p_start_date + (v_i - 1), v_rate);
  END LOOP;

  IF p_nurse_id IS NULL THEN
    -- Nobody named: open to everyone straight away.
    PERFORM public.broadcast_nursing_engagement(v_eng.id);
  ELSE
    -- Named: she gets it alone until the grace period runs out.
    INSERT INTO public.nursing_engagement_offers
      (engagement_id, nurse_id, offer_amount, days_offered)
    VALUES (v_eng.id, p_nurse_id, v_eng.total_amount, v_eng.days_scheduled)
    ON CONFLICT (engagement_id, nurse_id) DO NOTHING;
  END IF;

  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = v_eng.id;
  RETURN v_eng;
END $$;

-- Opens a named request to every nurse once the grace period has passed. The
-- server owns the clock, so calling this early is a no-op rather than a way to
-- skip the preferred nurse's turn.
CREATE OR REPLACE FUNCTION public.escalate_nursing_engagement(p_engagement_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_eng public.nursing_engagements; v_n integer := 0;
BEGIN
  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = p_engagement_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_eng.assignment_state <> 'seeking_nurse' OR v_eng.primary_nurse_id IS NOT NULL THEN
    RETURN 0;
  END IF;
  IF v_eng.broadcast_after IS NOT NULL AND now() < v_eng.broadcast_after THEN
    RETURN 0;
  END IF;

  -- The preferred nurse keeps her offer; she simply no longer has it alone.
  v_n := public.broadcast_nursing_engagement(p_engagement_id);
  RETURN v_n;
END $$;

-- Sweep for anything past its grace period, so escalation does not depend on
-- the patient keeping the app open.
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

GRANT EXECUTE ON FUNCTION public.create_nursing_engagement(
  integer, date, time, text, text, double precision, double precision, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_nursing_engagement(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.create_nursing_engagement(
  integer, date, time, text, text, double precision, double precision, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.escalate_nursing_engagement(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nursing_escalation_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nursing_escalation_tick() TO service_role;

-- ============================================================================
-- Nursing: stop the same work being booked twice.
--
-- Two problems wear the same name. The patient one is a double tap: two rows a
-- minute apart, same package. The nurse one is worse and has no guard at all —
-- accept_nursing_engagement never asked whether the accepting nurse already has
-- those dates, so one nurse can hold two families for the same fortnight and
-- nothing objects until somebody is left waiting at a door.
--
--   patient side : idempotency key, plus a short-window repeat returning the
--                  original booking rather than creating a second one
--   nurse side   : a conflict check on accept, backed by a unique index so a
--                  race cannot slip past the check
-- ============================================================================

ALTER TABLE public.nursing_engagements
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS nursing_eng_idempotency_uniq
  ON public.nursing_engagements (patient_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- The backstop. A nurse cannot hold two shifts that overlap, whatever route the
-- write took. Cancelled, missed and completed days are excluded, so history and
-- replacement days are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS nursing_visits_nurse_day_uniq
  ON public.nursing_visits (assigned_nurse_id, visit_date)
  WHERE assigned_nurse_id IS NOT NULL
    AND status IN ('scheduled','en_route','arrived');

-- Which days of an engagement this nurse already has spoken for.
CREATE OR REPLACE FUNCTION public.nursing_nurse_conflicts(
  p_nurse uuid, p_engagement_id uuid
) RETURNS SETOF date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT mine.visit_date
    FROM public.nursing_visits want
    JOIN public.nursing_visits mine
      ON mine.assigned_nurse_id = p_nurse
     AND mine.engagement_id <> want.engagement_id
     AND mine.status IN ('scheduled','en_route','arrived')
     AND tstzrange(mine.shift_start, mine.shift_end, '[)')
      && tstzrange(want.shift_start, want.shift_end, '[)')
   WHERE want.engagement_id = p_engagement_id
     AND want.status IN ('scheduled','seeking_cover')
   ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.accept_nursing_engagement(p_engagement_id uuid)
RETURNS public.nursing_engagements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_eng public.nursing_engagements; v_clash text;
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
  IF NOT EXISTS (SELECT 1 FROM public.nursing_engagement_offers o
                  WHERE o.engagement_id = p_engagement_id AND o.nurse_id = v_uid
                    AND o.response IS DISTINCT FROM 'declined') THEN
    RAISE EXCEPTION 'NURSING_NOT_OFFERED: This booking was not offered to you.';
  END IF;

  -- Named dates, not a bare refusal: the nurse needs to know which days clash.
  SELECT string_agg(to_char(d, 'DD Mon'), ', ' ORDER BY d) INTO v_clash
    FROM public.nursing_nurse_conflicts(v_uid, p_engagement_id) d;
  IF v_clash IS NOT NULL THEN
    RAISE EXCEPTION 'NURSING_NURSE_BUSY: You are already booked on %.', v_clash;
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
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'NURSING_NURSE_BUSY: One of those days is already on your calendar.';
END $$;

-- Same guard for a single cover day.
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
  IF EXISTS (SELECT 1 FROM public.nursing_visits mine
              WHERE mine.assigned_nurse_id = v_uid
                AND mine.status IN ('scheduled','en_route','arrived')
                AND tstzrange(mine.shift_start, mine.shift_end, '[)')
                 && tstzrange(v_visit.shift_start, v_visit.shift_end, '[)')) THEN
    RAISE EXCEPTION 'NURSING_NURSE_BUSY: You are already booked that day.';
  END IF;

  UPDATE public.nursing_visits
     SET assigned_nurse_id = v_uid, status = 'scheduled',
         payout_to = v_uid, updated_at = now()
   WHERE id = p_visit_id RETURNING * INTO v_visit;

  UPDATE public.nursing_visit_offers SET response = 'accepted', responded_at = now()
   WHERE visit_id = p_visit_id AND nurse_id = v_uid;
  UPDATE public.nursing_visit_offers SET response = 'lost', responded_at = now()
   WHERE visit_id = p_visit_id AND nurse_id <> v_uid AND response IS NULL;

  RETURN v_visit;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'NURSING_NURSE_BUSY: You are already booked that day.';
END $$;

-- The replacement day has to land on a date the nurse is actually free,
-- otherwise the unique index above turns a family cancellation into an error.
CREATE OR REPLACE FUNCTION public.cancel_nursing_visit_by_family(
  p_visit_id uuid, p_reason text DEFAULT NULL
) RETURNS public.nursing_visits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_visit public.nursing_visits;
        v_eng public.nursing_engagements; v_last date; v_seq integer;
        v_new public.nursing_visits; v_try date; v_guard integer := 0;
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

  SELECT max(visit_date), max(seq) INTO v_last, v_seq
    FROM public.nursing_visits WHERE engagement_id = v_eng.id;

  v_try := v_last + 1;
  WHILE v_guard < 60 AND v_eng.primary_nurse_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.nursing_visits mine
           WHERE mine.assigned_nurse_id = v_eng.primary_nurse_id
             AND mine.visit_date = v_try
             AND mine.status IN ('scheduled','en_route','arrived'))
  LOOP
    v_try := v_try + 1; v_guard := v_guard + 1;
  END LOOP;

  INSERT INTO public.nursing_visits
    (engagement_id, seq, visit_date, payout_amount, assigned_nurse_id, payout_to,
     replaces_visit_id)
  VALUES (v_eng.id, v_seq + 1, v_try, v_eng.day_rate,
          v_eng.primary_nurse_id, v_eng.primary_nurse_id, p_visit_id)
  RETURNING * INTO v_new;

  UPDATE public.nursing_engagements
     SET days_scheduled = days_scheduled + 1, updated_at = now()
   WHERE id = v_eng.id;

  RETURN v_new;
END $$;

-- ------------------------------------------------------- the create RPC ----
-- Final signature. Adds shift_hours and an idempotency key; a repeat of the
-- same package inside the double-tap window returns the original booking
-- instead of taking the money twice.
DROP FUNCTION IF EXISTS public.create_nursing_engagement(
  integer, date, time, text, text, double precision, double precision);
DROP FUNCTION IF EXISTS public.create_nursing_engagement(
  integer, date, time, text, text, double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION public.create_nursing_engagement(
  p_days            integer,
  p_start_date      date,
  p_slot_time       time DEFAULT NULL,
  p_kind            text DEFAULT 'General Duty Nurse',
  p_address         text DEFAULT NULL,
  p_lat             double precision DEFAULT NULL,
  p_lng             double precision DEFAULT NULL,
  p_nurse_id        uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS public.nursing_engagements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_eng public.nursing_engagements;
  v_rate integer; v_i integer; v_grace integer; v_shift integer;
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
  IF p_nurse_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p_nurse_id AND ur.role = 'provider') THEN
    RAISE EXCEPTION 'NURSING_BAD_NURSE: That nurse is not available for booking.';
  END IF;

  -- Explicit key wins.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_eng FROM public.nursing_engagements
     WHERE patient_id = v_uid AND idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_eng; END IF;
  END IF;

  -- No key: a same-shape repeat within two minutes is a double tap, not a
  -- second booking. Deliberate repeats outside the window still go through.
  SELECT * INTO v_eng FROM public.nursing_engagements
   WHERE patient_id = v_uid AND kind = p_kind AND start_date = p_start_date
     AND days_booked = p_days AND status = 'active'
     AND created_at > now() - interval '2 minutes'
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_eng; END IF;

  SELECT day_rate, preferred_grace_seconds, shift_hours
    INTO v_rate, v_grace, v_shift
    FROM public.nursing_settings WHERE id = 1;
  v_rate  := COALESCE(v_rate, 800);
  v_grace := COALESCE(v_grace, 600);
  v_shift := COALESCE(v_shift, 12);

  -- Always seeking_nurse. Naming a nurse offers her the work; it does not
  -- assign it. Nothing is confirmed to the patient until somebody accepts.
  INSERT INTO public.nursing_engagements (
    patient_id, kind, days_booked, days_scheduled, day_rate, total_amount,
    start_date, slot_time, shift_hours, address_snapshot, lat, lng, paid_at,
    preferred_nurse_id, assignment_state, broadcast_after, idempotency_key)
  VALUES (v_uid, p_kind, p_days, p_days, v_rate, v_rate * p_days,
          p_start_date, p_slot_time, v_shift, p_address, p_lat, p_lng, now(),
          p_nurse_id, 'seeking_nurse'::public.nursing_assignment_state,
          CASE WHEN p_nurse_id IS NULL THEN now()
               ELSE now() + make_interval(secs => v_grace) END,
          p_idempotency_key)
  RETURNING * INTO v_eng;

  FOR v_i IN 1..p_days LOOP
    INSERT INTO public.nursing_visits (engagement_id, seq, visit_date, payout_amount)
    VALUES (v_eng.id, v_i, p_start_date + (v_i - 1), v_rate);
  END LOOP;

  IF p_nurse_id IS NULL THEN
    PERFORM public.broadcast_nursing_engagement(v_eng.id);
  ELSE
    INSERT INTO public.nursing_engagement_offers
      (engagement_id, nurse_id, offer_amount, days_offered)
    VALUES (v_eng.id, p_nurse_id, v_eng.total_amount, v_eng.days_scheduled)
    ON CONFLICT (engagement_id, nurse_id) DO NOTHING;
  END IF;

  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = v_eng.id;
  RETURN v_eng;
END $$;

GRANT EXECUTE ON FUNCTION public.create_nursing_engagement(
  integer, date, time, text, text, double precision, double precision, uuid, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.create_nursing_engagement(
  integer, date, time, text, text, double precision, double precision, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_nursing_engagement(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_nursing_visit(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.nursing_nurse_conflicts(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_nursing_visit_by_family(uuid, text) TO authenticated;

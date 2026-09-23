-- ============================================================================
-- Nursing: prove the nurse arrived, and give her the address when she needs it.
--
-- nursing_visits.arrival_otp existed and nothing ever wrote or read it.
-- advance_nursing_visit let the assigned nurse set 'arrived' and then
-- 'completed' with no check at all, and 'completed' is what sets payout_to — so
-- a thirty-day package could be closed out and paid from the sofa.
--
-- The code is held as a salted hash, matching home_visit_arrival_secrets. The
-- patient reads the code out; the nurse enters it. Nobody can set 'arrived' any
-- other way, and 'completed' requires an arrival on record.
--
-- The address is released to the assigned nurse from two hours before the shift
-- and not before, so an offer does not leak where somebody lives. There is no
-- shift_start/shift_end on nursing_visits — the shift time lives on the
-- engagement as slot_time, shared by every day in the package.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nursing_arrival_secrets (
  visit_id    uuid PRIMARY KEY REFERENCES public.nursing_visits(id) ON DELETE CASCADE,
  salt        uuid NOT NULL DEFAULT gen_random_uuid(),
  code_hash   bytea,
  expires_at  timestamptz,
  issued_at   timestamptz,
  consumed_at timestamptz,
  attempts    integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  issue_count integer NOT NULL DEFAULT 0 CHECK (issue_count BETWEEN 0 AND 10)
);

ALTER TABLE public.nursing_arrival_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nursing_arrival_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.nursing_arrival_secrets TO service_role;

-- The legacy column is never used by this flow.
ALTER TABLE public.nursing_visits DROP COLUMN IF EXISTS arrival_otp;

-- Patient issues the code for one of their own days. Re-issuable, capped.
CREATE OR REPLACE FUNCTION public.issue_nursing_arrival_code(p_visit_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_visit public.nursing_visits;
        v_eng public.nursing_engagements; v_code text; v_salt uuid; v_count integer;
BEGIN
  SELECT * INTO v_visit FROM public.nursing_visits WHERE id = p_visit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NURSING_VISIT_NOT_FOUND: That visit no longer exists.';
  END IF;
  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = v_visit.engagement_id;
  IF v_eng.patient_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'NURSING_FORBIDDEN: Only the patient can issue the arrival code.';
  END IF;
  IF v_visit.status NOT IN ('scheduled','en_route') THEN
    RAISE EXCEPTION 'NURSING_VISIT_CLOSED: No arrival code is needed for that day.';
  END IF;
  IF v_visit.assigned_nurse_id IS NULL THEN
    RAISE EXCEPTION 'NURSING_NO_NURSE: No nurse is assigned to that day yet.';
  END IF;

  INSERT INTO public.nursing_arrival_secrets (visit_id) VALUES (p_visit_id)
  ON CONFLICT (visit_id) DO NOTHING;

  SELECT issue_count INTO v_count FROM public.nursing_arrival_secrets WHERE visit_id = p_visit_id;
  IF COALESCE(v_count, 0) >= 10 THEN
    RAISE EXCEPTION 'NURSING_CODE_LIMIT: Too many codes issued for this visit.';
  END IF;

  v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
  v_salt := gen_random_uuid();

  UPDATE public.nursing_arrival_secrets
     SET salt = v_salt,
         code_hash = sha256(convert_to(p_visit_id::text || v_salt::text || v_code, 'UTF8')),
         issued_at = now(), expires_at = now() + interval '60 minutes',
         consumed_at = NULL, attempts = 0, issue_count = issue_count + 1
   WHERE visit_id = p_visit_id;

  RETURN v_code;
END $$;

-- Nurse verifies. This is the only route to 'arrived'.
CREATE OR REPLACE FUNCTION public.verify_nursing_arrival(p_visit_id uuid, p_code text)
RETURNS public.nursing_visits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_visit public.nursing_visits;
        v_secret public.nursing_arrival_secrets;
BEGIN
  SELECT * INTO v_visit FROM public.nursing_visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NURSING_VISIT_NOT_FOUND: That visit no longer exists.';
  END IF;
  IF v_visit.assigned_nurse_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'NURSING_FORBIDDEN: Only the assigned nurse can confirm arrival.';
  END IF;
  IF v_visit.status NOT IN ('scheduled','en_route') THEN
    RAISE EXCEPTION 'NURSING_VISIT_CLOSED: That day is not open for arrival.';
  END IF;

  SELECT * INTO v_secret FROM public.nursing_arrival_secrets
   WHERE visit_id = p_visit_id FOR UPDATE;
  IF NOT FOUND OR v_secret.code_hash IS NULL THEN
    RAISE EXCEPTION 'NURSING_NO_CODE: Ask the family to generate the arrival code.';
  END IF;
  IF v_secret.expires_at IS NOT NULL AND v_secret.expires_at < now() THEN
    RAISE EXCEPTION 'NURSING_CODE_EXPIRED: That code has expired; ask for a new one.';
  END IF;
  IF v_secret.attempts >= 5 THEN
    RAISE EXCEPTION 'NURSING_CODE_LOCKED: Too many attempts; ask for a new code.';
  END IF;

  IF p_code !~ '^[0-9]{6}$'
     OR v_secret.code_hash IS DISTINCT FROM
        sha256(convert_to(p_visit_id::text || v_secret.salt::text || p_code, 'UTF8')) THEN
    UPDATE public.nursing_arrival_secrets SET attempts = attempts + 1
     WHERE visit_id = p_visit_id;
    RAISE EXCEPTION 'NURSING_CODE_WRONG: That code does not match.';
  END IF;

  UPDATE public.nursing_arrival_secrets
     SET consumed_at = now(), code_hash = NULL WHERE visit_id = p_visit_id;

  UPDATE public.nursing_visits
     SET status = 'arrived', arrived_at = now(), updated_at = now()
   WHERE id = p_visit_id RETURNING * INTO v_visit;
  RETURN v_visit;
END $$;

-- 'arrived' is no longer settable directly, and 'completed' needs an arrival.
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
  IF p_status NOT IN ('en_route','completed','no_show_patient') THEN
    RAISE EXCEPTION 'NURSING_BAD_STATUS: Not a status the nurse can set.';
  END IF;
  IF p_status = 'completed' AND v_visit.arrived_at IS NULL
     AND NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'NURSING_ARRIVAL_REQUIRED: Confirm arrival with the family code first.';
  END IF;
  IF p_status = 'en_route' AND v_visit.status <> 'scheduled' THEN
    RAISE EXCEPTION 'NURSING_BAD_STATUS: That day is not waiting to start.';
  END IF;

  UPDATE public.nursing_visits
     SET status = p_status,
         en_route_at  = CASE WHEN p_status='en_route'  THEN now() ELSE en_route_at END,
         completed_at = CASE WHEN p_status='completed' THEN now() ELSE completed_at END,
         payout_to    = CASE WHEN p_status='completed'
                             THEN COALESCE(payout_to, assigned_nurse_id) ELSE payout_to END,
         updated_at = now()
   WHERE id = p_visit_id RETURNING * INTO v_visit;

  UPDATE public.nursing_engagements e SET status = 'completed', updated_at = now()
   WHERE e.id = v_visit.engagement_id
     AND NOT EXISTS (SELECT 1 FROM public.nursing_visits v
                      WHERE v.engagement_id = e.id
                        AND v.status IN ('scheduled','seeking_cover','en_route','arrived'));
  RETURN v_visit;
END $$;

-- Directions. Released to the assigned nurse from two hours before the shift.
-- The shift clock comes from the engagement's slot_time (shared by every day
-- in the package) combined with this visit's own date; when no slot_time was
-- set at booking, the address is released without a time gate.
CREATE OR REPLACE FUNCTION public.nursing_visit_directions(p_visit_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_visit public.nursing_visits;
        v_eng public.nursing_engagements; v_shift_start timestamptz;
BEGIN
  SELECT * INTO v_visit FROM public.nursing_visits WHERE id = p_visit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NURSING_VISIT_NOT_FOUND: That visit no longer exists.';
  END IF;
  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = v_visit.engagement_id;

  IF v_visit.assigned_nurse_id IS DISTINCT FROM v_uid
     AND v_eng.patient_id IS DISTINCT FROM v_uid
     AND NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'NURSING_FORBIDDEN: Not your visit.';
  END IF;

  IF v_eng.slot_time IS NOT NULL THEN
    v_shift_start := (v_visit.visit_date + v_eng.slot_time) AT TIME ZONE 'Asia/Kolkata';
  END IF;

  IF v_visit.assigned_nurse_id = v_uid
     AND v_shift_start IS NOT NULL
     AND now() < v_shift_start - interval '2 hours' THEN
    RAISE EXCEPTION 'NURSING_TOO_EARLY: The address opens two hours before the shift.';
  END IF;

  RETURN jsonb_build_object(
    'visit_id',    v_visit.id,
    'visit_date',  v_visit.visit_date,
    'shift_start', v_shift_start,
    'shift_end',   NULL,
    'address',     v_eng.address_snapshot,
    'lat',         v_eng.lat,
    'lng',         v_eng.lng,
    'patient_name', (SELECT full_name FROM public.profiles WHERE id = v_eng.patient_id),
    'maps_url',    CASE WHEN v_eng.lat IS NULL OR v_eng.lng IS NULL THEN NULL
                        ELSE 'https://www.google.com/maps/dir/?api=1&destination='
                             || v_eng.lat::text || ',' || v_eng.lng::text END);
END $$;

GRANT EXECUTE ON FUNCTION public.issue_nursing_arrival_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_nursing_arrival(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_nursing_visit(uuid, public.nursing_visit_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nursing_visit_directions(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.issue_nursing_arrival_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_nursing_arrival(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nursing_visit_directions(uuid) FROM PUBLIC, anon;

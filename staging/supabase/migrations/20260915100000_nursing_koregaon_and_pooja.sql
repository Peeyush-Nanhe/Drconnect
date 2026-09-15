-- ============================================================================
-- Nursing: Koregaon Park location defaulting and Pooja (Nurse) profile update
-- ============================================================================

-- 1. Default any null coordinates to Koregaon Park (18.5362, 73.8930) in existing engagements
UPDATE public.nursing_engagements
   SET lat = 18.5362, lng = 73.8930
 WHERE lat IS NULL OR lng IS NULL;

-- 2. Update create_nursing_engagement to default null coordinates to Koregaon Park
CREATE OR REPLACE FUNCTION public.create_nursing_engagement(
  p_days            integer,
  p_start_date      date,
  p_slot_time       time DEFAULT NULL,
  p_kind            text DEFAULT 'General Duty Nurse',
  p_address         text DEFAULT NULL,
  p_lat             double precision DEFAULT 18.5362,
  p_lng             double precision DEFAULT 73.8930,
  p_nurse_id        uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS public.nursing_engagements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_eng public.nursing_engagements;
  v_rate integer; v_i integer; v_grace integer; v_shift integer;
  v_lat double precision := COALESCE(p_lat, 18.5362);
  v_lng double precision := COALESCE(p_lng, 73.8930);
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

  -- No key: a same-shape repeat within two minutes is a double tap, not a second booking.
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

  INSERT INTO public.nursing_engagements (
    patient_id, kind, days_booked, days_scheduled, day_rate, total_amount,
    start_date, slot_time, shift_hours, address_snapshot, lat, lng, paid_at,
    preferred_nurse_id, assignment_state, broadcast_after, idempotency_key)
  VALUES (v_uid, p_kind, p_days, p_days, v_rate, v_rate * p_days,
          p_start_date, p_slot_time, v_shift, COALESCE(p_address, 'Koregaon Park, Pune'), v_lat, v_lng, now(),
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

  RETURN v_eng;
END $$;

REVOKE ALL ON FUNCTION public.create_nursing_engagement(
  integer, date, time, text, text, double precision, double precision, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_nursing_engagement(
  integer, date, time, text, text, double precision, double precision, uuid, text) TO authenticated;

-- 3. Rename and configure user 7a1ee8b5-cc94-4e56-888f-a76536b28d9b as Pooja (Nurse) if present
DO $$
DECLARE
  v_nurse_id uuid := '7a1ee8b5-cc94-4e56-888f-a76536b28d9b';
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_nurse_id) THEN
    -- Update profile
    UPDATE public.profiles
       SET full_name = 'Pooja (Nurse)',
           view = 'nurse',
           specialty = 'Nurse',
           lat = 18.5362,
           lng = 73.8930,
           updated_at = now()
     WHERE id = v_nurse_id;

    -- Update role request
    UPDATE public.account_role_requests
       SET requested_role = 'provider',
           requested_view = 'nurse',
           status = 'approved',
           updated_at = now()
     WHERE user_id = v_nurse_id;

    -- Ensure role exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_nurse_id, 'provider')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Update auth.users metadata
    UPDATE auth.users
       SET raw_user_meta_data = jsonb_set(
             jsonb_set(
               jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{full_name}', '"Pooja (Nurse)"'),
               '{subtype}', '"nurse"'
             ),
             '{role}', '"provider"'
           )
     WHERE id = v_nurse_id;
  END IF;
END $$;

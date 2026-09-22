-- Nurse and technician bookings had no way to charge the same +20% urgent
-- surcharge that doctor/physio bookings already apply via buildFare() /
-- insertEmergencyPhysioVisit. The fee was always read straight off the
-- catalog / nursing_settings.day_rate, with urgency stored as inert
-- metadata. This adds a p_urgent flag to all three booking RPCs and
-- applies round(base * 1.2) the same way physio does, so the surcharge is
-- enforced server-side and can't be spoofed from the client.

CREATE OR REPLACE FUNCTION public.create_nursing_engagement(
  p_days integer,
  p_start_date date,
  p_slot_time time without time zone DEFAULT NULL::time without time zone,
  p_kind text DEFAULT 'General Duty Nurse'::text,
  p_address text DEFAULT NULL::text,
  p_lat double precision DEFAULT NULL::double precision,
  p_lng double precision DEFAULT NULL::double precision,
  p_nurse_id uuid DEFAULT NULL::uuid,
  p_urgent boolean DEFAULT false)
RETURNS public.nursing_engagements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_eng public.nursing_engagements;
  v_rate integer; v_i integer; v_grace integer; v_clash date;
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
  IF p_start_date = current_date AND p_slot_time IS NOT NULL
     AND p_slot_time < (now() AT TIME ZONE 'Asia/Kolkata')::time THEN
    RAISE EXCEPTION 'NURSING_BAD_TIME: That start time has already passed today.';
  END IF;
  IF p_nurse_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.nurses n
        WHERE n.user_id = p_nurse_id AND n.active AND n.verified) THEN
    RAISE EXCEPTION 'NURSING_BAD_NURSE: That nurse is not available for booking.';
  END IF;
  -- A named nurse must be free on every day of the package.
  IF p_nurse_id IS NOT NULL THEN
    SELECT d INTO v_clash
      FROM public.nurse_booked_dates(p_nurse_id, p_start_date, p_start_date + (p_days - 1)) AS d
     LIMIT 1;
    IF v_clash IS NOT NULL THEN
      RAISE EXCEPTION 'NURSING_NURSE_BUSY: This nurse is already booked on %. Choose other dates or any available nurse.', to_char(v_clash, 'DD Mon');
    END IF;
  END IF;

  SELECT day_rate, preferred_grace_seconds INTO v_rate, v_grace
    FROM public.nursing_settings WHERE id = 1;
  v_rate  := COALESCE(v_rate, 800);
  v_grace := COALESCE(v_grace, 600);
  IF p_urgent THEN
    v_rate := round(v_rate * 1.2);
  END IF;

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
    PERFORM public.broadcast_nursing_engagement(v_eng.id);
  ELSE
    INSERT INTO public.nursing_engagement_offers
      (engagement_id, nurse_id, offer_amount, days_offered)
    VALUES (v_eng.id, p_nurse_id, v_eng.total_amount, v_eng.days_scheduled)
    ON CONFLICT (engagement_id, nurse_id) DO NOTHING;
  END IF;

  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = v_eng.id;
  RETURN v_eng;
END $function$;

CREATE OR REPLACE FUNCTION public.create_technician_request(
  p_test_type text, p_scheduled_at timestamptz, p_area text,
  p_city text DEFAULT 'Pune', p_address text DEFAULT NULL,
  p_notes text DEFAULT NULL, p_urgency text DEFAULT 'normal', p_home_visit boolean DEFAULT true)
RETURNS public.technician_tests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_cat public.technician_test_catalog; v_name text; v_phone text; v_row public.technician_tests; v_fee numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'TECH_AUTH_REQUIRED: Sign in to book a technician.'; END IF;
  SELECT * INTO v_cat FROM public.technician_test_catalog WHERE test_type = p_test_type AND active;
  IF v_cat.test_type IS NULL THEN RAISE EXCEPTION 'TECH_BAD_TEST: Choose a valid test.'; END IF;
  IF p_scheduled_at IS NULL OR p_scheduled_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'TECH_BAD_TIME: Choose a future date and time.'; END IF;
  IF p_area IS NULL OR length(btrim(p_area)) = 0 OR length(p_area) > 100 THEN
    RAISE EXCEPTION 'TECH_BAD_AREA: Area is required.'; END IF;
  IF p_urgency NOT IN ('normal','urgent') THEN RAISE EXCEPTION 'TECH_BAD_URGENCY: Invalid urgency.'; END IF;

  SELECT full_name, phone INTO v_name, v_phone FROM public.profiles WHERE id = v_uid;
  v_fee := CASE WHEN p_urgency = 'urgent' THEN round(v_cat.fee * 1.2) ELSE v_cat.fee END;

  INSERT INTO public.technician_tests (patient_id, patient_name, patient_phone, test_type, test_label,
    area, city, home_visit, scheduled_at, urgency, status, fee, notes)
  VALUES (v_uid, COALESCE(v_name,'Patient'), v_phone, v_cat.test_type, v_cat.label,
    btrim(p_area), COALESCE(NULLIF(btrim(p_city),''),'Pune'), COALESCE(p_home_visit, true), p_scheduled_at,
    p_urgency, 'requested', v_fee, NULLIF(btrim(COALESCE(p_notes,'')),''))
  RETURNING * INTO v_row;
  RETURN v_row;
END $function$;

CREATE OR REPLACE FUNCTION public.atomic_book_technician_test(
  p_technician_id uuid, p_test_type text, p_start_time timestamptz, p_area text,
  p_city text DEFAULT 'Pune', p_address text DEFAULT NULL, p_notes text DEFAULT NULL,
  p_urgency text DEFAULT 'normal', p_home_visit boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid(); tech public.technicians; cat public.technician_test_catalog;
  a public.provider_availability; win jsonb; valid boolean := false;
  v_end timestamptz; v_name text; v_phone text; v_id uuid; v_fee numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to book a technician'; END IF;
  SELECT * INTO cat FROM public.technician_test_catalog WHERE test_type = p_test_type AND active;
  IF cat.test_type IS NULL THEN RAISE EXCEPTION 'Choose a valid test'; END IF;
  IF p_start_time IS NULL OR p_start_time <= now() THEN RAISE EXCEPTION 'Choose a future date and time'; END IF;
  IF p_area IS NULL OR length(btrim(p_area)) = 0 OR length(p_area) > 100 THEN RAISE EXCEPTION 'Area is required'; END IF;
  IF p_urgency NOT IN ('normal','urgent') THEN RAISE EXCEPTION 'Invalid urgency'; END IF;

  SELECT * INTO tech FROM public.technicians WHERE id = p_technician_id;
  IF tech.id IS NULL OR NOT tech.active OR NOT tech.verified THEN
    RAISE EXCEPTION 'Technician not found or not available'; END IF;
  IF tech.test_types IS NOT NULL AND cardinality(tech.test_types) > 0 AND NOT (p_test_type = ANY(tech.test_types)) THEN
    RAISE EXCEPTION 'This technician does not perform that test'; END IF;

  v_end := p_start_time + make_interval(mins => cat.duration_min);

  SELECT * INTO a FROM public.provider_availability WHERE user_id = tech.user_id;
  IF a.user_id IS NULL OR NOT a.is_online
     OR (p_start_time AT TIME ZONE a.timezone)::date = ANY(a.blocked_dates) THEN
    RAISE EXCEPTION 'Technician is not available for booking'; END IF;
  FOR win IN SELECT * FROM jsonb_array_elements(
      COALESCE(a.working_hours->lower(to_char(p_start_time AT TIME ZONE a.timezone,'dy')), '[]')) LOOP
    IF (p_start_time AT TIME ZONE a.timezone)::time >= (win->>'start')::time
       AND (v_end AT TIME ZONE a.timezone)::time <= (win->>'end')::time THEN valid := true; END IF;
  END LOOP;
  IF NOT valid THEN RAISE EXCEPTION 'Requested slot is outside the technician''s working hours'; END IF;
  PERFORM private.hv_lock(tech.user_id);
  IF private.hv_busy(tech.user_id, p_start_time, v_end, NULL) THEN
    RAISE EXCEPTION 'That slot was just taken — pick another time'; END IF;
  SELECT full_name, phone INTO v_name, v_phone FROM public.profiles WHERE id = v_uid;
  v_fee := CASE WHEN p_urgency = 'urgent' THEN round(cat.fee * 1.2) ELSE cat.fee END;
  INSERT INTO public.technician_tests (patient_id, patient_name, patient_phone, test_type, test_label,
    technician_id, area, city, home_visit, scheduled_at, urgency, status, fee, notes)
  VALUES (v_uid, COALESCE(v_name,'Patient'), v_phone, cat.test_type, cat.label,
    tech.id, btrim(p_area), COALESCE(NULLIF(btrim(p_city),''),'Pune'), COALESCE(p_home_visit,true),
    p_start_time, p_urgency, 'assigned', v_fee, NULLIF(btrim(COALESCE(p_notes,'')),''))
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.create_nursing_engagement(integer, date, time, text, text, double precision, double precision, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_technician_request(text, timestamptz, text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_book_technician_test(uuid, text, timestamptz, text, text, text, text, text, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_nursing_engagement(integer, date, time, text, text, double precision, double precision, uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_technician_request(text, timestamptz, text, text, text, text, text, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.atomic_book_technician_test(uuid, text, timestamptz, text, text, text, text, text, boolean) FROM anon, public;

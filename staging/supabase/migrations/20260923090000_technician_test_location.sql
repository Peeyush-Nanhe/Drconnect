-- Home-visit address & coordinates captured at booking time, same as
-- nursing_engagements.address_snapshot/lat/lng. Lets the technician open
-- driving directions to the patient's actual pin instead of just an area name.
ALTER TABLE public.technician_tests
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

CREATE OR REPLACE FUNCTION public.create_technician_request(
  p_test_type text, p_scheduled_at timestamptz, p_area text, p_city text DEFAULT 'Pune',
  p_address text DEFAULT NULL, p_notes text DEFAULT NULL, p_urgency text DEFAULT 'normal',
  p_home_visit boolean DEFAULT true, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL
)
RETURNS technician_tests LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
    area, city, home_visit, scheduled_at, urgency, status, fee, notes, address, lat, lng)
  VALUES (v_uid, COALESCE(v_name,'Patient'), v_phone, v_cat.test_type, v_cat.label,
    btrim(p_area), COALESCE(NULLIF(btrim(p_city),''),'Pune'), COALESCE(p_home_visit, true), p_scheduled_at,
    p_urgency, 'requested', v_fee, NULLIF(btrim(COALESCE(p_notes,'')),''),
    NULLIF(btrim(COALESCE(p_address,'')),''), p_lat, p_lng)
  RETURNING * INTO v_row;
  RETURN v_row;
END $function$;

CREATE OR REPLACE FUNCTION public.atomic_book_technician_test(
  p_technician_id uuid, p_test_type text, p_start_time timestamptz, p_area text, p_city text DEFAULT 'Pune',
  p_address text DEFAULT NULL, p_notes text DEFAULT NULL, p_urgency text DEFAULT 'normal', p_home_visit boolean DEFAULT true,
  p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
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
    technician_id, area, city, home_visit, scheduled_at, urgency, status, fee, notes, address, lat, lng)
  VALUES (v_uid, COALESCE(v_name,'Patient'), v_phone, cat.test_type, cat.label,
    tech.id, btrim(p_area), COALESCE(NULLIF(btrim(p_city),''),'Pune'), COALESCE(p_home_visit,true),
    p_start_time, p_urgency, 'assigned', v_fee, NULLIF(btrim(COALESCE(p_notes,'')),''),
    NULLIF(btrim(COALESCE(p_address,'')),''), p_lat, p_lng)
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.create_technician_request(text, timestamptz, text, text, text, text, text, boolean, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_book_technician_test(uuid, text, timestamptz, text, text, text, text, text, boolean, double precision, double precision) TO authenticated;
REVOKE ALL ON FUNCTION public.create_technician_request(text, timestamptz, text, text, text, text, text, boolean, double precision, double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.atomic_book_technician_test(uuid, text, timestamptz, text, text, text, text, text, boolean, double precision, double precision) FROM PUBLIC, anon;

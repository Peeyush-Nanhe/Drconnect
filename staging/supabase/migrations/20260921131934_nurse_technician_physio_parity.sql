-- ============================================================================
-- MyDox — nurse and technician booking brought up to the physiotherapy standard.
--
-- Physiotherapy offers two ways to book:
--   * "Any available"  — an open request at a chosen date/time that providers
--                         can pick up;
--   * a named provider — the patient picks a real free slot from that
--                         provider's published hours and it is booked
--                         atomically (advisory lock + busy check).
--
-- Nursing already had the open request (create_nursing_engagement) and a
-- "preferred nurse" hint, but nothing stopped a patient naming a nurse who was
-- already booked on those days. Technicians had neither: no server-side booking
-- at all, no slot booking, and fees came from whatever number the client sent.
--
-- Also fixes slot discovery for every provider type:
--   * private.hv_busy treated ANY care_request a provider had ever accepted as
--     blocking every slot forever. The only physiotherapist on staging has 57
--     such rows, so she never had a single free slot.
--   * hv_busy did not know about nursing shifts or technician tests, so those
--     providers could be double-booked through slot booking.
--
-- Additive; all functions are CREATE OR REPLACE with unchanged signatures,
-- plus one catalog table and three new functions.
-- ============================================================================

-- ------------------------------------------------ technician test catalog ----
-- Fee and duration per test type, read by the patient picker and by the
-- booking functions. The server decides the price, not the client.
CREATE TABLE IF NOT EXISTS public.technician_test_catalog (
  test_type    text PRIMARY KEY CHECK (test_type ~ '^[a-z0-9_]{2,40}$'),
  label        text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 80),
  description  text,
  fee          integer NOT NULL CHECK (fee BETWEEN 0 AND 100000),
  duration_min integer NOT NULL DEFAULT 60 CHECK (duration_min BETWEEN 15 AND 240),
  home_visit   boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 100,
  active       boolean NOT NULL DEFAULT true
);

-- Same tests, labels and prices the patient app showed before.
INSERT INTO public.technician_test_catalog (test_type, label, description, fee, duration_min, sort_order) VALUES
  ('phlebotomy',       'Lab / Blood Draw',  'Home sample collection',    400,  30, 10),
  ('ecg',              'ECG Technician',    '12-lead ECG at home/hub',   600,  30, 20),
  ('eeg',              'EEG Technician',    'Brain activity recording', 2500,  90, 30),
  ('xray',             'Portable X-Ray',    'X-ray at home or hub',     1500,  45, 40),
  ('nerve_conduction', 'NCS / EMG Tech',    'Nerve conduction study',   2500,  60, 50),
  ('audiometry',       'Audiometry Tech',   'Hearing tests · PTA',      1200,  45, 60),
  ('ot_assist',        'OT Technician',     'Operation theatre assist', 1800, 120, 70)
ON CONFLICT (test_type) DO NOTHING;

ALTER TABLE public.technician_test_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "test catalog readable"    ON public.technician_test_catalog;
DROP POLICY IF EXISTS "test catalog admin write" ON public.technician_test_catalog;
CREATE POLICY "test catalog readable" ON public.technician_test_catalog FOR SELECT USING (true);
CREATE POLICY "test catalog admin write" ON public.technician_test_catalog
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role));
GRANT SELECT ON public.technician_test_catalog TO anon, authenticated;

-- ------------------------------------------------------- busy detection ----
CREATE OR REPLACE FUNCTION private.hv_busy(p_provider uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_exclude uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.doctor_appointments a WHERE a.provider_id=p_provider AND a.id IS DISTINCT FROM p_exclude
 AND a.status IN ('pending','confirmed','rescheduled') AND
 (a.mode<>'home_visit' OR a.status<>'pending' OR NOT EXISTS(SELECT 1 FROM public.home_visit_details d WHERE d.booking_id=a.id AND d.pending_deadline<=now()))
 AND tstzrange(a.start_time-make_interval(mins=>a.home_buffer_before_minutes),
 CASE WHEN a.mode='home_visit' AND a.home_visit_status IN ('en_route','arrived','in_consultation') THEN 'infinity'::timestamptz ELSE a.end_time+make_interval(mins=>a.home_buffer_after_minutes) END,'[)') && tstzrange(p_start,p_end,'[)'))
 OR EXISTS(SELECT 1 FROM public.home_visit_reschedule_holds h WHERE h.provider_id=p_provider AND h.booking_id IS DISTINCT FROM p_exclude AND expires_at>now() AND tstzrange(h.start_time-make_interval(mins=>h.buffer_before_minutes),h.end_time+make_interval(mins=>h.buffer_after_minutes),'[)') && tstzrange(p_start,p_end,'[)'))
 -- An on-demand dispatch occupies the provider from acceptance until it is
 -- completed, for at most four hours. Previously this clause had no time bound,
 -- so one abandoned acceptance blocked every future slot.
 OR EXISTS(SELECT 1 FROM public.care_requests r WHERE r.accepted_by=p_provider AND r.status='accepted'
           AND r.completed_at IS NULL
           AND tstzrange(COALESCE(r.accepted_at, r.updated_at), COALESCE(r.accepted_at, r.updated_at) + interval '4 hours','[)') && tstzrange(p_start,p_end,'[)'))
 OR EXISTS(SELECT 1 FROM public.staffing_assignments a JOIN public.staffing_jobs j ON j.id=a.job_id WHERE a.provider_id=p_provider AND a.status='accepted' AND j.status NOT IN ('cancelled','closed') AND (j.starts_at IS NULL OR j.ends_at IS NULL OR tstzrange(j.starts_at,j.ends_at,'[)') && tstzrange(p_start,p_end,'[)')))
 OR EXISTS(SELECT 1 FROM public.surgery_booking_roles r JOIN public.surgery_bookings b ON b.id=r.booking_id WHERE r.assigned_to=p_provider AND r.status='accepted' AND b.status NOT IN ('completed','cancelled'))
 OR EXISTS(SELECT 1 FROM public.physio_visits v JOIN public.physio_therapists t ON t.id=v.therapist_id WHERE t.user_id=p_provider AND v.status IN ('assigned','en_route','in_progress') AND (v.scheduled_at IS NULL OR tstzrange(v.scheduled_at,v.scheduled_at+make_interval(mins=>v.duration_min),'[)') && tstzrange(p_start,p_end,'[)')))
 -- Nursing shifts: a 12-hour shift from the engagement's start time (08:00 when
 -- none was chosen) on each visit day the nurse holds.
 OR EXISTS(SELECT 1 FROM public.nursing_visits v JOIN public.nursing_engagements e ON e.id=v.engagement_id
           WHERE v.assigned_nurse_id=p_provider AND e.status='active'
             AND v.status::text IN ('scheduled','seeking_cover','en_route','arrived')
             AND tstzrange((v.visit_date + COALESCE(e.slot_time,'08:00'::time)) AT TIME ZONE 'Asia/Kolkata',
                           (v.visit_date + COALESCE(e.slot_time,'08:00'::time)) AT TIME ZONE 'Asia/Kolkata' + interval '12 hours','[)')
                 && tstzrange(p_start,p_end,'[)'))
 -- Technician tests: the catalogued duration from the scheduled start.
 OR EXISTS(SELECT 1 FROM public.technician_tests t JOIN public.technicians tt ON tt.id=t.technician_id
           LEFT JOIN public.technician_test_catalog c ON c.test_type=t.test_type
           WHERE tt.user_id=p_provider AND t.id IS DISTINCT FROM p_exclude
             AND t.status IN ('assigned','accepted','en_route','in_progress')
             AND t.scheduled_at IS NOT NULL
             AND tstzrange(t.scheduled_at, t.scheduled_at + make_interval(mins=>COALESCE(c.duration_min,60)),'[)') && tstzrange(p_start,p_end,'[)'))
$function$;

-- ---------------------------------------- technician: open request ("any") ----
CREATE OR REPLACE FUNCTION public.create_technician_request(
  p_test_type text, p_scheduled_at timestamptz, p_area text,
  p_city text DEFAULT 'Pune', p_address text DEFAULT NULL,
  p_notes text DEFAULT NULL, p_urgency text DEFAULT 'normal', p_home_visit boolean DEFAULT true)
RETURNS public.technician_tests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_cat public.technician_test_catalog; v_name text; v_phone text; v_row public.technician_tests;
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

  INSERT INTO public.technician_tests (patient_id, patient_name, patient_phone, test_type, test_label,
    area, city, home_visit, scheduled_at, urgency, status, fee, notes)
  VALUES (v_uid, COALESCE(v_name,'Patient'), v_phone, v_cat.test_type, v_cat.label,
    btrim(p_area), COALESCE(NULLIF(btrim(p_city),''),'Pune'), COALESCE(p_home_visit, true), p_scheduled_at,
    p_urgency, 'requested', v_cat.fee, NULLIF(btrim(COALESCE(p_notes,'')),''))
  RETURNING * INTO v_row;
  RETURN v_row;
END $function$;

-- ------------------------------------ technician: named technician + slot ----
-- Mirrors atomic_book_physio_visit: working hours, blocked dates, lock, busy.
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
  v_end timestamptz; v_name text; v_phone text; v_id uuid;
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

  INSERT INTO public.technician_tests (patient_id, patient_name, patient_phone, test_type, test_label,
    technician_id, area, city, home_visit, scheduled_at, urgency, status, fee, notes)
  VALUES (v_uid, COALESCE(v_name,'Patient'), v_phone, cat.test_type, cat.label,
    tech.id, btrim(p_area), COALESCE(NULLIF(btrim(p_city),''),'Pune'), COALESCE(p_home_visit,true),
    p_start_time, p_urgency, 'assigned', cat.fee, NULLIF(btrim(COALESCE(p_notes,'')),''))
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

-- --------------------------------------------- nurse: days already taken ----
-- Lets the patient see, before choosing a nurse, which days she is not free.
CREATE OR REPLACE FUNCTION public.nurse_booked_dates(p_nurse_id uuid, p_from date, p_to date)
RETURNS SETOF date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT v.visit_date
    FROM public.nursing_visits v
    JOIN public.nursing_engagements e ON e.id = v.engagement_id
   WHERE v.assigned_nurse_id = p_nurse_id
     AND e.status = 'active'
     AND v.status::text IN ('scheduled','seeking_cover','en_route','arrived')
     AND v.visit_date BETWEEN p_from AND LEAST(p_to, p_from + 62)
   ORDER BY 1;
$function$;

-- --------------------------------- nurse: refuse a named nurse who is busy ----
CREATE OR REPLACE FUNCTION public.create_nursing_engagement(p_days integer, p_start_date date, p_slot_time time without time zone DEFAULT NULL::time without time zone, p_kind text DEFAULT 'General Duty Nurse'::text, p_address text DEFAULT NULL::text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_nurse_id uuid DEFAULT NULL::uuid)
RETURNS nursing_engagements
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

GRANT EXECUTE ON FUNCTION public.create_technician_request(text, timestamptz, text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_book_technician_test(uuid, text, timestamptz, text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nurse_booked_dates(uuid, date, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_technician_request(text, timestamptz, text, text, text, text, text, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.atomic_book_technician_test(uuid, text, timestamptz, text, text, text, text, text, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.nurse_booked_dates(uuid, date, date) FROM anon, public;

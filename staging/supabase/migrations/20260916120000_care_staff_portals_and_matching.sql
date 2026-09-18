
CREATE TABLE IF NOT EXISTS public.app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_notifications TO authenticated;
GRANT ALL ON public.app_notifications TO service_role;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own notifications" ON public.app_notifications;
CREATE POLICY "users read own notifications" ON public.app_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "users update own notifications" ON public.app_notifications;
CREATE POLICY "users update own notifications" ON public.app_notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- Ensure hospitals columns and ambulance_units table exist
ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

ALTER TABLE public.provider_directory
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.ambulance_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  name text NOT NULL DEFAULT 'Ambulance Unit',
  phone text,
  online boolean NOT NULL DEFAULT false,
  lat double precision,
  lng double precision,
  area text,
  city text NOT NULL DEFAULT 'Pune',
  last_location_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambulance_units TO authenticated;
GRANT ALL ON public.ambulance_units TO service_role;
ALTER TABLE public.ambulance_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ambulance_units readable by authenticated" ON public.ambulance_units;
CREATE POLICY "ambulance_units readable by authenticated" ON public.ambulance_units FOR SELECT TO authenticated USING (true);

-- Migration: 20260916120000_care_staff_portals_and_matching.sql
-- Unified Care Staff Portals (Nurse, Technician, Physiotherapist) & Matching Engine

-- ==================== 0000_nurse_technician_physio_portals.sql ====================
-- ============ NURSES ============
CREATE TABLE IF NOT EXISTS public.nurses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  full_name text NOT NULL,
  phone text,
  qualification text,
  registration_number text,
  years_experience integer NOT NULL DEFAULT 0,
  skills text[] NOT NULL DEFAULT '{}',
  specialty text,
  shift_prefs text[] NOT NULL DEFAULT '{}',
  home_care boolean NOT NULL DEFAULT true,
  hospital_duty boolean NOT NULL DEFAULT true,
  areas text[] NOT NULL DEFAULT '{}',
  city text NOT NULL DEFAULT 'Pune',
  preferred_facilities text[] NOT NULL DEFAULT '{}',
  bio text,
  languages text[] NOT NULL DEFAULT '{}',
  is_online boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nurses TO authenticated;
GRANT ALL ON public.nurses TO service_role;

ALTER TABLE public.nurses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nurses readable by authenticated" ON public.nurses;
CREATE POLICY "nurses readable by authenticated" ON public.nurses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "nurse creates own row" ON public.nurses;
CREATE POLICY "nurse creates own row" ON public.nurses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "nurse manages own row" ON public.nurses;
CREATE POLICY "nurse manages own row" ON public.nurses
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "nurses admin all" ON public.nurses;
CREATE POLICY "nurses admin all" ON public.nurses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP TRIGGER IF EXISTS nurses_set_updated_at ON public.nurses;
CREATE TRIGGER nurses_set_updated_at BEFORE UPDATE ON public.nurses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS nurses_city_idx ON public.nurses (city);
CREATE INDEX IF NOT EXISTS nurses_online_idx ON public.nurses (is_online) WHERE active;

-- ============ PHYSIOTHERAPIST PROFILE EXTENSIONS ============
ALTER TABLE public.physio_therapists
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_visits boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS clinic_visits boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_facilities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS areas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS "therapist manages own row" ON public.physio_therapists;
CREATE POLICY "therapist manages own row" ON public.physio_therapists
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- Ensure technicians and technician_tests exist before extensions
CREATE TABLE IF NOT EXISTS public.technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  full_name text NOT NULL,
  phone text,
  test_types text[] NOT NULL DEFAULT '{}',
  org text,
  qualification text,
  years_experience integer DEFAULT 0,
  areas text[] NOT NULL DEFAULT '{}',
  city text NOT NULL DEFAULT 'Pune',
  home_visits boolean NOT NULL DEFAULT true,
  clinic_visits boolean NOT NULL DEFAULT true,
  carries_machine boolean NOT NULL DEFAULT true,
  preferred_hubs text[] NOT NULL DEFAULT '{}',
  preferred_facilities text[] NOT NULL DEFAULT '{}',
  bio text,
  is_online boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  phone_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.technicians TO authenticated;
GRANT ALL ON public.technicians TO service_role;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.technician_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name text NOT NULL,
  patient_phone text,
  test_type text NOT NULL,
  test_label text,
  technician_id uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  area text,
  city text NOT NULL DEFAULT 'Pune',
  home_visit boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz,
  urgency text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'requested',
  checked_in_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  no_show boolean NOT NULL DEFAULT false,
  findings text,
  fee numeric,
  payment_status text NOT NULL DEFAULT 'unpaid',
  referring_doctor_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.technician_tests TO authenticated;
GRANT ALL ON public.technician_tests TO service_role;
ALTER TABLE public.technician_tests ENABLE ROW LEVEL SECURITY;

-- ============ TECHNICIAN PROFILE EXTENSIONS ============
ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_visits boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS clinic_visits boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS carries_machine boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_hubs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_facilities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS areas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "technician creates own row" ON public.technicians;
CREATE POLICY "technician creates own row" ON public.technicians
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- technicians may see unclaimed open test requests so they can pick them up
DROP POLICY IF EXISTS "tests technician read unassigned" ON public.technician_tests;
CREATE POLICY "tests technician read unassigned" ON public.technician_tests
  FOR SELECT TO authenticated
  USING (
    technician_id IS NULL
    AND status IN ('requested', 'pending')
    AND EXISTS (SELECT 1 FROM public.technicians t WHERE t.user_id = auth.uid() AND t.active)
  );

-- ============ CLAIM / STAGE HELPERS ============
CREATE OR REPLACE FUNCTION public.claim_technician_test(_test_id uuid)
RETURNS public.technician_tests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tech public.technicians;
  _row public.technician_tests;
BEGIN
  SELECT * INTO _tech FROM public.technicians WHERE user_id = auth.uid() AND active LIMIT 1;
  IF _tech IS NULL THEN
    RAISE EXCEPTION 'You are not registered as an active technician';
  END IF;

  UPDATE public.technician_tests
     SET technician_id = _tech.id,
         status = 'assigned',
         updated_at = now()
   WHERE id = _test_id
     AND technician_id IS NULL
     AND status IN ('requested', 'pending')
  RETURNING * INTO _row;

  IF _row IS NULL THEN
    RAISE EXCEPTION 'This test was already taken by another technician';
  END IF;

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_technician_test_stage(_test_id uuid, _stage text, _note text DEFAULT NULL)
RETURNS public.technician_tests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tech public.technicians;
  _row public.technician_tests;
BEGIN
  SELECT * INTO _tech FROM public.technicians WHERE user_id = auth.uid() LIMIT 1;
  IF _tech IS NULL THEN
    RAISE EXCEPTION 'You are not registered as a technician';
  END IF;

  IF _stage NOT IN ('accepted', 'en_route', 'in_progress', 'completed', 'cancelled', 'no_show') THEN
    RAISE EXCEPTION 'Unknown stage %', _stage;
  END IF;

  UPDATE public.technician_tests
     SET status = _stage,
         checked_in_at = CASE WHEN _stage = 'in_progress' THEN COALESCE(checked_in_at, now()) ELSE checked_in_at END,
         completed_at = CASE WHEN _stage = 'completed' THEN now() ELSE completed_at END,
         cancelled_at = CASE WHEN _stage = 'cancelled' THEN now() ELSE cancelled_at END,
         no_show = CASE WHEN _stage = 'no_show' THEN true ELSE no_show END,
         findings = CASE WHEN _note IS NOT NULL AND _note <> '' THEN _note ELSE findings END,
         updated_at = now()
   WHERE id = _test_id
     AND technician_id = _tech.id
  RETURNING * INTO _row;

  IF _row IS NULL THEN
    RAISE EXCEPTION 'This test is not assigned to you';
  END IF;

  RETURN _row;
END;
$$;

-- ==================== 0001_physio_recent_courses_special_interests.sql ====================
ALTER TABLE public.physio_therapists
  ADD COLUMN IF NOT EXISTS recent_courses text,
  ADD COLUMN IF NOT EXISTS special_interests text;

-- ==================== 0002_extend_nurse_technician_availability_profiles.sql ====================
-- Richer availability, travel and notification preferences for nurses and technicians
ALTER TABLE public.nurses
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS certifications text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS travel_radius_km integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS preferred_duty_hours integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS max_hours_per_day integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS minimum_pay integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_today boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS locum_available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS full_time_interest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS working_days text[] NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  ADD COLUMN IF NOT EXISTS dnd_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dnd_start text NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS dnd_end text NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS dnd_allow_emergency boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{"duties":true,"messages":true,"earnings":true,"reminders":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS recent_courses text,
  ADD COLUMN IF NOT EXISTS special_interests text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certifications text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS travel_radius_km integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS preferred_duty_hours integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS max_hours_per_day integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS minimum_pay integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_today boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS locum_available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS full_time_interest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS working_days text[] NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  ADD COLUMN IF NOT EXISTS dnd_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dnd_start text NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS dnd_end text NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS dnd_allow_emergency boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{"duties":true,"messages":true,"earnings":true,"reminders":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS recent_courses text,
  ADD COLUMN IF NOT EXISTS special_interests text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- ==================== 0003_unified_booking_matching_engine.sql ====================
-- ============================================================
-- Unified care booking + nearest-provider matching engine
-- ============================================================

CREATE TABLE IF NOT EXISTS public.unified_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  service_type text NOT NULL,
  provider_role text NOT NULL,
  service_code text,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal',
  visit_mode text NOT NULL DEFAULT 'home',
  status text NOT NULL DEFAULT 'requested',
  scheduled_for timestamptz,
  duration_minutes integer DEFAULT 60,
  estimated_earnings integer,
  address text,
  area text,
  city text DEFAULT 'Pune',
  lat double precision,
  lng double precision,
  preferred_facility_id uuid,
  assigned_provider_id uuid,
  assigned_facility_id uuid,
  current_radius_km numeric NOT NULL DEFAULT 4,
  notified_provider_count integer NOT NULL DEFAULT 0,
  last_expanded_at timestamptz,
  accepted_at timestamptz,
  en_route_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason text,
  rating_requested boolean NOT NULL DEFAULT false,
  care_request_id uuid,
  technician_test_id uuid,
  staffing_job_id uuid,
  physio_visit_id uuid,
  emergency_case_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.unified_bookings(id) ON DELETE CASCADE,
  provider_id uuid,
  facility_id uuid,
  provider_role text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  distance_km numeric,
  earnings integer,
  note text,
  offered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  responded_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.unified_bookings(id) ON DELETE CASCADE,
  status text NOT NULL,
  actor_id uuid,
  actor_role text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.unified_bookings(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  reviewee_id uuid,
  overall_rating integer NOT NULL,
  quality_rating integer,
  punctuality_rating integer,
  professionalism_rating integer,
  communication_rating integer,
  would_recommend boolean NOT NULL DEFAULT true,
  comment text,
  moderated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, reviewer_id)
);

CREATE TABLE IF NOT EXISTS public.provider_reliability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  booking_id uuid REFERENCES public.unified_bookings(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  score_delta integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.unified_bookings(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  provider_id uuid,
  category text NOT NULL DEFAULT 'service_quality',
  details text,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_matching_settings (
  id boolean PRIMARY KEY DEFAULT true,
  initial_radius_km numeric NOT NULL DEFAULT 4,
  expansion_interval_minutes integer NOT NULL DEFAULT 1,
  expansion_step_km numeric NOT NULL DEFAULT 1,
  max_radius_km numeric NOT NULL DEFAULT 11,
  offer_expiry_minutes integer NOT NULL DEFAULT 10,
  minimum_reliability_score integer NOT NULL DEFAULT 40,
  provider_cancellation_penalty integer NOT NULL DEFAULT -8,
  late_arrival_penalty integer NOT NULL DEFAULT -4,
  no_show_penalty integer NOT NULL DEFAULT -15,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_matching_settings_singleton CHECK (id)
);

CREATE INDEX IF NOT EXISTS unified_bookings_status_idx ON public.unified_bookings (status);
CREATE INDEX IF NOT EXISTS unified_bookings_patient_idx ON public.unified_bookings (patient_id);
CREATE INDEX IF NOT EXISTS unified_bookings_provider_idx ON public.unified_bookings (assigned_provider_id);
CREATE INDEX IF NOT EXISTS booking_offers_booking_idx ON public.booking_offers (booking_id);
CREATE INDEX IF NOT EXISTS booking_offers_provider_idx ON public.booking_offers (provider_id, status);
CREATE INDEX IF NOT EXISTS booking_offers_facility_idx ON public.booking_offers (facility_id, status);
CREATE INDEX IF NOT EXISTS booking_status_history_booking_idx ON public.booking_status_history (booking_id);
CREATE INDEX IF NOT EXISTS booking_reviews_reviewee_idx ON public.booking_reviews (reviewee_id);
CREATE INDEX IF NOT EXISTS provider_reliability_provider_idx ON public.provider_reliability_events (provider_id);

GRANT SELECT ON public.unified_bookings TO authenticated;
GRANT ALL ON public.unified_bookings TO service_role;
GRANT SELECT ON public.booking_offers TO authenticated;
GRANT ALL ON public.booking_offers TO service_role;
GRANT SELECT ON public.booking_status_history TO authenticated;
GRANT ALL ON public.booking_status_history TO service_role;
GRANT SELECT ON public.booking_reviews TO authenticated;
GRANT ALL ON public.booking_reviews TO service_role;
GRANT SELECT ON public.provider_reliability_events TO authenticated;
GRANT ALL ON public.provider_reliability_events TO service_role;
GRANT SELECT ON public.booking_issues TO authenticated;
GRANT ALL ON public.booking_issues TO service_role;
GRANT SELECT ON public.booking_matching_settings TO authenticated;
GRANT ALL ON public.booking_matching_settings TO service_role;

ALTER TABLE public.unified_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_reliability_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_matching_settings ENABLE ROW LEVEL SECURITY;

-- Helper: reliability score (80 baseline, clamped 0..100)
CREATE OR REPLACE FUNCTION public.provider_reliability_score(_provider_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(0, LEAST(100, 80 + COALESCE((SELECT SUM(score_delta) FROM public.provider_reliability_events WHERE provider_id = _provider_id), 0)))::integer;
$$;

-- Helper: current active workload for a provider
CREATE OR REPLACE FUNCTION public.provider_active_workload(_provider_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::integer FROM public.unified_bookings
  WHERE assigned_provider_id = _provider_id
    AND status IN ('accepted','en_route','arrived','started');
$$;

-- Helper: is the local clock inside a do-not-disturb window
CREATE OR REPLACE FUNCTION public.in_dnd_window(_start text, _end text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE now_min integer; s integer; e integer;
BEGIN
  IF _start IS NULL OR _end IS NULL THEN RETURN false; END IF;
  now_min := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Kolkata'))::int * 60 + EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Asia/Kolkata'))::int;
  s := split_part(_start, ':', 1)::int * 60 + COALESCE(NULLIF(split_part(_start, ':', 2), ''), '0')::int;
  e := split_part(_end, ':', 1)::int * 60 + COALESCE(NULLIF(split_part(_end, ':', 2), ''), '0')::int;
  IF s = e THEN RETURN false; END IF;
  IF s < e THEN RETURN now_min >= s AND now_min < e; END IF;
  RETURN now_min >= s OR now_min < e;
END;
$$;

-- Helper: can this user see a booking (participant, offered provider, facility owner, admin)
CREATE OR REPLACE FUNCTION public.can_view_unified_booking(_booking_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unified_bookings b
    WHERE b.id = _booking_id
      AND (
        b.patient_id = _user_id
        OR b.requested_by = _user_id
        OR b.assigned_provider_id = _user_id
        OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.owner_id = _user_id AND h.id IN (b.assigned_facility_id, b.preferred_facility_id))
        OR EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND (o.provider_id = _user_id OR o.facility_id IN (SELECT id FROM public.hospitals WHERE owner_id = _user_id)))
      )
  ) OR public.is_admin_user();
$$;

DROP POLICY IF EXISTS "Participants and admins read bookings" ON public.unified_bookings;
CREATE POLICY "Participants and admins read bookings" ON public.unified_bookings
  FOR SELECT TO authenticated USING (public.can_view_unified_booking(id, auth.uid()));

DROP POLICY IF EXISTS "Providers and patients read their offers" ON public.booking_offers;
CREATE POLICY "Providers and patients read their offers" ON public.booking_offers
  FOR SELECT TO authenticated USING (
    provider_id = auth.uid()
    OR facility_id IN (SELECT id FROM public.hospitals WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.unified_bookings b WHERE b.id = booking_id AND (b.patient_id = auth.uid() OR b.requested_by = auth.uid()))
    OR public.is_admin_user()
  );

DROP POLICY IF EXISTS "Participants read booking timeline" ON public.booking_status_history;
CREATE POLICY "Participants read booking timeline" ON public.booking_status_history
  FOR SELECT TO authenticated USING (public.can_view_unified_booking(booking_id, auth.uid()));

DROP POLICY IF EXISTS "Reviews readable by participants" ON public.booking_reviews;
CREATE POLICY "Reviews readable by participants" ON public.booking_reviews
  FOR SELECT TO authenticated USING (
    reviewer_id = auth.uid() OR reviewee_id = auth.uid() OR public.can_view_unified_booking(booking_id, auth.uid())
  );

DROP POLICY IF EXISTS "Providers read own reliability" ON public.provider_reliability_events;
CREATE POLICY "Providers read own reliability" ON public.provider_reliability_events
  FOR SELECT TO authenticated USING (provider_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "Reporters and admins read issues" ON public.booking_issues;
CREATE POLICY "Reporters and admins read issues" ON public.booking_issues
  FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "Signed in users read matching settings" ON public.booking_matching_settings;
CREATE POLICY "Signed in users read matching settings" ON public.booking_matching_settings
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_unified_booking_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS unified_bookings_updated_at ON public.unified_bookings;
CREATE TRIGGER unified_bookings_updated_at BEFORE UPDATE ON public.unified_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_unified_booking_updated_at();

-- ============================================================
-- Matching: offer a booking to every eligible nearby provider
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_unified_booking(_booking_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.unified_bookings;
  s public.booking_matching_settings;
  expiry timestamptz;
  created integer := 0;
  pending integer := 0;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = _booking_id FOR UPDATE;
  IF b.id IS NULL OR b.assigned_provider_id IS NOT NULL OR b.assigned_facility_id IS NOT NULL
     OR b.status NOT IN ('requested','searching','expanded','offered','unavailable') THEN
    RETURN 0;
  END IF;
  SELECT * INTO s FROM public.booking_matching_settings WHERE id;
  expiry := now() + make_interval(mins => COALESCE(s.offer_expiry_minutes, 10));

  UPDATE public.booking_offers SET status = 'expired', responded_at = now()
  WHERE booking_id = b.id AND status = 'pending' AND expires_at < now();

  IF b.provider_role = 'hospital' THEN
    INSERT INTO public.booking_offers (booking_id, facility_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, h.id, 'hospital', 'pending',
           CASE WHEN b.lat IS NOT NULL AND h.lat IS NOT NULL THEN public.haversine_km(b.lat, b.lng, h.lat, h.lng) END,
           b.estimated_earnings, expiry
    FROM public.hospitals h
    WHERE h.approval_status = 'approved'
      AND (b.preferred_facility_id IS NULL OR h.id = b.preferred_facility_id)
      AND (b.lat IS NULL OR h.lat IS NULL OR public.haversine_km(b.lat, b.lng, h.lat, h.lng) <= b.current_radius_km)
      AND (b.city IS NULL OR h.city IS NULL OR lower(h.city) = lower(b.city))
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.facility_id = h.id AND o.status IN ('pending','accepted','declined'));

  ELSIF b.provider_role = 'nurse' THEN
    INSERT INTO public.booking_offers (booking_id, provider_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, n.user_id, 'nurse', 'pending',
           CASE WHEN b.lat IS NOT NULL AND COALESCE(n.lat, p.lat) IS NOT NULL THEN public.haversine_km(b.lat, b.lng, COALESCE(n.lat, p.lat), COALESCE(n.lng, p.lng)) END,
           b.estimated_earnings, expiry
    FROM public.nurses n
    LEFT JOIN public.profiles p ON p.id = n.user_id
    WHERE n.user_id IS NOT NULL AND n.active AND n.is_online AND n.verified AND n.available_today
      AND (b.visit_mode <> 'home' OR n.home_care)
      AND (b.visit_mode NOT IN ('facility','locum') OR n.hospital_duty OR n.locum_available)
      AND (b.service_code IS NULL OR b.service_code = '' OR b.service_code = ANY(n.skills) OR lower(COALESCE(n.specialty,'')) = lower(b.service_code))
      AND (b.estimated_earnings IS NULL OR n.minimum_pay = 0 OR b.estimated_earnings >= n.minimum_pay)
      AND (NOT n.dnd_enabled OR (b.priority = 'emergency' AND n.dnd_allow_emergency) OR NOT public.in_dnd_window(n.dnd_start, n.dnd_end))
      AND public.provider_reliability_score(n.user_id) >= COALESCE(s.minimum_reliability_score, 0)
      AND public.provider_active_workload(n.user_id) < 3
      AND (
        (b.lat IS NOT NULL AND COALESCE(n.lat, p.lat) IS NOT NULL
          AND public.haversine_km(b.lat, b.lng, COALESCE(n.lat, p.lat), COALESCE(n.lng, p.lng)) <= LEAST(b.current_radius_km, n.travel_radius_km))
        OR (b.area IS NOT NULL AND b.area = ANY(n.areas))
        OR (COALESCE(n.lat, p.lat) IS NULL AND (b.city IS NULL OR lower(COALESCE(n.city,'')) = lower(b.city)))
      )
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.provider_id = n.user_id AND o.status IN ('pending','accepted','declined'));

  ELSIF b.provider_role = 'technician' THEN
    INSERT INTO public.booking_offers (booking_id, provider_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, t.user_id, 'technician', 'pending',
           CASE WHEN b.lat IS NOT NULL AND COALESCE(t.lat, p.lat) IS NOT NULL THEN public.haversine_km(b.lat, b.lng, COALESCE(t.lat, p.lat), COALESCE(t.lng, p.lng)) END,
           b.estimated_earnings, expiry
    FROM public.technicians t
    LEFT JOIN public.profiles p ON p.id = t.user_id
    WHERE t.user_id IS NOT NULL AND t.active AND t.is_online AND t.available_today
      AND (b.visit_mode <> 'home' OR t.home_visits)
      AND (b.visit_mode <> 'facility' OR t.clinic_visits)
      AND (b.service_code IS NULL OR b.service_code = '' OR b.service_code = ANY(t.test_types))
      AND (b.estimated_earnings IS NULL OR t.minimum_pay = 0 OR b.estimated_earnings >= t.minimum_pay)
      AND (NOT t.dnd_enabled OR (b.priority = 'emergency' AND t.dnd_allow_emergency) OR NOT public.in_dnd_window(t.dnd_start, t.dnd_end))
      AND public.provider_reliability_score(t.user_id) >= COALESCE(s.minimum_reliability_score, 0)
      AND public.provider_active_workload(t.user_id) < 3
      AND (
        (b.lat IS NOT NULL AND COALESCE(t.lat, p.lat) IS NOT NULL
          AND public.haversine_km(b.lat, b.lng, COALESCE(t.lat, p.lat), COALESCE(t.lng, p.lng)) <= LEAST(b.current_radius_km, t.travel_radius_km))
        OR (b.area IS NOT NULL AND b.area = ANY(t.areas))
        OR (COALESCE(t.lat, p.lat) IS NULL AND (b.city IS NULL OR lower(COALESCE(t.city,'')) = lower(b.city)))
      )
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.provider_id = t.user_id AND o.status IN ('pending','accepted','declined'));

  ELSE
    INSERT INTO public.booking_offers (booking_id, provider_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, d.id, 'care_physician', 'pending',
           CASE WHEN b.lat IS NOT NULL AND p.lat IS NOT NULL THEN public.haversine_km(b.lat, b.lng, p.lat, p.lng) END,
           b.estimated_earnings, expiry
    FROM public.provider_directory d
    LEFT JOIN public.profiles p ON p.id = d.id
    WHERE d.verified
      AND (b.service_code IS NULL OR b.service_code = '' OR lower(COALESCE(d.specialty,'')) = lower(b.service_code))
      AND public.provider_reliability_score(d.id) >= COALESCE(s.minimum_reliability_score, 0)
      AND public.provider_active_workload(d.id) < 3
      AND (
        (b.lat IS NOT NULL AND p.lat IS NOT NULL AND public.haversine_km(b.lat, b.lng, p.lat, p.lng) <= b.current_radius_km)
        OR (b.area IS NOT NULL AND d.area IS NOT NULL AND lower(d.area) = lower(b.area))
        OR (p.lat IS NULL AND (b.city IS NULL OR d.city IS NULL OR lower(d.city) = lower(b.city)))
      )
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.provider_id = d.id AND o.status IN ('pending','accepted','declined'));
  END IF;

  created := ROW_COUNT_HELPER();
  RETURN created;
END;
$$;

-- ROW_COUNT_HELPER() is not a real function; replace body with a version using GET DIAGNOSTICS
CREATE OR REPLACE FUNCTION public.finalise_unified_booking_match(_booking_id uuid, _new_offers integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.unified_bookings; pending integer;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = _booking_id;
  SELECT COUNT(*) INTO pending FROM public.booking_offers WHERE booking_id = _booking_id AND status = 'pending' AND expires_at > now();

  INSERT INTO public.app_notifications (user_id, kind, title, body, metadata)
  SELECT COALESCE(o.provider_id, h.owner_id), 'booking_offer',
         CASE WHEN b.priority = 'emergency' THEN 'Emergency care request nearby' ELSE 'New care request nearby' END,
         b.title || ' · ' || COALESCE(b.area, b.city, 'nearby') || COALESCE(' · ' || ROUND(o.distance_km, 1)::text || ' km', ''),
         jsonb_build_object('bookingId', b.id, 'offerId', o.id, 'priority', b.priority, 'role', b.provider_role)
  FROM public.booking_offers o
  LEFT JOIN public.hospitals h ON h.id = o.facility_id
  WHERE o.booking_id = _booking_id AND o.status = 'pending' AND o.responded_at IS NULL
    AND COALESCE(o.provider_id, h.owner_id) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.app_notifications n
      WHERE n.user_id = COALESCE(o.provider_id, h.owner_id) AND n.kind = 'booking_offer' AND n.metadata->>'offerId' = o.id::text
    );

  UPDATE public.unified_bookings
  SET notified_provider_count = GREATEST(notified_provider_count, pending),
      status = CASE WHEN pending > 0 THEN 'offered' WHEN status = 'unavailable' THEN 'searching' ELSE status END
  WHERE id = _booking_id;

  IF pending > 0 THEN
    INSERT INTO public.booking_status_history (booking_id, status, note)
    VALUES (_booking_id, 'offered', pending::text || ' professional(s) notified within ' || b.current_radius_km::text || ' km');
  END IF;
  RETURN pending;
END;
$$;

-- ==================== 0004_unified_booking_lifecycle_functions.sql ====================
-- lovable-cron-fallback-reviewed: 1440 runs/day; radius expansion is time-based (+1 km every minute up to 11 km) and must continue for waiting patients even with no app open
CREATE OR REPLACE FUNCTION public.match_unified_booking(_booking_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.unified_bookings;
  s public.booking_matching_settings;
  expiry timestamptz;
  created integer := 0;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = _booking_id FOR UPDATE;
  IF b.id IS NULL OR b.assigned_provider_id IS NOT NULL OR b.assigned_facility_id IS NOT NULL
     OR b.status NOT IN ('requested','searching','expanded','offered','unavailable') THEN
    RETURN 0;
  END IF;
  SELECT * INTO s FROM public.booking_matching_settings WHERE id;
  expiry := now() + make_interval(mins => COALESCE(s.offer_expiry_minutes, 10));

  UPDATE public.booking_offers SET status = 'expired', responded_at = now()
  WHERE booking_id = b.id AND status = 'pending' AND expires_at < now();

  IF b.provider_role = 'hospital' THEN
    INSERT INTO public.booking_offers (booking_id, facility_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, h.id, 'hospital', 'pending',
           CASE WHEN b.lat IS NOT NULL AND h.lat IS NOT NULL THEN public.haversine_km(b.lat, b.lng, h.lat, h.lng) END,
           b.estimated_earnings, expiry
    FROM public.hospitals h
    WHERE h.approval_status = 'approved'
      AND (b.preferred_facility_id IS NULL OR h.id = b.preferred_facility_id)
      AND (b.lat IS NULL OR h.lat IS NULL OR public.haversine_km(b.lat, b.lng, h.lat, h.lng) <= b.current_radius_km)
      AND (b.city IS NULL OR h.city IS NULL OR lower(h.city) = lower(b.city))
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.facility_id = h.id AND o.status IN ('pending','accepted','declined'));

  ELSIF b.provider_role = 'nurse' THEN
    INSERT INTO public.booking_offers (booking_id, provider_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, n.user_id, 'nurse', 'pending',
           CASE WHEN b.lat IS NOT NULL AND COALESCE(n.lat, p.lat) IS NOT NULL THEN public.haversine_km(b.lat, b.lng, COALESCE(n.lat, p.lat), COALESCE(n.lng, p.lng)) END,
           b.estimated_earnings, expiry
    FROM public.nurses n
    LEFT JOIN public.profiles p ON p.id = n.user_id
    WHERE n.user_id IS NOT NULL AND n.active AND n.is_online AND n.verified AND n.available_today
      AND (b.visit_mode <> 'home' OR n.home_care)
      AND (b.visit_mode NOT IN ('facility','locum') OR n.hospital_duty OR n.locum_available)
      AND (b.service_code IS NULL OR b.service_code = '' OR b.service_code = ANY(n.skills) OR lower(COALESCE(n.specialty,'')) = lower(b.service_code))
      AND (b.estimated_earnings IS NULL OR n.minimum_pay = 0 OR b.estimated_earnings >= n.minimum_pay)
      AND (NOT n.dnd_enabled OR (b.priority = 'emergency' AND n.dnd_allow_emergency) OR NOT public.in_dnd_window(n.dnd_start, n.dnd_end))
      AND public.provider_reliability_score(n.user_id) >= COALESCE(s.minimum_reliability_score, 0)
      AND public.provider_active_workload(n.user_id) < 3
      AND (
        (b.lat IS NOT NULL AND COALESCE(n.lat, p.lat) IS NOT NULL
          AND public.haversine_km(b.lat, b.lng, COALESCE(n.lat, p.lat), COALESCE(n.lng, p.lng)) <= LEAST(b.current_radius_km, n.travel_radius_km))
        OR (b.area IS NOT NULL AND b.area = ANY(n.areas))
        OR (COALESCE(n.lat, p.lat) IS NULL AND (b.city IS NULL OR lower(COALESCE(n.city,'')) = lower(b.city)))
      )
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.provider_id = n.user_id AND o.status IN ('pending','accepted','declined'));

  ELSIF b.provider_role = 'technician' THEN
    INSERT INTO public.booking_offers (booking_id, provider_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, t.user_id, 'technician', 'pending',
           CASE WHEN b.lat IS NOT NULL AND COALESCE(t.lat, p.lat) IS NOT NULL THEN public.haversine_km(b.lat, b.lng, COALESCE(t.lat, p.lat), COALESCE(t.lng, p.lng)) END,
           b.estimated_earnings, expiry
    FROM public.technicians t
    LEFT JOIN public.profiles p ON p.id = t.user_id
    WHERE t.user_id IS NOT NULL AND t.active AND t.is_online AND t.available_today
      AND (b.visit_mode <> 'home' OR t.home_visits)
      AND (b.visit_mode <> 'facility' OR t.clinic_visits)
      AND (b.service_code IS NULL OR b.service_code = '' OR b.service_code = ANY(t.test_types))
      AND (b.estimated_earnings IS NULL OR t.minimum_pay = 0 OR b.estimated_earnings >= t.minimum_pay)
      AND (NOT t.dnd_enabled OR (b.priority = 'emergency' AND t.dnd_allow_emergency) OR NOT public.in_dnd_window(t.dnd_start, t.dnd_end))
      AND public.provider_reliability_score(t.user_id) >= COALESCE(s.minimum_reliability_score, 0)
      AND public.provider_active_workload(t.user_id) < 3
      AND (
        (b.lat IS NOT NULL AND COALESCE(t.lat, p.lat) IS NOT NULL
          AND public.haversine_km(b.lat, b.lng, COALESCE(t.lat, p.lat), COALESCE(t.lng, p.lng)) <= LEAST(b.current_radius_km, t.travel_radius_km))
        OR (b.area IS NOT NULL AND b.area = ANY(t.areas))
        OR (COALESCE(t.lat, p.lat) IS NULL AND (b.city IS NULL OR lower(COALESCE(t.city,'')) = lower(b.city)))
      )
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.provider_id = t.user_id AND o.status IN ('pending','accepted','declined'));

  ELSE
    INSERT INTO public.booking_offers (booking_id, provider_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, d.id, 'care_physician', 'pending',
           CASE WHEN b.lat IS NOT NULL AND p.lat IS NOT NULL THEN public.haversine_km(b.lat, b.lng, p.lat, p.lng) END,
           b.estimated_earnings, expiry
    FROM public.provider_directory d
    LEFT JOIN public.profiles p ON p.id = d.id
    WHERE d.verified
      AND (b.service_code IS NULL OR b.service_code = '' OR lower(COALESCE(d.specialty,'')) = lower(b.service_code))
      AND public.provider_reliability_score(d.id) >= COALESCE(s.minimum_reliability_score, 0)
      AND public.provider_active_workload(d.id) < 3
      AND (
        (b.lat IS NOT NULL AND p.lat IS NOT NULL AND public.haversine_km(b.lat, b.lng, p.lat, p.lng) <= b.current_radius_km)
        OR (b.area IS NOT NULL AND d.area IS NOT NULL AND lower(d.area) = lower(b.area))
        OR (p.lat IS NULL AND (b.city IS NULL OR d.city IS NULL OR lower(d.city) = lower(b.city)))
      )
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.provider_id = d.id AND o.status IN ('pending','accepted','declined'));
  END IF;

  GET DIAGNOSTICS created = ROW_COUNT;
  PERFORM public.finalise_unified_booking_match(_booking_id, created);
  RETURN created;
END;
$$;

CREATE OR REPLACE FUNCTION public.server_create_unified_booking(
  _actor_id uuid, _service_type text, _provider_role text, _service_code text, _title text,
  _description text, _priority text, _visit_mode text, _scheduled_for timestamptz,
  _duration_minutes integer, _estimated_earnings integer, _address text, _area text, _city text,
  _lat double precision, _lng double precision, _preferred_facility_id uuid, _metadata jsonb
) RETURNS public.unified_bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.unified_bookings; s public.booking_matching_settings;
BEGIN
  SELECT * INTO s FROM public.booking_matching_settings WHERE id;
  INSERT INTO public.unified_bookings (
    patient_id, requested_by, service_type, provider_role, service_code, title, description,
    priority, visit_mode, status, scheduled_for, duration_minutes, estimated_earnings,
    address, area, city, lat, lng, preferred_facility_id, current_radius_km, metadata
  ) VALUES (
    _actor_id, _actor_id, _service_type, _provider_role, NULLIF(_service_code, ''), _title, _description,
    COALESCE(_priority,'normal'), COALESCE(_visit_mode,'home'), 'searching', _scheduled_for,
    COALESCE(_duration_minutes, 60), _estimated_earnings, NULLIF(_address,''), NULLIF(_area,''),
    COALESCE(NULLIF(_city,''), 'Pune'), _lat, _lng, _preferred_facility_id,
    COALESCE(s.initial_radius_km, 4), COALESCE(_metadata, '{}'::jsonb)
  ) RETURNING * INTO b;

  INSERT INTO public.booking_status_history (booking_id, status, actor_id, actor_role, note)
  VALUES (b.id, 'requested', _actor_id, 'patient', 'Care request created');

  INSERT INTO public.app_notifications (user_id, kind, title, body, metadata)
  VALUES (_actor_id, 'booking_update', 'Searching for a professional',
          'We are contacting verified professionals within ' || COALESCE(s.initial_radius_km, 4)::text || ' km.',
          jsonb_build_object('bookingId', b.id, 'priority', b.priority));

  PERFORM public.match_unified_booking(b.id);
  SELECT * INTO b FROM public.unified_bookings WHERE id = b.id;
  RETURN b;
END;
$$;

CREATE OR REPLACE FUNCTION public.server_accept_unified_booking_offer(_actor_id uuid, _offer_id uuid)
RETURNS public.unified_bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.booking_offers; b public.unified_bookings; owns_facility boolean := false;
BEGIN
  SELECT * INTO o FROM public.booking_offers WHERE id = _offer_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Offer not found'; END IF;

  IF o.facility_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.hospitals WHERE id = o.facility_id AND owner_id = _actor_id) INTO owns_facility;
  END IF;
  IF o.provider_id IS DISTINCT FROM _actor_id AND NOT owns_facility THEN
    RAISE EXCEPTION 'This offer belongs to another professional';
  END IF;

  SELECT * INTO b FROM public.unified_bookings WHERE id = o.booking_id FOR UPDATE;
  IF b.assigned_provider_id IS NOT NULL OR b.assigned_facility_id IS NOT NULL THEN
    RAISE EXCEPTION 'This request has just been accepted by someone else';
  END IF;
  IF b.status NOT IN ('requested','searching','expanded','offered','unavailable') THEN
    RAISE EXCEPTION 'This request is no longer open';
  END IF;
  IF o.status <> 'pending' OR o.expires_at < now() THEN
    RAISE EXCEPTION 'This offer is no longer available';
  END IF;

  UPDATE public.booking_offers SET status = 'accepted', responded_at = now() WHERE id = o.id;
  UPDATE public.booking_offers SET status = 'withdrawn', responded_at = now()
  WHERE booking_id = b.id AND id <> o.id AND status = 'pending';

  UPDATE public.unified_bookings
  SET status = 'accepted', accepted_at = now(),
      assigned_provider_id = o.provider_id,
      assigned_facility_id = o.facility_id
  WHERE id = b.id RETURNING * INTO b;

  INSERT INTO public.booking_status_history (booking_id, status, actor_id, actor_role, note)
  VALUES (b.id, 'accepted', _actor_id, o.provider_role, 'Offer accepted');

  INSERT INTO public.app_notifications (user_id, kind, title, body, metadata)
  VALUES (b.patient_id, 'booking_update', 'A professional accepted your request',
          b.title || ' is confirmed. You can see their details and contact them now.',
          jsonb_build_object('bookingId', b.id, 'priority', b.priority));

  IF o.provider_id IS NOT NULL THEN
    INSERT INTO public.app_notifications (user_id, kind, title, body, metadata)
    VALUES (o.provider_id, 'booking_update', 'Assignment confirmed',
            b.title || ' · ' || COALESCE(b.area, b.city, 'Pune'),
            jsonb_build_object('bookingId', b.id, 'priority', b.priority));
  END IF;
  RETURN b;
END;
$$;

CREATE OR REPLACE FUNCTION public.server_decline_unified_booking_offer(_actor_id uuid, _offer_id uuid, _note text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.booking_offers; owns_facility boolean := false;
BEGIN
  SELECT * INTO o FROM public.booking_offers WHERE id = _offer_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF o.facility_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.hospitals WHERE id = o.facility_id AND owner_id = _actor_id) INTO owns_facility;
  END IF;
  IF o.provider_id IS DISTINCT FROM _actor_id AND NOT owns_facility THEN
    RAISE EXCEPTION 'This offer belongs to another professional';
  END IF;
  UPDATE public.booking_offers SET status = 'declined', responded_at = now(), note = _note
  WHERE id = o.id AND status = 'pending';
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.server_transition_unified_booking(_actor_id uuid, _booking_id uuid, _status text, _note text DEFAULT NULL)
RETURNS public.unified_bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.unified_bookings; s public.booking_matching_settings; allowed boolean;
BEGIN
  SELECT * INTO s FROM public.booking_matching_settings WHERE id;
  SELECT * INTO b FROM public.unified_bookings WHERE id = _booking_id FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;

  allowed := b.assigned_provider_id = _actor_id
    OR EXISTS (SELECT 1 FROM public.hospitals WHERE id = b.assigned_facility_id AND owner_id = _actor_id)
    OR public.has_role(_actor_id, 'admin') OR public.has_role(_actor_id, 'super_admin');
  IF NOT allowed THEN RAISE EXCEPTION 'Only the assigned professional can update this job'; END IF;

  IF _status NOT IN ('en_route','arrived','started','completed','disputed') THEN
    RAISE EXCEPTION 'Invalid status change';
  END IF;

  UPDATE public.unified_bookings SET
    status = _status,
    en_route_at = CASE WHEN _status = 'en_route' THEN now() ELSE en_route_at END,
    arrived_at = CASE WHEN _status = 'arrived' THEN now() ELSE arrived_at END,
    started_at = CASE WHEN _status = 'started' THEN now() ELSE started_at END,
    completed_at = CASE WHEN _status = 'completed' THEN now() ELSE completed_at END,
    rating_requested = CASE WHEN _status = 'completed' THEN true ELSE rating_requested END
  WHERE id = b.id RETURNING * INTO b;

  INSERT INTO public.booking_status_history (booking_id, status, actor_id, actor_role, note)
  VALUES (b.id, _status, _actor_id, b.provider_role, _note);

  INSERT INTO public.app_notifications (user_id, kind, title, body, metadata)
  VALUES (b.patient_id, 'booking_update',
          CASE _status WHEN 'en_route' THEN 'Your professional is on the way'
                       WHEN 'arrived' THEN 'Your professional has arrived'
                       WHEN 'started' THEN 'Service started'
                       WHEN 'completed' THEN 'Service completed — please rate it'
                       ELSE 'Booking under review' END,
          b.title, jsonb_build_object('bookingId', b.id, 'priority', b.priority));

  IF _status = 'arrived' AND b.scheduled_for IS NOT NULL AND now() > b.scheduled_for + interval '15 minutes' AND b.assigned_provider_id IS NOT NULL THEN
    INSERT INTO public.provider_reliability_events (provider_id, booking_id, event_type, score_delta, note)
    VALUES (b.assigned_provider_id, b.id, 'late_arrival', COALESCE(s.late_arrival_penalty, -4), 'Arrived after the scheduled time');
  END IF;

  IF _status = 'completed' AND b.assigned_provider_id IS NOT NULL THEN
    INSERT INTO public.provider_reliability_events (provider_id, booking_id, event_type, score_delta, note)
    VALUES (b.assigned_provider_id, b.id, 'completed_service', 2, 'Service completed');
  END IF;
  RETURN b;
END;
$$;

CREATE OR REPLACE FUNCTION public.server_cancel_unified_booking(_actor_id uuid, _booking_id uuid, _reason text)
RETURNS public.unified_bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.unified_bookings; s public.booking_matching_settings; is_provider boolean; is_patient boolean; is_admin boolean;
BEGIN
  SELECT * INTO s FROM public.booking_matching_settings WHERE id;
  SELECT * INTO b FROM public.unified_bookings WHERE id = _booking_id FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;

  is_patient := b.patient_id = _actor_id OR b.requested_by = _actor_id;
  is_provider := b.assigned_provider_id = _actor_id
    OR EXISTS (SELECT 1 FROM public.hospitals WHERE id = b.assigned_facility_id AND owner_id = _actor_id);
  is_admin := public.has_role(_actor_id, 'admin') OR public.has_role(_actor_id, 'super_admin');
  IF NOT (is_patient OR is_provider OR is_admin) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF b.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'This booking is already closed'; END IF;

  IF is_provider AND NOT is_patient THEN
    INSERT INTO public.provider_reliability_events (provider_id, booking_id, event_type, score_delta, note)
    VALUES (COALESCE(b.assigned_provider_id, _actor_id), b.id, 'provider_cancellation', COALESCE(s.provider_cancellation_penalty, -8), _reason);

    UPDATE public.booking_offers SET status = 'withdrawn', responded_at = now()
    WHERE booking_id = b.id AND status IN ('pending','accepted');

    UPDATE public.unified_bookings
    SET status = 'searching', assigned_provider_id = NULL, assigned_facility_id = NULL,
        accepted_at = NULL, en_route_at = NULL, arrived_at = NULL, started_at = NULL,
        current_radius_km = COALESCE(s.initial_radius_km, 4), last_expanded_at = NULL,
        cancellation_reason = _reason
    WHERE id = b.id RETURNING * INTO b;

    INSERT INTO public.booking_status_history (booking_id, status, actor_id, actor_role, note)
    VALUES (b.id, 'searching', _actor_id, 'provider', 'Professional cancelled — searching again: ' || _reason);

    INSERT INTO public.app_notifications (user_id, kind, title, body, metadata)
    VALUES (b.patient_id, 'booking_update', 'Finding you another professional',
            'The assigned professional cancelled. We are contacting others nearby right away.',
            jsonb_build_object('bookingId', b.id, 'priority', b.priority));

    PERFORM public.match_unified_booking(b.id);
    SELECT * INTO b FROM public.unified_bookings WHERE id = b.id;
    RETURN b;
  END IF;

  UPDATE public.booking_offers SET status = 'withdrawn', responded_at = now()
  WHERE booking_id = b.id AND status IN ('pending','accepted');

  UPDATE public.unified_bookings
  SET status = 'cancelled', cancelled_at = now(), cancelled_by = _actor_id, cancellation_reason = _reason
  WHERE id = b.id RETURNING * INTO b;

  INSERT INTO public.booking_status_history (booking_id, status, actor_id, actor_role, note)
  VALUES (b.id, 'cancelled', _actor_id, CASE WHEN is_patient THEN 'patient' ELSE 'admin' END, _reason);

  IF b.assigned_provider_id IS NOT NULL THEN
    INSERT INTO public.app_notifications (user_id, kind, title, body, metadata)
    VALUES (b.assigned_provider_id, 'booking_update', 'Booking cancelled', b.title || ' was cancelled: ' || _reason,
            jsonb_build_object('bookingId', b.id, 'priority', b.priority));
  END IF;
  RETURN b;
END;
$$;

CREATE OR REPLACE FUNCTION public.server_retry_unified_booking(_actor_id uuid, _booking_id uuid)
RETURNS public.unified_bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.unified_bookings; s public.booking_matching_settings;
BEGIN
  SELECT * INTO s FROM public.booking_matching_settings WHERE id;
  SELECT * INTO b FROM public.unified_bookings WHERE id = _booking_id FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF NOT (b.patient_id = _actor_id OR b.requested_by = _actor_id OR public.has_role(_actor_id,'admin') OR public.has_role(_actor_id,'super_admin')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF b.assigned_provider_id IS NOT NULL OR b.assigned_facility_id IS NOT NULL THEN
    RAISE EXCEPTION 'This booking already has a professional';
  END IF;

  UPDATE public.unified_bookings
  SET status = 'searching', current_radius_km = COALESCE(s.initial_radius_km, 4), last_expanded_at = NULL
  WHERE id = b.id RETURNING * INTO b;

  INSERT INTO public.booking_status_history (booking_id, status, actor_id, actor_role, note)
  VALUES (b.id, 'searching', _actor_id, 'patient', 'Search restarted');

  PERFORM public.match_unified_booking(b.id);
  SELECT * INTO b FROM public.unified_bookings WHERE id = b.id;
  RETURN b;
END;
$$;

CREATE OR REPLACE FUNCTION public.server_submit_unified_booking_review(
  _actor_id uuid, _booking_id uuid, _overall integer, _quality integer, _punctuality integer,
  _professionalism integer, _communication integer, _would_recommend boolean, _comment text, _report_issue boolean
) RETURNS public.booking_reviews LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.unified_bookings; r public.booking_reviews; delta integer;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = _booking_id;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF b.patient_id <> _actor_id AND b.requested_by <> _actor_id THEN RAISE EXCEPTION 'Only the patient can rate this service'; END IF;
  IF b.status <> 'completed' THEN RAISE EXCEPTION 'You can rate the service after it is completed'; END IF;
  IF EXISTS (SELECT 1 FROM public.booking_reviews WHERE booking_id = b.id AND reviewer_id = _actor_id) THEN
    RAISE EXCEPTION 'You have already rated this service';
  END IF;

  INSERT INTO public.booking_reviews (booking_id, reviewer_id, reviewee_id, overall_rating, quality_rating,
    punctuality_rating, professionalism_rating, communication_rating, would_recommend, comment)
  VALUES (b.id, _actor_id, COALESCE(b.assigned_provider_id, b.assigned_facility_id), _overall, _quality,
    _punctuality, _professionalism, _communication, COALESCE(_would_recommend, true), NULLIF(_comment, ''))
  RETURNING * INTO r;

  UPDATE public.unified_bookings SET rating_requested = false WHERE id = b.id;

  IF b.assigned_provider_id IS NOT NULL THEN
    delta := CASE WHEN _overall >= 4 THEN 2 WHEN _overall = 3 THEN 0 ELSE -5 END;
    INSERT INTO public.provider_reliability_events (provider_id, booking_id, event_type, score_delta, note)
    VALUES (b.assigned_provider_id, b.id, 'patient_rating', delta, _overall::text || ' star rating');
  END IF;

  IF COALESCE(_report_issue, false) THEN
    INSERT INTO public.booking_issues (booking_id, reporter_id, provider_id, category, details)
    VALUES (b.id, _actor_id, b.assigned_provider_id, 'service_quality', NULLIF(_comment, ''));
  END IF;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_unified_booking_matching()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.booking_matching_settings; b public.unified_bookings; touched integer := 0; pending integer;
BEGIN
  SELECT * INTO s FROM public.booking_matching_settings WHERE id;

  UPDATE public.booking_offers SET status = 'expired', responded_at = now()
  WHERE status = 'pending' AND expires_at < now();

  FOR b IN
    SELECT * FROM public.unified_bookings
    WHERE status IN ('requested','searching','expanded','offered')
      AND assigned_provider_id IS NULL AND assigned_facility_id IS NULL
      AND created_at > now() - interval '12 hours'
  LOOP
    SELECT COUNT(*) INTO pending FROM public.booking_offers
    WHERE booking_id = b.id AND status = 'pending' AND expires_at > now();

    IF now() - COALESCE(b.last_expanded_at, b.created_at) >= make_interval(mins => COALESCE(s.expansion_interval_minutes, 1))
       AND b.current_radius_km < COALESCE(s.max_radius_km, 11) THEN
      UPDATE public.unified_bookings
      SET current_radius_km = LEAST(COALESCE(s.max_radius_km, 11), current_radius_km + COALESCE(s.expansion_step_km, 1)),
          last_expanded_at = now(),
          status = CASE WHEN pending > 0 THEN status ELSE 'expanded' END
      WHERE id = b.id;

      INSERT INTO public.booking_status_history (booking_id, status, note)
      VALUES (b.id, 'expanded', 'Search area widened to ' ||
        LEAST(COALESCE(s.max_radius_km, 11), b.current_radius_km + COALESCE(s.expansion_step_km, 1))::text || ' km');

      PERFORM public.match_unified_booking(b.id);
      touched := touched + 1;
    ELSIF pending = 0 THEN
      PERFORM public.match_unified_booking(b.id);
      SELECT COUNT(*) INTO pending FROM public.booking_offers
      WHERE booking_id = b.id AND status = 'pending' AND expires_at > now();

      IF pending = 0 AND b.current_radius_km >= COALESCE(s.max_radius_km, 11) THEN
        UPDATE public.unified_bookings SET status = 'unavailable' WHERE id = b.id AND status <> 'unavailable';
        INSERT INTO public.booking_status_history (booking_id, status, note)
        VALUES (b.id, 'unavailable', 'No professional available within ' || b.current_radius_km::text || ' km');
        INSERT INTO public.app_notifications (user_id, kind, title, body, metadata)
        SELECT b.patient_id, 'booking_update', 'No professional available yet',
               'We could not find anyone free within ' || b.current_radius_km::text || ' km. You can try again or schedule for later.',
               jsonb_build_object('bookingId', b.id, 'priority', b.priority)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.app_notifications n
          WHERE n.user_id = b.patient_id AND n.kind = 'booking_update'
            AND n.metadata->>'bookingId' = b.id::text AND n.title = 'No professional available yet');
      END IF;
      touched := touched + 1;
    END IF;
  END LOOP;
  RETURN touched;
END;
$$;

ALTER TABLE public.unified_bookings REPLICA IDENTITY FULL;
ALTER TABLE public.booking_offers REPLICA IDENTITY FULL;
ALTER TABLE public.booking_status_history REPLICA IDENTITY FULL;
ALTER TABLE public.booking_reviews REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.unified_bookings; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_offers; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_status_history; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_reviews; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('unified-booking-matching') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'unified-booking-matching');
    PERFORM cron.schedule('unified-booking-matching', '* * * * *', 'SELECT public.process_unified_booking_matching();');
  END IF;
END $$;

-- ==================== 0005_extend_matching_physio_ambulance.sql ====================
CREATE OR REPLACE FUNCTION public.match_unified_booking(_booking_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.unified_bookings;
  s public.booking_matching_settings;
  expiry timestamptz;
  created integer := 0;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = _booking_id FOR UPDATE;
  IF b.id IS NULL OR b.assigned_provider_id IS NOT NULL OR b.assigned_facility_id IS NOT NULL
     OR b.status NOT IN ('requested','searching','expanded','offered','unavailable') THEN
    RETURN 0;
  END IF;
  SELECT * INTO s FROM public.booking_matching_settings WHERE id;
  expiry := now() + make_interval(mins => COALESCE(s.offer_expiry_minutes, 10));

  UPDATE public.booking_offers SET status = 'expired', responded_at = now()
  WHERE booking_id = b.id AND status = 'pending' AND expires_at < now();

  IF b.provider_role = 'hospital' THEN
    INSERT INTO public.booking_offers (booking_id, facility_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, h.id, 'hospital', 'pending',
           CASE WHEN b.lat IS NOT NULL AND h.lat IS NOT NULL THEN public.haversine_km(b.lat, b.lng, h.lat, h.lng) END,
           b.estimated_earnings, expiry
    FROM public.hospitals h
    WHERE h.approval_status = 'approved'
      AND (b.preferred_facility_id IS NULL OR h.id = b.preferred_facility_id)
      AND (b.lat IS NULL OR h.lat IS NULL OR public.haversine_km(b.lat, b.lng, h.lat, h.lng) <= b.current_radius_km)
      AND (b.city IS NULL OR h.city IS NULL OR lower(h.city) = lower(b.city))
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.facility_id = h.id AND o.status IN ('pending','accepted','declined'));

  ELSIF b.provider_role = 'nurse' THEN
    INSERT INTO public.booking_offers (booking_id, provider_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, n.user_id, 'nurse', 'pending',
           CASE WHEN b.lat IS NOT NULL AND COALESCE(n.lat, p.lat) IS NOT NULL THEN public.haversine_km(b.lat, b.lng, COALESCE(n.lat, p.lat), COALESCE(n.lng, p.lng)) END,
           b.estimated_earnings, expiry
    FROM public.nurses n
    LEFT JOIN public.profiles p ON p.id = n.user_id
    WHERE n.user_id IS NOT NULL AND n.active AND n.is_online AND n.verified AND n.available_today
      AND (b.visit_mode <> 'home' OR n.home_care)
      AND (b.visit_mode NOT IN ('facility','locum') OR n.hospital_duty OR n.locum_available)
      AND (b.service_code IS NULL OR b.service_code = '' OR b.service_code = ANY(n.skills) OR lower(COALESCE(n.specialty,'')) = lower(b.service_code))
      AND (b.estimated_earnings IS NULL OR n.minimum_pay = 0 OR b.estimated_earnings >= n.minimum_pay)
      AND (NOT n.dnd_enabled OR (b.priority = 'emergency' AND n.dnd_allow_emergency) OR NOT public.in_dnd_window(n.dnd_start, n.dnd_end))
      AND public.provider_reliability_score(n.user_id) >= COALESCE(s.minimum_reliability_score, 0)
      AND public.provider_active_workload(n.user_id) < 3
      AND (
        (b.lat IS NOT NULL AND COALESCE(n.lat, p.lat) IS NOT NULL
          AND public.haversine_km(b.lat, b.lng, COALESCE(n.lat, p.lat), COALESCE(n.lng, p.lng)) <= LEAST(b.current_radius_km, n.travel_radius_km))
        OR (b.area IS NOT NULL AND b.area = ANY(n.areas))
        OR (COALESCE(n.lat, p.lat) IS NULL AND (b.city IS NULL OR lower(COALESCE(n.city,'')) = lower(b.city)))
      )
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.provider_id = n.user_id AND o.status IN ('pending','accepted','declined'));

  ELSIF b.provider_role = 'technician' THEN
    INSERT INTO public.booking_offers (booking_id, provider_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, t.user_id, 'technician', 'pending',
           CASE WHEN b.lat IS NOT NULL AND COALESCE(t.lat, p.lat) IS NOT NULL THEN public.haversine_km(b.lat, b.lng, COALESCE(t.lat, p.lat), COALESCE(t.lng, p.lng)) END,
           b.estimated_earnings, expiry
    FROM public.technicians t
    LEFT JOIN public.profiles p ON p.id = t.user_id
    WHERE t.user_id IS NOT NULL AND t.active AND t.is_online AND t.available_today
      AND (b.visit_mode <> 'home' OR t.home_visits)
      AND (b.visit_mode <> 'facility' OR t.clinic_visits)
      AND (b.service_code IS NULL OR b.service_code = '' OR b.service_code = ANY(t.test_types))
      AND (b.estimated_earnings IS NULL OR t.minimum_pay = 0 OR b.estimated_earnings >= t.minimum_pay)
      AND (NOT t.dnd_enabled OR (b.priority = 'emergency' AND t.dnd_allow_emergency) OR NOT public.in_dnd_window(t.dnd_start, t.dnd_end))
      AND public.provider_reliability_score(t.user_id) >= COALESCE(s.minimum_reliability_score, 0)
      AND public.provider_active_workload(t.user_id) < 3
      AND (
        (b.lat IS NOT NULL AND COALESCE(t.lat, p.lat) IS NOT NULL
          AND public.haversine_km(b.lat, b.lng, COALESCE(t.lat, p.lat), COALESCE(t.lng, p.lng)) <= LEAST(b.current_radius_km, t.travel_radius_km))
        OR (b.area IS NOT NULL AND b.area = ANY(t.areas))
        OR (COALESCE(t.lat, p.lat) IS NULL AND (b.city IS NULL OR lower(COALESCE(t.city,'')) = lower(b.city)))
      )
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.provider_id = t.user_id AND o.status IN ('pending','accepted','declined'));

  ELSIF b.provider_role = 'physiotherapist' THEN
    INSERT INTO public.booking_offers (booking_id, provider_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, f.user_id, 'physiotherapist', 'pending',
           CASE WHEN b.lat IS NOT NULL AND p.lat IS NOT NULL THEN public.haversine_km(b.lat, b.lng, p.lat, p.lng) END,
           b.estimated_earnings, expiry
    FROM public.physio_therapists f
    LEFT JOIN public.profiles p ON p.id = f.user_id
    WHERE f.user_id IS NOT NULL AND f.active AND f.is_online AND f.verified
      AND (b.visit_mode <> 'home' OR f.home_visits)
      AND (b.visit_mode NOT IN ('facility','locum') OR f.clinic_visits)
      AND (b.service_code IS NULL OR b.service_code = '' OR b.service_code = ANY(f.specializations))
      AND public.provider_reliability_score(f.user_id) >= COALESCE(s.minimum_reliability_score, 0)
      AND public.provider_active_workload(f.user_id) < 3
      AND (
        (b.lat IS NOT NULL AND p.lat IS NOT NULL AND public.haversine_km(b.lat, b.lng, p.lat, p.lng) <= b.current_radius_km)
        OR (b.area IS NOT NULL AND (b.area = ANY(COALESCE(f.areas, ARRAY[]::text[])) OR lower(COALESCE(f.area,'')) = lower(b.area)))
        OR (p.lat IS NULL AND (b.city IS NULL OR f.city IS NULL OR lower(f.city) = lower(b.city)))
      )
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.provider_id = f.user_id AND o.status IN ('pending','accepted','declined'));

  ELSIF b.provider_role = 'ambulance' THEN
    INSERT INTO public.booking_offers (booking_id, provider_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT DISTINCT ON (u.owner_id) b.id, u.owner_id, 'ambulance', 'pending',
           CASE WHEN b.lat IS NOT NULL AND u.lat IS NOT NULL THEN public.haversine_km(b.lat, b.lng, u.lat, u.lng) END,
           b.estimated_earnings, expiry
    FROM public.ambulance_units u
    WHERE u.owner_id IS NOT NULL AND u.online
      AND (
        (b.lat IS NOT NULL AND u.lat IS NOT NULL AND public.haversine_km(b.lat, b.lng, u.lat, u.lng) <= b.current_radius_km)
        OR (b.area IS NOT NULL AND u.area IS NOT NULL AND lower(u.area) = lower(b.area))
        OR (u.lat IS NULL AND (b.city IS NULL OR u.city IS NULL OR lower(u.city) = lower(b.city)))
      )
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.provider_id = u.owner_id AND o.status IN ('pending','accepted','declined'));

  ELSE
    INSERT INTO public.booking_offers (booking_id, provider_id, provider_role, status, distance_km, earnings, expires_at)
    SELECT b.id, d.id, 'care_physician', 'pending',
           CASE WHEN b.lat IS NOT NULL AND p.lat IS NOT NULL THEN public.haversine_km(b.lat, b.lng, p.lat, p.lng) END,
           b.estimated_earnings, expiry
    FROM public.provider_directory d
    LEFT JOIN public.profiles p ON p.id = d.id
    WHERE d.verified
      AND (b.service_code IS NULL OR b.service_code = '' OR lower(COALESCE(d.specialty,'')) = lower(b.service_code))
      AND public.provider_reliability_score(d.id) >= COALESCE(s.minimum_reliability_score, 0)
      AND public.provider_active_workload(d.id) < 3
      AND (
        (b.lat IS NOT NULL AND p.lat IS NOT NULL AND public.haversine_km(b.lat, b.lng, p.lat, p.lng) <= b.current_radius_km)
        OR (b.area IS NOT NULL AND d.area IS NOT NULL AND lower(d.area) = lower(b.area))
        OR (p.lat IS NULL AND (b.city IS NULL OR d.city IS NULL OR lower(d.city) = lower(b.city)))
      )
      AND NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.provider_id = d.id AND o.status IN ('pending','accepted','declined'));
  END IF;

  GET DIAGNOSTICS created = ROW_COUNT;
  PERFORM public.finalise_unified_booking_match(_booking_id, created);
  RETURN created;
END;
$$;

-- ==================== 0006_provider_live_location_and_cancel_rematch.sql ====================
ALTER TABLE public.physio_therapists ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.physio_therapists ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE public.physio_therapists ADD COLUMN IF NOT EXISTS last_location_at timestamptz;
ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS last_location_at timestamptz;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS last_location_at timestamptz;
ALTER TABLE public.ambulance_units ADD COLUMN IF NOT EXISTS last_location_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_provider_live_location(_actor_id uuid, _lat double precision, _lng double precision)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE touched integer := 0; n integer;
BEGIN
  IF _lat IS NULL OR _lng IS NULL THEN RAISE EXCEPTION 'Location is required'; END IF;
  UPDATE public.nurses SET lat = _lat, lng = _lng, last_location_at = now() WHERE user_id = _actor_id;
  GET DIAGNOSTICS n = ROW_COUNT; touched := touched + n;
  UPDATE public.technicians SET lat = _lat, lng = _lng, last_location_at = now() WHERE user_id = _actor_id;
  GET DIAGNOSTICS n = ROW_COUNT; touched := touched + n;
  UPDATE public.physio_therapists SET lat = _lat, lng = _lng, last_location_at = now() WHERE user_id = _actor_id;
  GET DIAGNOSTICS n = ROW_COUNT; touched := touched + n;
  UPDATE public.ambulance_units SET lat = _lat, lng = _lng, last_location_at = now() WHERE owner_id = _actor_id;
  GET DIAGNOSTICS n = ROW_COUNT; touched := touched + n;
  RETURN touched;
END;
$$;

CREATE OR REPLACE FUNCTION public.server_cancel_unified_booking(_actor_id uuid, _booking_id uuid, _reason text)
RETURNS public.unified_bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.unified_bookings; s public.booking_matching_settings; is_provider boolean; is_patient boolean; is_admin boolean; leaving_provider uuid;
BEGIN
  SELECT * INTO s FROM public.booking_matching_settings WHERE id;
  SELECT * INTO b FROM public.unified_bookings WHERE id = _booking_id FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;

  is_patient := b.patient_id = _actor_id OR b.requested_by = _actor_id;
  is_provider := b.assigned_provider_id = _actor_id
    OR EXISTS (SELECT 1 FROM public.hospitals WHERE id = b.assigned_facility_id AND owner_id = _actor_id);
  is_admin := public.has_role(_actor_id, 'admin') OR public.has_role(_actor_id, 'super_admin');
  IF NOT (is_patient OR is_provider OR is_admin) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF b.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'This booking is already closed'; END IF;

  IF is_provider AND NOT is_patient THEN
    leaving_provider := COALESCE(b.assigned_provider_id, _actor_id);

    INSERT INTO public.provider_reliability_events (provider_id, booking_id, event_type, score_delta, note)
    VALUES (leaving_provider, b.id, 'provider_cancellation', COALESCE(s.provider_cancellation_penalty, -8), _reason);

    -- The professional who walked away is marked declined so the matcher never
    -- offers the same job back to them; everyone else is simply withdrawn.
    UPDATE public.booking_offers SET status = 'declined', responded_at = now(), response_note = _reason
    WHERE booking_id = b.id AND status IN ('pending','accepted')
      AND (provider_id = leaving_provider OR facility_id = b.assigned_facility_id);

    UPDATE public.booking_offers SET status = 'withdrawn', responded_at = now()
    WHERE booking_id = b.id AND status IN ('pending','accepted');

    UPDATE public.unified_bookings
    SET status = 'searching', assigned_provider_id = NULL, assigned_facility_id = NULL,
        accepted_at = NULL, en_route_at = NULL, arrived_at = NULL, started_at = NULL,
        current_radius_km = COALESCE(s.initial_radius_km, 4), last_expanded_at = NULL,
        cancellation_reason = _reason
    WHERE id = b.id RETURNING * INTO b;

    INSERT INTO public.booking_status_history (booking_id, status, actor_id, actor_role, note)
    VALUES (b.id, 'searching', _actor_id, 'provider', 'Professional cancelled — searching again: ' || _reason);

    INSERT INTO public.app_notifications (user_id, kind, title, body, metadata)
    VALUES (b.patient_id, 'booking_update', 'Finding you another professional',
            'The assigned professional cancelled. We are contacting others nearby right away.',
            jsonb_build_object('bookingId', b.id, 'priority', b.priority));

    PERFORM public.match_unified_booking(b.id);
    -- Nobody free inside the current radius: widen once immediately so the
    -- replacement search does not stall until the next expansion tick.
    SELECT * INTO b FROM public.unified_bookings WHERE id = b.id;
    IF NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.status = 'pending') THEN
      UPDATE public.unified_bookings
      SET current_radius_km = LEAST(COALESCE(s.max_radius_km, 11), current_radius_km + COALESCE(s.expansion_step_km, 1)),
          last_expanded_at = now()
      WHERE id = b.id;
      PERFORM public.match_unified_booking(b.id);
      SELECT * INTO b FROM public.unified_bookings WHERE id = b.id;
    END IF;
    RETURN b;
  END IF;

  UPDATE public.booking_offers SET status = 'withdrawn', responded_at = now()
  WHERE booking_id = b.id AND status IN ('pending','accepted');

  UPDATE public.unified_bookings
  SET status = 'cancelled', cancelled_at = now(), cancelled_by = _actor_id, cancellation_reason = _reason
  WHERE id = b.id RETURNING * INTO b;

  INSERT INTO public.booking_status_history (booking_id, status, actor_id, actor_role, note)
  VALUES (b.id, 'cancelled', _actor_id, CASE WHEN is_patient THEN 'patient' ELSE 'admin' END, _reason);

  IF b.assigned_provider_id IS NOT NULL THEN
    INSERT INTO public.app_notifications (user_id, kind, title, body, metadata)
    VALUES (b.assigned_provider_id, 'booking_update', 'Booking cancelled', b.title || ' was cancelled: ' || _reason,
            jsonb_build_object('bookingId', b.id, 'priority', b.priority));
  END IF;
  RETURN b;
END;
$$;

-- ==================== 0007_fix_cancel_offer_note_column.sql ====================
CREATE OR REPLACE FUNCTION public.server_cancel_unified_booking(_actor_id uuid, _booking_id uuid, _reason text)
RETURNS public.unified_bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.unified_bookings; s public.booking_matching_settings; is_provider boolean; is_patient boolean; is_admin boolean; leaving_provider uuid;
BEGIN
  SELECT * INTO s FROM public.booking_matching_settings WHERE id;
  SELECT * INTO b FROM public.unified_bookings WHERE id = _booking_id FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;

  is_patient := b.patient_id = _actor_id OR b.requested_by = _actor_id;
  is_provider := b.assigned_provider_id = _actor_id
    OR EXISTS (SELECT 1 FROM public.hospitals WHERE id = b.assigned_facility_id AND owner_id = _actor_id);
  is_admin := public.has_role(_actor_id, 'admin') OR public.has_role(_actor_id, 'super_admin');
  IF NOT (is_patient OR is_provider OR is_admin) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF b.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'This booking is already closed'; END IF;

  IF is_provider AND NOT is_patient THEN
    leaving_provider := COALESCE(b.assigned_provider_id, _actor_id);

    INSERT INTO public.provider_reliability_events (provider_id, booking_id, event_type, score_delta, note)
    VALUES (leaving_provider, b.id, 'provider_cancellation', COALESCE(s.provider_cancellation_penalty, -8), _reason);

    UPDATE public.booking_offers SET status = 'declined', responded_at = now(), note = _reason
    WHERE booking_id = b.id AND status IN ('pending','accepted')
      AND (provider_id = leaving_provider OR (b.assigned_facility_id IS NOT NULL AND facility_id = b.assigned_facility_id));

    UPDATE public.booking_offers SET status = 'withdrawn', responded_at = now()
    WHERE booking_id = b.id AND status IN ('pending','accepted');

    UPDATE public.unified_bookings
    SET status = 'searching', assigned_provider_id = NULL, assigned_facility_id = NULL,
        accepted_at = NULL, en_route_at = NULL, arrived_at = NULL, started_at = NULL,
        current_radius_km = COALESCE(s.initial_radius_km, 4), last_expanded_at = NULL,
        cancellation_reason = _reason
    WHERE id = b.id RETURNING * INTO b;

    INSERT INTO public.booking_status_history (booking_id, status, actor_id, actor_role, note)
    VALUES (b.id, 'searching', _actor_id, 'provider', 'Professional cancelled — searching again: ' || _reason);

    INSERT INTO public.app_notifications (user_id, kind, title, body, metadata)
    VALUES (b.patient_id, 'booking_update', 'Finding you another professional',
            'The assigned professional cancelled. We are contacting others nearby right away.',
            jsonb_build_object('bookingId', b.id, 'priority', b.priority));

    PERFORM public.match_unified_booking(b.id);
    SELECT * INTO b FROM public.unified_bookings WHERE id = b.id;
    IF NOT EXISTS (SELECT 1 FROM public.booking_offers o WHERE o.booking_id = b.id AND o.status = 'pending') THEN
      UPDATE public.unified_bookings
      SET current_radius_km = LEAST(COALESCE(s.max_radius_km, 11), current_radius_km + COALESCE(s.expansion_step_km, 1)),
          last_expanded_at = now()
      WHERE id = b.id;
      PERFORM public.match_unified_booking(b.id);
      SELECT * INTO b FROM public.unified_bookings WHERE id = b.id;
    END IF;
    RETURN b;
  END IF;

  UPDATE public.booking_offers SET status = 'withdrawn', responded_at = now()
  WHERE booking_id = b.id AND status IN ('pending','accepted');

  UPDATE public.unified_bookings
  SET status = 'cancelled', cancelled_at = now(), cancelled_by = _actor_id, cancellation_reason = _reason
  WHERE id = b.id RETURNING * INTO b;

  INSERT INTO public.booking_status_history (booking_id, status, actor_id, actor_role, note)
  VALUES (b.id, 'cancelled', _actor_id, CASE WHEN is_patient THEN 'patient' ELSE 'admin' END, _reason);

  IF b.assigned_provider_id IS NOT NULL THEN
    INSERT INTO public.app_notifications (user_id, kind, title, body, metadata)
    VALUES (b.assigned_provider_id, 'booking_update', 'Booking cancelled', b.title || ' was cancelled: ' || _reason,
            jsonb_build_object('bookingId', b.id, 'priority', b.priority));
  END IF;
  RETURN b;
END;
$$;



-- Revoke anon execution on unified booking and care staff functions
DO $$
DECLARE
  fns text[] := ARRAY[
    'claim_technician_test',
    'set_technician_test_stage',
    'provider_reliability_score',
    'provider_active_workload',
    'can_view_unified_booking',
    'finalise_unified_booking_match',
    'server_create_unified_booking',
    'server_accept_unified_booking_offer',
    'server_decline_unified_booking_offer',
    'server_transition_unified_booking',
    'server_retry_unified_booking',
    'server_submit_unified_booking_review',
    'process_unified_booking_matching',
    'match_unified_booking',
    'set_provider_live_location',
    'server_cancel_unified_booking'
  ];
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS proc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(fns)
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || r.proc || ' FROM PUBLIC, anon;';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.proc || ' TO authenticated, service_role;';
  END LOOP;
END $$;

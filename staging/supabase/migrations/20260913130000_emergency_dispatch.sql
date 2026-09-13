-- ============================================================================
-- Real emergency dispatch (profile-driven)
--
-- The patient taps Emergency and picks a symptom. Nothing else is asked.
-- Phone, name, emergency contacts and medical summary come from the profile;
-- pickup comes from the live GPS fix. There is no address field and no phone
-- field anywhere in the flow.
--
-- Paging order: ambulance first (nearest, Uber-style), then hospitals that can
-- actually treat the category, then the hospital's in-house specialist.
-- Search starts at 4 km and widens by 1 km every 20 seconds until someone
-- accepts or the ceiling is reached.
-- First accept wins, enforced by a row lock inside SECURITY DEFINER functions.
-- ============================================================================

-- ---------------------------------------------------------------- enums ----
DO $$ BEGIN
  CREATE TYPE public.emergency_category AS ENUM
    ('cardiac','stroke','trauma','breathing','pregnancy','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.emergency_case_status AS ENUM
    ('searching','hospital_assigned','ambulance_en_route','ambulance_arrived',
     'transporting','handed_over','admitted','cancelled','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.emergency_target_kind AS ENUM ('hospital','doctor','ambulance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------ profile: the single source --
-- Everything the ambulance, hospital and doctor need is captured once, at
-- signup. The emergency screen never asks for it again.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS allergies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conditions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS medications text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emergency_contact_1_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_1_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_2_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_2_phone text;

-- A profile is emergency-ready only when we can reach the patient and one
-- other human. The app nags for this at signup, not during the emergency.
CREATE OR REPLACE FUNCTION public.emergency_profile_ready(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = _user_id
       AND length(btrim(COALESCE(p.phone,''))) >= 8
       AND length(btrim(COALESCE(p.emergency_contact_1_phone,''))) >= 8
  );
$$;

-- ------------------------------------------------- hospital capability -----
ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS emergency_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_mode_at timestamptz,
  ADD COLUMN IF NOT EXISTS er_beds_available integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_icu boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_ot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_cath_lab boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_nicu boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_blood_bank boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS hospitals_emergency_mode_idx
  ON public.hospitals (emergency_mode) WHERE emergency_mode;
CREATE INDEX IF NOT EXISTS hospitals_owner_idx ON public.hospitals (owner_id);

-- What a hospital must physically have before it is allowed to accept a
-- category. A hospital with no cath lab is never paged for a heart attack.
CREATE OR REPLACE FUNCTION public.hospital_can_treat(
  h public.hospitals, _category public.emergency_category
) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _category
    WHEN 'cardiac'   THEN h.has_cath_lab AND h.has_icu
    WHEN 'stroke'    THEN h.has_icu
    WHEN 'trauma'    THEN h.has_ot AND h.has_blood_bank
    WHEN 'breathing' THEN h.has_icu
    WHEN 'pregnancy' THEN h.has_ot
    ELSE true
  END;
$$;

-- Dispatch timing lives in a row, not in code, so the numbers can be tuned
-- against real Pune response times without a migration or a redeploy.
CREATE TABLE IF NOT EXISTS public.emergency_settings (
  id                      integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  search_start_km         double precision NOT NULL DEFAULT 4,
  radius_step_km          double precision NOT NULL DEFAULT 1,
  max_radius_km           double precision NOT NULL DEFAULT 15,
  -- One step every 22 seconds: the middle of the 20-25 second window.
  radius_step_seconds     integer NOT NULL DEFAULT 22 CHECK (radius_step_seconds BETWEEN 5 AND 300),
  -- Same window for moving the specialist page to its next wave.
  specialist_wave_seconds integer NOT NULL DEFAULT 22 CHECK (specialist_wave_seconds BETWEEN 5 AND 300),
  -- Master cutover switch. Off means no new case can be created, so the old
  -- ambulance-only queue and this one can never both be live.
  dispatch_enabled        boolean NOT NULL DEFAULT false,
  dispatch_enabled_at     timestamptz,
  -- Proof the background worker is actually running. Checked by the verify script.
  last_tick_at            timestamptz,
  last_tick_cases         integer,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.emergency_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.emergency_setting(_name text)
RETURNS double precision LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _name
    WHEN 'search_start_km'         THEN search_start_km
    WHEN 'radius_step_km'          THEN radius_step_km
    WHEN 'max_radius_km'           THEN max_radius_km
    WHEN 'radius_step_seconds'     THEN radius_step_seconds::double precision
    WHEN 'specialist_wave_seconds' THEN specialist_wave_seconds::double precision
  END FROM public.emergency_settings WHERE id = 1;
$$;

CREATE TABLE IF NOT EXISTS public.emergency_category_specialties (
  category  public.emergency_category NOT NULL,
  specialty text NOT NULL,
  PRIMARY KEY (category, specialty)
);

INSERT INTO public.emergency_category_specialties (category, specialty) VALUES
  ('cardiac','Cardiology'), ('cardiac','Emergency Medicine'), ('cardiac','Critical Care'),
  ('stroke','Neurology'), ('stroke','Emergency Medicine'), ('stroke','Critical Care'),
  ('trauma','Orthopaedics'), ('trauma','Orthopedics'), ('trauma','General Surgery'),
  ('trauma','Trauma Surgery'), ('trauma','Emergency Medicine'),
  ('breathing','Pulmonology'), ('breathing','Critical Care'), ('breathing','Emergency Medicine'),
  ('pregnancy','Obstetrics'), ('pregnancy','Gynaecology'), ('pregnancy','Obstetrics & Gynaecology'),
  ('other','Emergency Medicine'), ('other','General Medicine')
ON CONFLICT DO NOTHING;

-- Who works at which hospital, and who is first choice for a category.
-- in_house = on the payroll, asked before anyone in the wider area.
CREATE TABLE IF NOT EXISTS public.hospital_emergency_specialists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  category    public.emergency_category NOT NULL,
  doctor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  priority    integer NOT NULL DEFAULT 1,
  in_house    boolean NOT NULL DEFAULT true,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, category, doctor_id)
);
CREATE INDEX IF NOT EXISTS hosp_emg_spec_lookup_idx
  ON public.hospital_emergency_specialists (hospital_id, category, priority) WHERE active;

-- ------------------------------------------------------------ live case ----
CREATE TABLE IF NOT EXISTS public.emergency_cases (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Client-generated per tap. A retry after a dropped response reuses the same
  -- key and returns the same case instead of opening a second one.
  request_key       uuid NOT NULL DEFAULT gen_random_uuid(),
  category          public.emergency_category NOT NULL,
  triage            jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 'ambulance' pages crews. 'self' means the family drives: the bed and the
  -- specialist are still booked, no crew is alerted, no vehicle is tracked.
  transport_mode    text NOT NULL DEFAULT 'ambulance'
                    CHECK (transport_mode IN ('ambulance','self')),

  -- Snapshot of the profile at the moment of the emergency, so a later profile
  -- edit cannot rewrite what the crew was told.
  patient_name      text,
  patient_phone     text,
  contact_1_name    text,
  contact_1_phone   text,
  contact_2_name    text,
  contact_2_phone   text,
  blood_group       text,
  allergies         text[] NOT NULL DEFAULT '{}',
  conditions        text[] NOT NULL DEFAULT '{}',
  medications       text[] NOT NULL DEFAULT '{}',

  -- Live GPS at the tap. The patient never types an address; when GPS fails,
  -- the case is still saved and an operator confirms the pickup by phone.
  pickup_lat        double precision,
  pickup_lng        double precision,
  pickup_accuracy_m double precision,
  pickup_captured_at timestamptz,
  -- 'gps'  = the patient's own device fix
  -- 'verified' = an operator confirmed it with the caller
  -- 'needs_location' = no usable fix yet; matching is held until there is one
  location_status   text NOT NULL DEFAULT 'gps'
                    CHECK (location_status IN ('gps','verified','needs_location')),
  pickup_set_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Raised when something needs a human: no phone, or no location.
  needs_attention   boolean NOT NULL DEFAULT false,
  -- Bumped on every write so a stale client can detect it lost a race.
  version           bigint NOT NULL DEFAULT 0,
  handed_over_at    timestamptz,

  status            public.emergency_case_status NOT NULL DEFAULT 'searching',

  -- Widening search.
  search_radius_km  double precision NOT NULL DEFAULT 4,
  max_radius_km     double precision NOT NULL DEFAULT 15,
  radius_expanded_at timestamptz NOT NULL DEFAULT now(),

  ambulance_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ambulance_accepted_at timestamptz,
  ambulance_arrived_at  timestamptz,
  ambulance_eta_seconds integer,

  hospital_id           uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  hospital_accepted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hospital_accepted_at  timestamptz,
  bed_label             text,

  doctor_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  doctor_accepted_at    timestamptz,
  doctor_wave           integer NOT NULL DEFAULT 0,
  doctor_wave_at        timestamptz,

  cancelled_reason  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  closed_at         timestamptz,

  CHECK (pickup_lat IS NULL OR pickup_lat BETWEEN -90 AND 90),
  CHECK (pickup_lng IS NULL OR pickup_lng BETWEEN -180 AND 180),
  CHECK ((pickup_lat IS NULL) = (pickup_lng IS NULL)),
  -- The flag and the data can never disagree.
  CHECK ((location_status = 'needs_location') = (pickup_lat IS NULL)),
  UNIQUE (patient_id, request_key)
);

-- One live case per patient. A second tap returns the same case rather than
-- sending two ambulances to one chest.
CREATE UNIQUE INDEX IF NOT EXISTS emergency_cases_one_active_per_patient
  ON public.emergency_cases (patient_id)
  WHERE status NOT IN ('cancelled','closed','admitted');
CREATE INDEX IF NOT EXISTS emergency_cases_open_idx
  ON public.emergency_cases (status, created_at DESC)
  WHERE status NOT IN ('cancelled','closed','admitted');
CREATE INDEX IF NOT EXISTS emergency_cases_hospital_idx ON public.emergency_cases (hospital_id);
CREATE INDEX IF NOT EXISTS emergency_cases_doctor_idx   ON public.emergency_cases (doctor_id);
CREATE INDEX IF NOT EXISTS emergency_cases_amb_idx      ON public.emergency_cases (ambulance_id);

CREATE TABLE IF NOT EXISTS public.emergency_dispatch_targets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      uuid NOT NULL REFERENCES public.emergency_cases(id) ON DELETE CASCADE,
  target_kind  public.emergency_target_kind NOT NULL,
  hospital_id  uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  distance_km  double precision,
  -- doctors: 1 = in-house first choice, 2 = other in-house, 3 = area broadcast
  wave         integer NOT NULL DEFAULT 1,
  radius_km    double precision,
  notified_at  timestamptz NOT NULL DEFAULT now(),
  seen_at      timestamptz,
  response     text CHECK (response IN ('accepted','declined','lost','timeout')),
  responded_at timestamptz,
  CHECK (hospital_id IS NOT NULL OR user_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS emergency_targets_unique_hospital
  ON public.emergency_dispatch_targets (case_id, target_kind, hospital_id) WHERE hospital_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS emergency_targets_unique_user
  ON public.emergency_dispatch_targets (case_id, target_kind, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS emergency_targets_user_idx
  ON public.emergency_dispatch_targets (user_id, notified_at DESC);
CREATE INDEX IF NOT EXISTS emergency_targets_hospital_idx
  ON public.emergency_dispatch_targets (hospital_id, notified_at DESC);

CREATE TABLE IF NOT EXISTS public.emergency_case_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    uuid NOT NULL REFERENCES public.emergency_cases(id) ON DELETE CASCADE,
  actor_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS emergency_events_case_idx
  ON public.emergency_case_events (case_id, created_at DESC);

-- Crew GPS, roughly every 10 seconds. Append-only so the patient sees the path
-- actually driven rather than a straight line drawn by the app.
CREATE TABLE IF NOT EXISTS public.emergency_ambulance_pings (
  id          bigserial PRIMARY KEY,
  case_id     uuid NOT NULL REFERENCES public.emergency_cases(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  accuracy_m  double precision,
  heading_deg double precision,
  speed_kph   double precision,
  eta_seconds integer,
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CHECK (lat BETWEEN -90 AND 90),
  CHECK (lng BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS emergency_pings_case_idx
  ON public.emergency_ambulance_pings (case_id, captured_at DESC);

-- ------------------------------------------------------------ helpers ------
CREATE OR REPLACE FUNCTION public.emergency_distance_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) RETURNS double precision LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
    ELSE 6371 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
  END;
$$;

CREATE OR REPLACE FUNCTION public.emergency_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version := COALESCE(OLD.version, 0) + 1;
  -- A case with no location or no phone must not sit silently in a queue.
  NEW.needs_attention := (NEW.location_status = 'needs_location')
                         OR NEW.patient_phone IS NULL
                         OR length(btrim(NEW.patient_phone)) < 8;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS emergency_cases_touch ON public.emergency_cases;
CREATE TRIGGER emergency_cases_touch BEFORE UPDATE ON public.emergency_cases
  FOR EACH ROW EXECUTE FUNCTION public.emergency_touch();

CREATE OR REPLACE FUNCTION public.can_see_emergency_case(_case_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.emergency_cases c
     WHERE c.id = _case_id AND (
       c.patient_id = auth.uid() OR c.doctor_id = auth.uid()
       OR c.ambulance_id = auth.uid() OR c.hospital_accepted_by = auth.uid()
       OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = c.hospital_id AND h.owner_id = auth.uid()))
  ) OR EXISTS (
    SELECT 1 FROM public.emergency_dispatch_targets t
      LEFT JOIN public.hospitals h ON h.id = t.hospital_id
     WHERE t.case_id = _case_id AND (t.user_id = auth.uid() OR h.owner_id = auth.uid())
  ) OR public.has_role(auth.uid(), 'admin');
$$;

-- --------------------------------------------------------- paging waves ----
-- Adds any responder inside the current radius that has not been paged yet.
-- Called on creation and again after every radius expansion, so a crew that
-- comes online mid-case still gets the page.
CREATE OR REPLACE FUNCTION public.page_emergency_responders(p_case_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_case public.emergency_cases; v_added integer := 0; v_n integer;
BEGIN
  SELECT * INTO v_case FROM public.emergency_cases WHERE id = p_case_id;
  IF NOT FOUND OR v_case.status NOT IN ('searching','ambulance_en_route','ambulance_arrived','transporting') THEN
    RETURN 0;
  END IF;

  -- 1. Ambulance crews, nearest first. Paged before anyone else, and skipped
  -- entirely when the family said they would drive themselves.
  IF v_case.ambulance_id IS NULL AND v_case.transport_mode = 'ambulance' THEN
    INSERT INTO public.emergency_dispatch_targets
      (case_id, target_kind, user_id, distance_km, wave, radius_km)
    SELECT p_case_id, 'ambulance', pr.id,
           public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, pr.lat, pr.lng),
           1, v_case.search_radius_km
      FROM public.profiles pr
     WHERE pr.view = 'ambulance'
       AND pr.id <> v_case.patient_id
       AND pr.last_seen_at > now() - interval '3 minutes'
       AND public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, pr.lat, pr.lng)
           <= v_case.search_radius_km
     ORDER BY public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, pr.lat, pr.lng)
     LIMIT 25
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_added := v_added + v_n;
  END IF;

  -- 2. Hospitals: emergency mode on, category actually treatable there.
  IF v_case.hospital_id IS NULL THEN
    INSERT INTO public.emergency_dispatch_targets
      (case_id, target_kind, hospital_id, distance_km, wave, radius_km)
    SELECT p_case_id, 'hospital', h.id,
           public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, h.lat, h.lng),
           1, v_case.search_radius_km
      FROM public.hospitals h
     WHERE h.emergency = true AND h.emergency_mode = true
       AND public.hospital_can_treat(h, v_case.category)
       AND public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, h.lat, h.lng)
           <= v_case.search_radius_km
     ORDER BY public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, h.lat, h.lng)
     LIMIT 15
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_added := v_added + v_n;
  END IF;

  -- 3. Wave 1 specialists: each candidate hospital's in-house first choice.
  IF v_case.doctor_id IS NULL AND v_case.doctor_wave <= 1 THEN
    INSERT INTO public.emergency_dispatch_targets
      (case_id, target_kind, user_id, hospital_id, wave, radius_km)
    SELECT DISTINCT ON (s.doctor_id)
           p_case_id, 'doctor', s.doctor_id, s.hospital_id, 1, v_case.search_radius_km
      FROM public.hospital_emergency_specialists s
      JOIN public.emergency_dispatch_targets t
        ON t.case_id = p_case_id AND t.target_kind = 'hospital' AND t.hospital_id = s.hospital_id
     WHERE s.category = v_case.category AND s.active AND s.in_house
     ORDER BY s.doctor_id, s.priority
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_added := v_added + v_n;
    IF v_case.doctor_wave = 0 THEN
      UPDATE public.emergency_cases SET doctor_wave = 1, doctor_wave_at = now() WHERE id = p_case_id;
    END IF;
  END IF;

  IF v_added > 0 THEN
    INSERT INTO public.emergency_case_events (case_id, kind, payload)
    VALUES (p_case_id, 'responders_paged',
            jsonb_build_object('added', v_added, 'radius_km', v_case.search_radius_km));
  END IF;
  RETURN v_added;
END $$;

-- ------------------------------------------------------------ create -------
-- Takes only the symptom, the triage answers and the live GPS fix. Name, phone,
-- emergency contacts and medical summary are read from the profile.
CREATE OR REPLACE FUNCTION public.create_emergency_case(
  p_category    public.emergency_category,
  p_triage      jsonb DEFAULT '[]'::jsonb,
  p_lat         double precision DEFAULT NULL,
  p_lng         double precision DEFAULT NULL,
  p_accuracy_m  double precision DEFAULT NULL,
  p_captured_at timestamptz DEFAULT NULL,
  p_transport   text DEFAULT 'ambulance'
) RETURNS public.emergency_cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_case public.emergency_cases; v_p public.profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EMERGENCY_AUTH_REQUIRED: Sign in to raise an emergency. Call 108 now if this cannot wait.';
  END IF;
  IF p_transport NOT IN ('ambulance','self') THEN
    RAISE EXCEPTION 'EMERGENCY_BAD_TRANSPORT: Choose whether an ambulance is coming or you are driving yourself.';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'EMERGENCY_NO_LOCATION: Turn on location. Help is sent to your live position, so there is nothing to type.';
  END IF;

  SELECT * INTO v_case FROM public.emergency_cases
   WHERE patient_id = v_uid AND status NOT IN ('cancelled','closed','admitted')
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_case; END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.emergency_cases (
    patient_id, category, triage, transport_mode,
    patient_name, patient_phone,
    contact_1_name, contact_1_phone, contact_2_name, contact_2_phone,
    blood_group, allergies, conditions, medications,
    pickup_lat, pickup_lng, pickup_accuracy_m, pickup_captured_at
  ) VALUES (
    v_uid, p_category, COALESCE(p_triage,'[]'::jsonb), p_transport,
    COALESCE(v_p.full_name,'Patient'), v_p.phone,
    v_p.emergency_contact_1_name, v_p.emergency_contact_1_phone,
    v_p.emergency_contact_2_name, v_p.emergency_contact_2_phone,
    v_p.blood_group, COALESCE(v_p.allergies,'{}'), COALESCE(v_p.conditions,'{}'),
    COALESCE(v_p.medications,'{}'),
    p_lat, p_lng, p_accuracy_m, COALESCE(p_captured_at, now())
  ) RETURNING * INTO v_case;

  INSERT INTO public.emergency_case_events (case_id, actor_id, kind, payload)
  VALUES (v_case.id, v_uid, 'case_created',
          jsonb_build_object('category', p_category, 'transport', p_transport,
                             'radius_km', v_case.search_radius_km));

  PERFORM public.page_emergency_responders(v_case.id);
  SELECT * INTO v_case FROM public.emergency_cases WHERE id = v_case.id;
  RETURN v_case;
END $$;

-- ---------------------------------------------------- widening the net -----
-- Every 20 seconds without an ambulance, push the radius out by 1 km and page
-- whoever that brings into range. The server owns the clock, so a client that
-- polls too eagerly cannot skip the case ahead.
CREATE OR REPLACE FUNCTION public.expand_emergency_search(
  p_case_id uuid,
  p_after_seconds integer DEFAULT NULL,
  p_step_km double precision DEFAULT NULL
) RETURNS double precision
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_case public.emergency_cases; v_wait integer; v_step double precision; v_done boolean;
BEGIN
  v_wait := COALESCE(p_after_seconds, public.emergency_setting('radius_step_seconds')::integer, 22);
  v_step := COALESCE(p_step_km, public.emergency_setting('radius_step_km'), 1);
  SELECT * INTO v_case FROM public.emergency_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- A signed-in caller must be a party to the case. The background worker runs
  -- with no auth.uid() at all, and is allowed through.
  IF auth.uid() IS NOT NULL AND NOT public.can_see_emergency_case(p_case_id) THEN
    RAISE EXCEPTION 'EMERGENCY_FORBIDDEN: Not a party to this case.';
  END IF;
  IF v_case.status NOT IN ('searching','hospital_assigned') THEN
    RETURN v_case.search_radius_km;
  END IF;
  -- Self-transport cases only need a hospital; there is no crew to wait for.
  v_done := v_case.hospital_id IS NOT NULL
            AND (v_case.transport_mode = 'self' OR v_case.ambulance_id IS NOT NULL);
  IF v_done THEN RETURN v_case.search_radius_km; END IF;
  IF v_case.search_radius_km >= v_case.max_radius_km THEN
    PERFORM public.page_emergency_responders(p_case_id);
    RETURN v_case.search_radius_km;
  END IF;
  IF now() - v_case.radius_expanded_at < make_interval(secs => v_wait) THEN
    RETURN v_case.search_radius_km;
  END IF;

  UPDATE public.emergency_cases
     SET search_radius_km = least(search_radius_km + v_step, max_radius_km),
         radius_expanded_at = now()
   WHERE id = p_case_id RETURNING * INTO v_case;

  INSERT INTO public.emergency_case_events (case_id, kind, payload)
  VALUES (p_case_id, 'radius_expanded', jsonb_build_object('radius_km', v_case.search_radius_km));

  PERFORM public.page_emergency_responders(p_case_id);
  RETURN v_case.search_radius_km;
END $$;

-- Specialist escalation. Wave 1 is the hospital's in-house first choice.
-- Wave 2 is every other in-house doctor of a matching specialty at that
-- hospital. Wave 3 opens it to every matching specialist in the area, who is
-- told which hospital to come to.
CREATE OR REPLACE FUNCTION public.escalate_emergency_specialists(
  p_case_id uuid,
  p_after_seconds integer DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_case public.emergency_cases; v_added integer := 0; v_next integer; v_wait integer;
BEGIN
  v_wait := COALESCE(p_after_seconds, public.emergency_setting('specialist_wave_seconds')::integer, 22);
  SELECT * INTO v_case FROM public.emergency_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND OR v_case.doctor_id IS NOT NULL THEN RETURN 0; END IF;
  -- A signed-in caller must be a party to the case. The background worker runs
  -- with no auth.uid() at all, and is allowed through.
  IF auth.uid() IS NOT NULL AND NOT public.can_see_emergency_case(p_case_id) THEN
    RAISE EXCEPTION 'EMERGENCY_FORBIDDEN: Not a party to this case.';
  END IF;
  IF v_case.doctor_wave >= 3 THEN RETURN 0; END IF;
  IF v_case.doctor_wave_at IS NOT NULL
     AND now() - v_case.doctor_wave_at < make_interval(secs => v_wait) THEN
    RETURN 0;
  END IF;

  v_next := v_case.doctor_wave + 1;
  UPDATE public.emergency_dispatch_targets SET response = 'timeout', responded_at = now()
   WHERE case_id = p_case_id AND target_kind = 'doctor'
     AND wave = v_case.doctor_wave AND response IS NULL;

  IF v_next = 2 THEN
    -- Other in-house doctors at the paged hospitals.
    INSERT INTO public.emergency_dispatch_targets (case_id, target_kind, user_id, hospital_id, wave)
    SELECT DISTINCT ON (s.doctor_id) p_case_id, 'doctor', s.doctor_id, s.hospital_id, 2
      FROM public.hospital_emergency_specialists s
      JOIN public.emergency_dispatch_targets t
        ON t.case_id = p_case_id AND t.target_kind = 'hospital' AND t.hospital_id = s.hospital_id
     WHERE s.active AND s.in_house
       AND EXISTS (SELECT 1 FROM public.emergency_category_specialties m
                    WHERE m.category = v_case.category
                      AND m.specialty = (SELECT specialty FROM public.profiles WHERE id = s.doctor_id))
     ORDER BY s.doctor_id, s.priority
    ON CONFLICT DO NOTHING;
  ELSE
    -- Area-wide broadcast: every matching specialist within the current radius.
    INSERT INTO public.emergency_dispatch_targets
      (case_id, target_kind, user_id, hospital_id, wave, distance_km, radius_km)
    SELECT p_case_id, 'doctor', pr.id, v_case.hospital_id, 3,
           public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, pr.lat, pr.lng),
           v_case.search_radius_km
      FROM public.profiles pr
     WHERE pr.specialty IS NOT NULL
       AND pr.id <> v_case.patient_id
       AND EXISTS (SELECT 1 FROM public.emergency_category_specialties m
                    WHERE m.category = v_case.category AND m.specialty = pr.specialty)
       AND (pr.lat IS NULL OR public.emergency_distance_km(
              v_case.pickup_lat, v_case.pickup_lng, pr.lat, pr.lng) <= greatest(v_case.search_radius_km, 15))
     LIMIT 60
    ON CONFLICT DO NOTHING;
  END IF;
  GET DIAGNOSTICS v_added = ROW_COUNT;

  UPDATE public.emergency_cases SET doctor_wave = v_next, doctor_wave_at = now() WHERE id = p_case_id;
  INSERT INTO public.emergency_case_events (case_id, actor_id, kind, payload)
  VALUES (p_case_id, auth.uid(), 'specialist_wave',
          jsonb_build_object('wave', v_next, 'added', v_added));
  RETURN v_added;
END $$;

-- ------------------------------------------------------------ accept -------
-- First accept wins. SELECT ... FOR UPDATE serialises concurrent taps, so the
-- second caller reads a non-null slot and is turned away.
CREATE OR REPLACE FUNCTION public.accept_emergency_case(
  p_case_id uuid, p_role text,
  p_hospital_id uuid DEFAULT NULL, p_bed_label text DEFAULT NULL
) RETURNS public.emergency_cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_case public.emergency_cases; v_hosp uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EMERGENCY_AUTH_REQUIRED: Sign in before accepting a case.';
  END IF;
  SELECT * INTO v_case FROM public.emergency_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMERGENCY_NOT_FOUND: This case no longer exists.';
  END IF;
  IF v_case.status IN ('cancelled','closed','admitted') THEN
    RAISE EXCEPTION 'EMERGENCY_CLOSED: This case has already ended.';
  END IF;

  IF p_role = 'ambulance' THEN
    IF v_case.transport_mode <> 'ambulance' THEN
      RAISE EXCEPTION 'EMERGENCY_NO_AMBULANCE: This patient is travelling by their own vehicle.';
    END IF;
    IF NOT public.emergency_crew_approved() THEN
      RAISE EXCEPTION 'EMERGENCY_FORBIDDEN: An administrator must approve this account as an ambulance provider.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.emergency_cases
                WHERE ambulance_id = v_uid AND id <> p_case_id
                  AND status IN ('ambulance_en_route','ambulance_arrived','transporting')) THEN
      RAISE EXCEPTION 'EMERGENCY_CREW_BUSY: This crew is already on an active case.';
    END IF;
    IF v_case.ambulance_id IS NOT NULL THEN
      UPDATE public.emergency_dispatch_targets SET response = 'lost', responded_at = now()
       WHERE case_id = p_case_id AND target_kind = 'ambulance' AND user_id = v_uid AND response IS NULL;
      RAISE EXCEPTION 'EMERGENCY_ALREADY_TAKEN: Another crew accepted this case first.';
    END IF;
    UPDATE public.emergency_cases
       SET ambulance_id = v_uid, ambulance_accepted_at = now(),
           status = CASE WHEN status IN ('searching','hospital_assigned')
                         THEN 'ambulance_en_route' ELSE status END
     WHERE id = p_case_id RETURNING * INTO v_case;

  ELSIF p_role = 'hospital' THEN
    v_hosp := p_hospital_id;
    IF v_hosp IS NULL THEN
      SELECT h.id INTO v_hosp FROM public.hospitals h
        JOIN public.emergency_dispatch_targets t
          ON t.hospital_id = h.id AND t.case_id = p_case_id AND t.target_kind = 'hospital'
       WHERE h.owner_id = v_uid LIMIT 1;
    END IF;
    IF v_hosp IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.hospitals h WHERE h.id = v_hosp
        AND (h.owner_id = v_uid OR public.has_role(v_uid,'admin'))) THEN
      RAISE EXCEPTION 'EMERGENCY_FORBIDDEN: This account does not manage a hospital that was paged for this case.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.hospitals h
                    WHERE h.id = v_hosp AND public.hospital_can_treat(h, v_case.category)) THEN
      RAISE EXCEPTION 'EMERGENCY_NO_CAPABILITY: This hospital is not equipped for that category.';
    END IF;
    IF v_case.hospital_id IS NOT NULL THEN
      UPDATE public.emergency_dispatch_targets SET response = 'lost', responded_at = now()
       WHERE case_id = p_case_id AND target_kind = 'hospital' AND hospital_id = v_hosp AND response IS NULL;
      RAISE EXCEPTION 'EMERGENCY_ALREADY_TAKEN: Another hospital accepted this case first.';
    END IF;
    UPDATE public.emergency_cases
       SET hospital_id = v_hosp, hospital_accepted_by = v_uid, hospital_accepted_at = now(),
           bed_label = COALESCE(NULLIF(btrim(COALESCE(p_bed_label,'')),''), bed_label),
           status = CASE WHEN status = 'searching' AND transport_mode = 'self'
                         THEN 'hospital_assigned' ELSE status END
     WHERE id = p_case_id RETURNING * INTO v_case;
    UPDATE public.hospitals SET er_beds_available = greatest(er_beds_available - 1, 0) WHERE id = v_hosp;
    PERFORM public.page_emergency_responders(p_case_id);

  ELSIF p_role = 'doctor' THEN
    IF NOT EXISTS (SELECT 1 FROM public.emergency_dispatch_targets
                    WHERE case_id = p_case_id AND target_kind = 'doctor' AND user_id = v_uid)
       AND NOT public.has_role(v_uid,'admin') THEN
      RAISE EXCEPTION 'EMERGENCY_FORBIDDEN: This case was not offered to this account.';
    END IF;
    IF v_case.doctor_id IS NOT NULL THEN
      UPDATE public.emergency_dispatch_targets SET response = 'lost', responded_at = now()
       WHERE case_id = p_case_id AND target_kind = 'doctor' AND user_id = v_uid AND response IS NULL;
      RAISE EXCEPTION 'EMERGENCY_ALREADY_TAKEN: Another specialist accepted this case first.';
    END IF;
    UPDATE public.emergency_cases SET doctor_id = v_uid, doctor_accepted_at = now()
     WHERE id = p_case_id RETURNING * INTO v_case;

  ELSE
    RAISE EXCEPTION 'EMERGENCY_BAD_ROLE: Unknown responder role.';
  END IF;

  UPDATE public.emergency_dispatch_targets SET response = 'accepted', responded_at = now()
   WHERE case_id = p_case_id AND target_kind = p_role::public.emergency_target_kind
     AND (user_id = v_uid OR hospital_id = v_hosp);
  INSERT INTO public.emergency_case_events (case_id, actor_id, kind, payload)
  VALUES (p_case_id, v_uid, p_role || '_accepted',
          jsonb_build_object('hospital_id', v_hosp, 'bed', v_case.bed_label));
  RETURN v_case;
END $$;

-- A responder can pass on a case. Declining removes it from their queue without
-- touching anyone else's.
CREATE OR REPLACE FUNCTION public.decline_emergency_case(p_case_id uuid, p_role text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.emergency_dispatch_targets
     SET response = 'declined', responded_at = now()
   WHERE case_id = p_case_id
     AND target_kind = p_role::public.emergency_target_kind
     AND (user_id = auth.uid()
          OR hospital_id IN (SELECT id FROM public.hospitals WHERE owner_id = auth.uid()))
     AND response IS NULL;
$$;

-- --------------------------------------------------------- status moves ----
CREATE OR REPLACE FUNCTION public.advance_emergency_case(
  p_case_id uuid, p_status public.emergency_case_status, p_reason text DEFAULT NULL
) RETURNS public.emergency_cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_case public.emergency_cases; v_allowed boolean;
BEGIN
  SELECT * INTO v_case FROM public.emergency_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMERGENCY_NOT_FOUND: This case no longer exists.';
  END IF;
  v_allowed := CASE p_status
    WHEN 'cancelled'          THEN v_case.patient_id = v_uid OR public.has_role(v_uid,'admin')
    WHEN 'ambulance_en_route' THEN v_case.ambulance_id = v_uid
    WHEN 'ambulance_arrived'  THEN v_case.ambulance_id = v_uid
    WHEN 'transporting'       THEN v_case.ambulance_id = v_uid
    WHEN 'admitted'           THEN v_case.hospital_accepted_by = v_uid OR v_case.doctor_id = v_uid
                                   OR public.has_role(v_uid,'admin')
    WHEN 'closed'             THEN v_case.hospital_accepted_by = v_uid OR public.has_role(v_uid,'admin')
    ELSE false END;
  IF NOT COALESCE(v_allowed,false) THEN
    RAISE EXCEPTION 'EMERGENCY_FORBIDDEN: This account cannot move the case to that state.';
  END IF;
  IF v_case.status IN ('cancelled','closed') THEN
    RAISE EXCEPTION 'EMERGENCY_CLOSED: This case has already ended.';
  END IF;
  UPDATE public.emergency_cases
     SET status = p_status,
         cancelled_reason = CASE WHEN p_status='cancelled' THEN p_reason ELSE cancelled_reason END,
         ambulance_arrived_at = CASE WHEN p_status='ambulance_arrived' THEN now() ELSE ambulance_arrived_at END,
         closed_at = CASE WHEN p_status IN ('cancelled','closed','admitted') THEN now() ELSE closed_at END
   WHERE id = p_case_id RETURNING * INTO v_case;
  INSERT INTO public.emergency_case_events (case_id, actor_id, kind, payload)
  VALUES (p_case_id, v_uid, 'status_' || p_status, jsonb_build_object('reason', p_reason));
  RETURN v_case;
END $$;

-- ------------------------------------------------------------- GPS ---------
CREATE OR REPLACE FUNCTION public.post_emergency_ambulance_ping(
  p_case_id uuid, p_lat double precision, p_lng double precision,
  p_accuracy_m double precision DEFAULT NULL, p_heading_deg double precision DEFAULT NULL,
  p_speed_kph double precision DEFAULT NULL, p_captured_at timestamptz DEFAULT NULL
) RETURNS public.emergency_ambulance_pings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_case public.emergency_cases;
        v_row public.emergency_ambulance_pings; v_km double precision; v_eta integer;
BEGIN
  SELECT * INTO v_case FROM public.emergency_cases WHERE id = p_case_id;
  IF NOT FOUND OR v_case.ambulance_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'EMERGENCY_FORBIDDEN: Only the assigned crew can share location for this case.';
  END IF;
  IF v_case.status NOT IN ('ambulance_en_route','ambulance_arrived','transporting') THEN
    RAISE EXCEPTION 'EMERGENCY_CLOSED: This case is not active.';
  END IF;
  IF p_captured_at IS NOT NULL AND p_captured_at > now() + interval '2 minutes' THEN
    RAISE EXCEPTION 'EMERGENCY_BAD_CLOCK: Device clock is ahead of the server. Fix the time before sharing GPS.';
  END IF;

  -- ETA from straight-line distance at the crew's own reported speed, floored
  -- at 18 km/h for city traffic. Rough by design; never presented as exact.
  v_km := public.emergency_distance_km(p_lat, p_lng, v_case.pickup_lat, v_case.pickup_lng);
  v_eta := CASE WHEN v_km IS NULL THEN NULL
                ELSE greatest(30, (v_km / greatest(COALESCE(p_speed_kph,0), 18) * 3600)::integer) END;

  INSERT INTO public.emergency_ambulance_pings
    (case_id, provider_id, lat, lng, accuracy_m, heading_deg, speed_kph, eta_seconds, captured_at)
  VALUES (p_case_id, v_uid, p_lat, p_lng, p_accuracy_m, p_heading_deg, p_speed_kph, v_eta,
          COALESCE(p_captured_at, now()))
  RETURNING * INTO v_row;

  UPDATE public.emergency_cases SET ambulance_eta_seconds = v_eta WHERE id = p_case_id;
  RETURN v_row;
END $$;

-- ----------------------------------------------------- responder queue -----
CREATE OR REPLACE FUNCTION public.list_emergency_dispatch_queue(p_role text)
RETURNS SETOF public.emergency_cases
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.* FROM public.emergency_cases c
   WHERE c.status NOT IN ('cancelled','closed','admitted')
     AND (
       (p_role = 'ambulance' AND (
          c.ambulance_id = auth.uid()
          OR (c.ambulance_id IS NULL AND EXISTS (
                SELECT 1 FROM public.emergency_dispatch_targets t
                 WHERE t.case_id = c.id AND t.target_kind='ambulance'
                   AND t.user_id = auth.uid() AND t.response IS DISTINCT FROM 'declined'))))
       OR (p_role = 'hospital' AND (
          EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id=c.hospital_id AND h.owner_id=auth.uid())
          OR (c.hospital_id IS NULL AND EXISTS (
                SELECT 1 FROM public.emergency_dispatch_targets t
                  JOIN public.hospitals h ON h.id=t.hospital_id
                 WHERE t.case_id=c.id AND t.target_kind='hospital'
                   AND h.owner_id=auth.uid() AND t.response IS DISTINCT FROM 'declined'))))
       OR (p_role = 'doctor' AND (
          c.doctor_id = auth.uid()
          OR (c.doctor_id IS NULL AND EXISTS (
                SELECT 1 FROM public.emergency_dispatch_targets t
                 WHERE t.case_id=c.id AND t.target_kind='doctor'
                   AND t.user_id=auth.uid() AND t.response IS DISTINCT FROM 'declined'))))
     )
   ORDER BY c.created_at ASC LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_responder(
  p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles
     SET last_seen_at = now(), lat = COALESCE(p_lat, lat), lng = COALESCE(p_lng, lng)
   WHERE id = auth.uid();
$$;

-- ------------------------------------------------------------- RLS ---------
ALTER TABLE public.emergency_cases              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_dispatch_targets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_case_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_ambulance_pings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_emergency_specialists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_category_specialties ENABLE ROW LEVEL SECURITY;

-- Read-only tables. Every write goes through the functions above, so no client
-- can sidestep the accept lock with a direct UPDATE.
GRANT SELECT ON public.emergency_cases, public.emergency_dispatch_targets,
                public.emergency_case_events, public.emergency_ambulance_pings,
                public.hospital_emergency_specialists, public.emergency_category_specialties
  TO authenticated;
GRANT ALL ON public.emergency_cases, public.emergency_dispatch_targets,
             public.emergency_case_events, public.emergency_ambulance_pings,
             public.hospital_emergency_specialists, public.emergency_category_specialties
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.emergency_ambulance_pings_id_seq TO service_role;

DROP POLICY IF EXISTS "emergency cases readable to parties" ON public.emergency_cases;
CREATE POLICY "emergency cases readable to parties" ON public.emergency_cases
  FOR SELECT TO authenticated USING (public.can_see_emergency_case(id));
DROP POLICY IF EXISTS "emergency targets readable to parties" ON public.emergency_dispatch_targets;
CREATE POLICY "emergency targets readable to parties" ON public.emergency_dispatch_targets
  FOR SELECT TO authenticated USING (public.can_see_emergency_case(case_id));
DROP POLICY IF EXISTS "emergency events readable to parties" ON public.emergency_case_events;
CREATE POLICY "emergency events readable to parties" ON public.emergency_case_events
  FOR SELECT TO authenticated USING (public.can_see_emergency_case(case_id));
DROP POLICY IF EXISTS "emergency pings readable to parties" ON public.emergency_ambulance_pings;
CREATE POLICY "emergency pings readable to parties" ON public.emergency_ambulance_pings
  FOR SELECT TO authenticated USING (public.can_see_emergency_case(case_id));
DROP POLICY IF EXISTS "specialist roster readable" ON public.hospital_emergency_specialists;
CREATE POLICY "specialist roster readable" ON public.hospital_emergency_specialists
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "hospital manages own roster" ON public.hospital_emergency_specialists;
CREATE POLICY "hospital manages own roster" ON public.hospital_emergency_specialists
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')
         OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id=hospital_id AND h.owner_id=auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin')
         OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id=hospital_id AND h.owner_id=auth.uid()));
GRANT INSERT, UPDATE, DELETE ON public.hospital_emergency_specialists TO authenticated;
DROP POLICY IF EXISTS "category map readable" ON public.emergency_category_specialties;
CREATE POLICY "category map readable" ON public.emergency_category_specialties
  FOR SELECT TO authenticated USING (true);

DO $$ BEGIN EXECUTE 'ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN others THEN NULL; END $$;
DROP POLICY IF EXISTS "hospitals readable" ON public.hospitals;
CREATE POLICY "hospitals readable" ON public.hospitals FOR SELECT USING (true);
DROP POLICY IF EXISTS "hospital owner updates own row" ON public.hospitals;
CREATE POLICY "hospital owner updates own row" ON public.hospitals
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
GRANT SELECT ON public.hospitals TO anon, authenticated;
GRANT UPDATE ON public.hospitals TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_emergency_case(
  public.emergency_category, jsonb, double precision, double precision,
  double precision, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emergency_setting(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_emergency_case(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_emergency_case(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_emergency_case(uuid, public.emergency_case_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expand_emergency_search(uuid, integer, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_emergency_specialists(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.page_emergency_responders(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_emergency_ambulance_ping(
  uuid, double precision, double precision, double precision, double precision,
  double precision, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_emergency_dispatch_queue(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_responder(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_emergency_case(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emergency_profile_ready(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emergency_distance_km(
  double precision, double precision, double precision, double precision) TO authenticated, anon;

-- -------------------------------------------------------- realtime ---------
ALTER TABLE public.emergency_cases            REPLICA IDENTITY FULL;
ALTER TABLE public.emergency_dispatch_targets REPLICA IDENTITY FULL;
ALTER TABLE public.emergency_ambulance_pings  REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_cases;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_dispatch_targets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_ambulance_pings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------ background worker --
-- Escalation must not depend on the patient's phone staying awake. A screen
-- that sleeps at 3am would otherwise freeze the search at 4 km. This runs
-- server-side; the client-side timers become a redundant second path.
CREATE OR REPLACE FUNCTION public.emergency_tick()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_touched integer := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.emergency_cases
     WHERE status IN ('searching','hospital_assigned')
       AND created_at > now() - interval '6 hours'
     ORDER BY created_at
     LIMIT 200
  LOOP
    BEGIN
      PERFORM public.expand_emergency_search(v_id);
      PERFORM public.escalate_emergency_specialists(v_id);
      v_touched := v_touched + 1;
    EXCEPTION WHEN others THEN
      -- One bad case must never stop the rest of the queue from escalating.
      INSERT INTO public.emergency_case_events (case_id, kind, payload)
      VALUES (v_id, 'tick_error', jsonb_build_object('message', SQLERRM));
    END;
  END LOOP;
  RETURN v_touched;
END $$;

REVOKE ALL ON FUNCTION public.emergency_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emergency_tick() TO service_role;

GRANT SELECT ON public.emergency_settings TO authenticated;
GRANT ALL ON public.emergency_settings TO service_role;
ALTER TABLE public.emergency_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings readable" ON public.emergency_settings;
CREATE POLICY "settings readable" ON public.emergency_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin tunes settings" ON public.emergency_settings;
CREATE POLICY "admin tunes settings" ON public.emergency_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT UPDATE ON public.emergency_settings TO authenticated;

-- ============================================================================
-- Hardening. Everything below either replaces a definition above or adds a
-- guard that the first pass did not have. Last definition in the file wins.
-- ============================================================================

-- ------------------------------------------- ambulance approval compat -----
-- The live project has is_approved_ambulance_provider() from the older
-- ambulance module, but that module has no migration in this repo, so a
-- database built from the staging baseline does not have it.
--
-- Do NOT create it here. Another file (supabase/manual/AMBULANCE_MANUAL_ACCEPTANCE.sql)
-- creates it with a plain CREATE FUNCTION, and whichever ran second would fail
-- with "already exists". Look it up at call time instead, and fall back to an
-- equivalent rule when it is genuinely absent. That way this module works on a
-- bare staging database and defers to the stricter production definition
-- wherever it exists.
CREATE OR REPLACE FUNCTION public.emergency_crew_approved()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  IF to_regprocedure('public.is_approved_ambulance_provider()') IS NOT NULL THEN
    EXECUTE 'SELECT public.is_approved_ambulance_provider()' INTO v_ok;
    RETURN COALESCE(v_ok, false);
  END IF;
  RETURN EXISTS (
    SELECT 1
      FROM public.account_role_requests r
      JOIN public.profiles p ON p.id = r.user_id
     WHERE r.user_id = auth.uid()
       AND r.status = 'approved'
       AND r.requested_role = 'provider'
       AND COALESCE(r.requested_view, p.view) = 'ambulance'
  ) OR public.has_role(auth.uid(), 'admin');
END $$;

-- ------------------------------------------------------ bed/bay control ----
-- A hospital may run several cases at once, but the same bay cannot be
-- promised to two patients. Labels are compared case- and space-insensitively.
CREATE UNIQUE INDEX IF NOT EXISTS emergency_bed_held_once
  ON public.emergency_cases (hospital_id, lower(btrim(bed_label)))
  WHERE bed_label IS NOT NULL
    AND status IN ('searching','hospital_assigned','ambulance_en_route',
                   'ambulance_arrived','transporting','handed_over');

-- ---------------------------------------------------------- paging gate ----
-- Replaces the earlier version: a case with no usable location must not match
-- anyone by distance. It waits for GPS or for an operator to confirm pickup.
CREATE OR REPLACE FUNCTION public.page_emergency_responders(p_case_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_case public.emergency_cases; v_added integer := 0; v_n integer;
BEGIN
  SELECT * INTO v_case FROM public.emergency_cases WHERE id = p_case_id;
  IF NOT FOUND OR v_case.status NOT IN ('searching','hospital_assigned','ambulance_en_route',
                                        'ambulance_arrived','transporting') THEN
    RETURN 0;
  END IF;
  -- No coordinates means no honest distance. Do not guess a city centre.
  IF v_case.location_status = 'needs_location' THEN RETURN 0; END IF;

  IF v_case.ambulance_id IS NULL AND v_case.transport_mode = 'ambulance' THEN
    INSERT INTO public.emergency_dispatch_targets
      (case_id, target_kind, user_id, distance_km, wave, radius_km)
    SELECT p_case_id, 'ambulance', pr.id,
           public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, pr.lat, pr.lng),
           1, v_case.search_radius_km
      FROM public.profiles pr
     WHERE pr.view = 'ambulance'
       AND pr.id <> v_case.patient_id
       AND pr.last_seen_at > now() - interval '3 minutes'
       AND public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, pr.lat, pr.lng)
           <= v_case.search_radius_km
     ORDER BY public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, pr.lat, pr.lng)
     LIMIT 25
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_added := v_added + v_n;
  END IF;

  IF v_case.hospital_id IS NULL THEN
    INSERT INTO public.emergency_dispatch_targets
      (case_id, target_kind, hospital_id, distance_km, wave, radius_km)
    SELECT p_case_id, 'hospital', h.id,
           public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, h.lat, h.lng),
           1, v_case.search_radius_km
      FROM public.hospitals h
     WHERE h.emergency = true AND h.emergency_mode = true
       AND public.hospital_can_treat(h, v_case.category)
       AND public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, h.lat, h.lng)
           <= v_case.search_radius_km
     ORDER BY public.emergency_distance_km(v_case.pickup_lat, v_case.pickup_lng, h.lat, h.lng)
     LIMIT 15
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_added := v_added + v_n;
  END IF;

  IF v_case.doctor_id IS NULL AND v_case.doctor_wave <= 1 THEN
    INSERT INTO public.emergency_dispatch_targets
      (case_id, target_kind, user_id, hospital_id, wave, radius_km)
    SELECT DISTINCT ON (s.doctor_id)
           p_case_id, 'doctor', s.doctor_id, s.hospital_id, 1, v_case.search_radius_km
      FROM public.hospital_emergency_specialists s
      JOIN public.emergency_dispatch_targets t
        ON t.case_id = p_case_id AND t.target_kind = 'hospital' AND t.hospital_id = s.hospital_id
     WHERE s.category = v_case.category AND s.active AND s.in_house
     ORDER BY s.doctor_id, s.priority
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_added := v_added + v_n;
    IF v_case.doctor_wave = 0 THEN
      UPDATE public.emergency_cases SET doctor_wave = 1, doctor_wave_at = now() WHERE id = p_case_id;
    END IF;
  END IF;

  IF v_added > 0 THEN
    INSERT INTO public.emergency_case_events (case_id, kind, payload)
    VALUES (p_case_id, 'responders_paged',
            jsonb_build_object('added', v_added, 'radius_km', v_case.search_radius_km));
  END IF;
  RETURN v_added;
END $$;

-- -------------------------------------------------------------- create -----
-- Replaces the earlier version. Adds the idempotency key, the cutover gate and
-- the no-GPS path.
CREATE OR REPLACE FUNCTION public.create_emergency_case(
  p_category    public.emergency_category,
  p_triage      jsonb DEFAULT '[]'::jsonb,
  p_lat         double precision DEFAULT NULL,
  p_lng         double precision DEFAULT NULL,
  p_accuracy_m  double precision DEFAULT NULL,
  p_captured_at timestamptz DEFAULT NULL,
  p_transport   text DEFAULT 'ambulance',
  p_request_key uuid DEFAULT NULL
) RETURNS public.emergency_cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_case public.emergency_cases; v_p public.profiles;
  v_key uuid := COALESCE(p_request_key, gen_random_uuid());
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EMERGENCY_AUTH_REQUIRED: Sign in to raise an emergency. Call 108 now if this cannot wait.';
  END IF;
  IF NOT COALESCE((SELECT dispatch_enabled FROM public.emergency_settings WHERE id = 1), false) THEN
    RAISE EXCEPTION 'EMERGENCY_DISABLED: Coordinated dispatch is switched off on this environment. Call 108.';
  END IF;
  IF p_transport NOT IN ('ambulance','self') THEN
    RAISE EXCEPTION 'EMERGENCY_BAD_TRANSPORT: Choose whether an ambulance is coming or you are driving yourself.';
  END IF;

  -- Same key, same case. A retry after a dropped response is free.
  SELECT * INTO v_case FROM public.emergency_cases
   WHERE patient_id = v_uid AND request_key = v_key;
  IF FOUND THEN RETURN v_case; END IF;

  SELECT * INTO v_case FROM public.emergency_cases
   WHERE patient_id = v_uid AND status NOT IN ('cancelled','closed','admitted')
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_case; END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = v_uid;
  -- Losing GPS must not lose the emergency. Save it, flag it, let an operator
  -- confirm the pickup by phone.
  v_status := CASE WHEN p_lat IS NULL OR p_lng IS NULL THEN 'needs_location' ELSE 'gps' END;

  INSERT INTO public.emergency_cases (
    patient_id, request_key, category, triage, transport_mode,
    patient_name, patient_phone,
    contact_1_name, contact_1_phone, contact_2_name, contact_2_phone,
    blood_group, allergies, conditions, medications,
    pickup_lat, pickup_lng, pickup_accuracy_m, pickup_captured_at, location_status,
    needs_attention
  ) VALUES (
    v_uid, v_key, p_category, COALESCE(p_triage,'[]'::jsonb), p_transport,
    COALESCE(v_p.full_name,'Patient'), v_p.phone,
    v_p.emergency_contact_1_name, v_p.emergency_contact_1_phone,
    v_p.emergency_contact_2_name, v_p.emergency_contact_2_phone,
    v_p.blood_group, COALESCE(v_p.allergies,'{}'), COALESCE(v_p.conditions,'{}'),
    COALESCE(v_p.medications,'{}'),
    p_lat, p_lng, p_accuracy_m,
    CASE WHEN p_lat IS NULL THEN NULL ELSE COALESCE(p_captured_at, now()) END,
    v_status,
    v_status = 'needs_location' OR v_p.phone IS NULL OR length(btrim(COALESCE(v_p.phone,''))) < 8
  ) RETURNING * INTO v_case;

  INSERT INTO public.emergency_case_events (case_id, actor_id, kind, payload)
  VALUES (v_case.id, v_uid, 'case_created',
          jsonb_build_object('category', p_category, 'transport', p_transport,
                             'location_status', v_status));

  PERFORM public.page_emergency_responders(v_case.id);
  SELECT * INTO v_case FROM public.emergency_cases WHERE id = v_case.id;
  RETURN v_case;
END $$;

-- An operator or the patient's own retry supplies a pickup for a case that was
-- saved without one. Matching starts the moment it lands.
CREATE OR REPLACE FUNCTION public.set_emergency_pickup(
  p_case_id uuid, p_lat double precision, p_lng double precision,
  p_accuracy_m double precision DEFAULT NULL,
  p_captured_at timestamptz DEFAULT NULL,
  p_verified boolean DEFAULT false
) RETURNS public.emergency_cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_case public.emergency_cases;
BEGIN
  SELECT * INTO v_case FROM public.emergency_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMERGENCY_NOT_FOUND: This case no longer exists.';
  END IF;
  -- The patient may correct their own pin; only an admin may enter one on a
  -- caller's behalf, and it is recorded as operator-verified, not as GPS.
  IF v_case.patient_id <> v_uid AND NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'EMERGENCY_FORBIDDEN: Only the patient or an operator can set the pickup.';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'EMERGENCY_NO_LOCATION: A pickup position is required.';
  END IF;
  IF v_case.status IN ('cancelled','closed','admitted') THEN
    RAISE EXCEPTION 'EMERGENCY_CLOSED: This case has already ended.';
  END IF;

  UPDATE public.emergency_cases
     SET pickup_lat = p_lat, pickup_lng = p_lng, pickup_accuracy_m = p_accuracy_m,
         pickup_captured_at = COALESCE(p_captured_at, now()),
         location_status = CASE WHEN p_verified OR v_case.patient_id <> v_uid
                                THEN 'verified' ELSE 'gps' END,
         pickup_set_by = v_uid
   WHERE id = p_case_id RETURNING * INTO v_case;

  INSERT INTO public.emergency_case_events (case_id, actor_id, kind, payload)
  VALUES (p_case_id, v_uid, 'pickup_set',
          jsonb_build_object('location_status', v_case.location_status));
  PERFORM public.page_emergency_responders(p_case_id);
  SELECT * INTO v_case FROM public.emergency_cases WHERE id = p_case_id;
  RETURN v_case;
END $$;

-- ------------------------------------------------------- status moves ------
-- Replaces the earlier version. Adds the handover step, and refuses to start a
-- transport with nowhere to transport to.
CREATE OR REPLACE FUNCTION public.advance_emergency_case(
  p_case_id uuid, p_status public.emergency_case_status, p_reason text DEFAULT NULL
) RETURNS public.emergency_cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_case public.emergency_cases; v_allowed boolean;
BEGIN
  SELECT * INTO v_case FROM public.emergency_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMERGENCY_NOT_FOUND: This case no longer exists.';
  END IF;
  v_allowed := CASE p_status
    WHEN 'cancelled'          THEN v_case.patient_id = v_uid OR public.has_role(v_uid,'admin')
    WHEN 'ambulance_en_route' THEN v_case.ambulance_id = v_uid
    WHEN 'ambulance_arrived'  THEN v_case.ambulance_id = v_uid
    WHEN 'transporting'       THEN v_case.ambulance_id = v_uid
    WHEN 'handed_over'        THEN v_case.ambulance_id = v_uid
    -- The hospital confirms admission, not the patient screen and not the crew.
    WHEN 'admitted'           THEN v_case.hospital_accepted_by = v_uid
                                   OR EXISTS (SELECT 1 FROM public.hospitals h
                                               WHERE h.id = v_case.hospital_id AND h.owner_id = v_uid)
                                   OR public.has_role(v_uid,'admin')
    WHEN 'closed'             THEN v_case.hospital_accepted_by = v_uid OR public.has_role(v_uid,'admin')
    ELSE false END;
  IF NOT COALESCE(v_allowed,false) THEN
    RAISE EXCEPTION 'EMERGENCY_FORBIDDEN: This account cannot move the case to that state.';
  END IF;
  IF v_case.status IN ('cancelled','closed') THEN
    RAISE EXCEPTION 'EMERGENCY_CLOSED: This case has already ended.';
  END IF;
  IF p_status = 'transporting' AND v_case.hospital_id IS NULL THEN
    RAISE EXCEPTION 'EMERGENCY_NO_RECEIVER: No hospital has accepted yet. Do not start transport without a receiving hospital.';
  END IF;

  UPDATE public.emergency_cases
     SET status = p_status,
         cancelled_reason = CASE WHEN p_status='cancelled' THEN p_reason ELSE cancelled_reason END,
         ambulance_arrived_at = CASE WHEN p_status='ambulance_arrived' THEN now() ELSE ambulance_arrived_at END,
         handed_over_at = CASE WHEN p_status='handed_over' THEN now() ELSE handed_over_at END,
         closed_at = CASE WHEN p_status IN ('cancelled','closed','admitted') THEN now() ELSE closed_at END
   WHERE id = p_case_id RETURNING * INTO v_case;
  INSERT INTO public.emergency_case_events (case_id, actor_id, kind, payload)
  VALUES (p_case_id, v_uid, 'status_' || p_status, jsonb_build_object('reason', p_reason));
  RETURN v_case;
END $$;

-- ---------------------------------------------------------- cutover --------
-- Refuses to switch on while the old ambulance-only queue still has live jobs,
-- so two competing dispatch systems can never run against the same crews.
CREATE OR REPLACE FUNCTION public.set_emergency_dispatch_enabled(p_on boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_legacy integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'EMERGENCY_FORBIDDEN: Only an administrator can change this.';
  END IF;
  IF p_on AND to_regclass('public.ambulance_requests') IS NOT NULL THEN
    EXECUTE $q$SELECT count(*) FROM public.ambulance_requests
                WHERE status IN ('requested','accepted','en_route','arrived')$q$
      INTO v_legacy;
    IF v_legacy > 0 THEN
      RAISE EXCEPTION 'EMERGENCY_LEGACY_ACTIVE: Finish or cancel the % active ambulance request(s) in the old queue before switching over.', v_legacy;
    END IF;
  END IF;
  UPDATE public.emergency_settings
     SET dispatch_enabled = p_on, dispatch_enabled_at = now(), updated_at = now()
   WHERE id = 1;
  RETURN p_on;
END $$;

-- --------------------------------------------------- worker heartbeat ------
CREATE OR REPLACE FUNCTION public.emergency_tick()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_touched integer := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.emergency_cases
     WHERE status IN ('searching','hospital_assigned')
       AND location_status <> 'needs_location'
       AND created_at > now() - interval '6 hours'
     ORDER BY created_at
     LIMIT 200
  LOOP
    BEGIN
      PERFORM public.expand_emergency_search(v_id);
      PERFORM public.escalate_emergency_specialists(v_id);
      v_touched := v_touched + 1;
    EXCEPTION WHEN others THEN
      INSERT INTO public.emergency_case_events (case_id, kind, payload)
      VALUES (v_id, 'tick_error', jsonb_build_object('message', SQLERRM));
    END;
  END LOOP;
  UPDATE public.emergency_settings
     SET last_tick_at = now(), last_tick_cases = v_touched WHERE id = 1;
  RETURN v_touched;
END $$;
REVOKE ALL ON FUNCTION public.emergency_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emergency_tick() TO service_role;

GRANT EXECUTE ON FUNCTION public.create_emergency_case(
  public.emergency_category, jsonb, double precision, double precision,
  double precision, timestamptz, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_emergency_pickup(
  uuid, double precision, double precision, double precision, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_emergency_dispatch_enabled(boolean) TO authenticated;

-- ------------------------------------------------- lock down execution -----
-- Postgres grants EXECUTE to PUBLIC on every new function, and anon inherits
-- that. A SECURITY DEFINER function reachable by anon is a privilege hole even
-- when it checks auth.uid() internally, so revoke PUBLIC across the whole
-- module and keep only the explicit grants made above. The trigger function is
-- revoked from authenticated too: a trigger is not an RPC.
DO $$
DECLARE v_fn record;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure AS sig, p.prorettype = 'trigger'::regtype AS is_trigger
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'emergency_profile_ready','can_see_emergency_case','page_emergency_responders',
         'create_emergency_case','expand_emergency_search','escalate_emergency_specialists',
         'accept_emergency_case','decline_emergency_case','advance_emergency_case',
         'post_emergency_ambulance_ping','list_emergency_dispatch_queue','heartbeat_responder',
         'emergency_setting','emergency_tick','emergency_touch','hospital_can_treat',
         'emergency_crew_approved','set_emergency_pickup',
         'set_emergency_dispatch_enabled')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', v_fn.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', v_fn.sig);
    IF v_fn.is_trigger THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', v_fn.sig);
    END IF;
  END LOOP;
END $$;

-- hospital_can_treat is a plain helper used inside the definer functions above;
-- the UI never calls it directly.
GRANT EXECUTE ON FUNCTION public.hospital_can_treat(
  public.hospitals, public.emergency_category) TO authenticated;

-- ------------------------------------------- remove superseded overload ----
-- The hardening section above adds p_request_key, which changes the signature.
-- CREATE OR REPLACE cannot replace a function whose argument list differs, so
-- it created a second overload instead. Any call passing fewer than eight
-- arguments then matched both and failed with "function is not unique" - which
-- is exactly the error the patient screen hit. Drop the older seven-argument
-- version and keep the idempotency-key one.
DROP FUNCTION IF EXISTS public.create_emergency_case(
  public.emergency_category, jsonb, double precision, double precision,
  double precision, timestamptz, text);

GRANT EXECUTE ON FUNCTION public.create_emergency_case(
  public.emergency_category, jsonb, double precision, double precision,
  double precision, timestamptz, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.create_emergency_case(
  public.emergency_category, jsonb, double precision, double precision,
  double precision, timestamptz, text, uuid) FROM PUBLIC, anon;

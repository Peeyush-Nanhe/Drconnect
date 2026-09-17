-- ============================================================================
-- Care staff module, part 1 of 3: who the staff are and when they will work.
--
-- Handover section 6.1. Additive only: new tables, and new columns with
-- defaults on existing ones. Nothing is dropped, renamed or retyped.
--
-- Availability lives on the staff row rather than provider_availability
-- because matching needs travel radius, minimum pay, quiet hours and working
-- days together in one filter, and the doctor availability table has none of
-- those.
-- ============================================================================

-- --------------------------------------------------------------- nurses ----
CREATE TABLE IF NOT EXISTS public.nurses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           text NOT NULL,
  phone               text,
  skills              text[] NOT NULL DEFAULT '{}',
  specialty           text,
  qualification       text,
  shifts              text[] NOT NULL DEFAULT '{}',
  areas               text[] NOT NULL DEFAULT '{}',
  city                text NOT NULL DEFAULT 'Pune',
  registration_number text,
  experience_years    integer NOT NULL DEFAULT 0,

  home_care           boolean NOT NULL DEFAULT true,
  hospital_duty       boolean NOT NULL DEFAULT false,
  locum_available     boolean NOT NULL DEFAULT false,
  available_today     boolean NOT NULL DEFAULT true,

  travel_radius_km    numeric NOT NULL DEFAULT 11,
  minimum_pay         integer NOT NULL DEFAULT 0,
  max_hours_per_day   integer NOT NULL DEFAULT 12,
  -- 0 = Sunday, matching extract(dow).
  working_days        integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',

  dnd_enabled         boolean NOT NULL DEFAULT false,
  dnd_start           time NOT NULL DEFAULT time '22:00',
  dnd_end             time NOT NULL DEFAULT time '07:00',
  dnd_allow_emergency boolean NOT NULL DEFAULT true,

  notification_preferences jsonb NOT NULL DEFAULT '{"push":true,"sms":false}'::jsonb,
  recent_courses      text[] NOT NULL DEFAULT '{}',
  special_interests   text[] NOT NULL DEFAULT '{}',

  verified            boolean NOT NULL DEFAULT false,
  active              boolean NOT NULL DEFAULT true,
  is_online           boolean NOT NULL DEFAULT false,
  lat                 double precision,
  lng                 double precision,
  last_location_at    timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.nurses TO authenticated;
GRANT ALL ON public.nurses TO service_role;
ALTER TABLE public.nurses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nurse reads own row" ON public.nurses;
CREATE POLICY "nurse reads own row" ON public.nurses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "nurse creates own row" ON public.nurses;
CREATE POLICY "nurse creates own row" ON public.nurses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- Verification is never self-granted: the WITH CHECK keeps the caller's own
-- verified flag at whatever it already is.
DROP POLICY IF EXISTS "nurse edits own row" ON public.nurses;
CREATE POLICY "nurse edits own row" ON public.nurses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS nurses_roster_idx
  ON public.nurses (active, verified, is_online) WHERE active AND verified;
CREATE INDEX IF NOT EXISTS nurses_city_idx ON public.nurses (city);

-- ---------------------------------------------------------- technicians ----
-- technician_visits is referenced by src/lib/technician-provider.functions.ts
-- but no technician table exists in this chain, so the roster is created here.
CREATE TABLE IF NOT EXISTS public.technicians (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           text NOT NULL,
  phone               text,
  tests               text[] NOT NULL DEFAULT '{}',
  qualification       text,
  areas               text[] NOT NULL DEFAULT '{}',
  city                text NOT NULL DEFAULT 'Pune',
  home_visits         boolean NOT NULL DEFAULT true,
  clinic_visits       boolean NOT NULL DEFAULT true,
  pickup_hub_ids      uuid[] NOT NULL DEFAULT '{}',
  travel_radius_km    numeric NOT NULL DEFAULT 11,
  minimum_pay         integer NOT NULL DEFAULT 0,
  max_hours_per_day   integer NOT NULL DEFAULT 10,
  working_days        integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  dnd_enabled         boolean NOT NULL DEFAULT false,
  dnd_start           time NOT NULL DEFAULT time '22:00',
  dnd_end             time NOT NULL DEFAULT time '07:00',
  dnd_allow_emergency boolean NOT NULL DEFAULT true,
  notification_preferences jsonb NOT NULL DEFAULT '{"push":true,"sms":false}'::jsonb,
  recent_courses      text[] NOT NULL DEFAULT '{}',
  special_interests   text[] NOT NULL DEFAULT '{}',
  verified            boolean NOT NULL DEFAULT false,
  active              boolean NOT NULL DEFAULT true,
  is_online           boolean NOT NULL DEFAULT false,
  available_today     boolean NOT NULL DEFAULT true,
  lat                 double precision,
  lng                 double precision,
  last_location_at    timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.technicians TO authenticated;
GRANT ALL ON public.technicians TO service_role;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "technician reads own row" ON public.technicians;
CREATE POLICY "technician reads own row" ON public.technicians
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "technician creates own row" ON public.technicians;
CREATE POLICY "technician creates own row" ON public.technicians
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "technician edits own row" ON public.technicians;
CREATE POLICY "technician edits own row" ON public.technicians
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS technicians_roster_idx
  ON public.technicians (active, verified, is_online) WHERE active AND verified;

-- ----------------------------------------------- physio_therapists extra ----
ALTER TABLE public.physio_therapists
  ADD COLUMN IF NOT EXISTS therapies           text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS home_visits         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS clinic_visits       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_today     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_online           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS travel_radius_km    numeric NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS minimum_pay         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_hours_per_day   integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS working_days        integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  ADD COLUMN IF NOT EXISTS dnd_enabled         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dnd_start           time NOT NULL DEFAULT time '22:00',
  ADD COLUMN IF NOT EXISTS dnd_end             time NOT NULL DEFAULT time '07:00',
  ADD COLUMN IF NOT EXISTS dnd_allow_emergency boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{"push":true,"sms":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS recent_courses      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS special_interests   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS experience_years    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preferred_centres   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lat                 double precision,
  ADD COLUMN IF NOT EXISTS lng                 double precision,
  ADD COLUMN IF NOT EXISTS last_location_at    timestamptz;

-- Backfill therapies from the existing specializations column so matching has
-- something to work with on day one.
UPDATE public.physio_therapists
   SET therapies = specializations
 WHERE cardinality(therapies) = 0 AND cardinality(specializations) > 0;

-- ---------------------------------------------------- shared skill codes ----
-- The handover's known pitfall: a nurse stored ward_general while duties asked
-- for general_ward, so nothing matched and everything looked healthy. The
-- catalogue is a table so save-time validation has something to check against.
CREATE TABLE IF NOT EXISTS public.care_skill_catalogue (
  code        text PRIMARY KEY,
  role        text NOT NULL CHECK (role IN ('nurse','technician','physiotherapist','care_physician')),
  label       text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.care_skill_catalogue TO authenticated;
GRANT ALL ON public.care_skill_catalogue TO service_role;
ALTER TABLE public.care_skill_catalogue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalogue is readable" ON public.care_skill_catalogue;
CREATE POLICY "catalogue is readable" ON public.care_skill_catalogue
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.care_skill_catalogue (code, role, label) VALUES
  ('general_ward','nurse','Ward nursing'),
  ('icu','nurse','ICU'),
  ('hdu','nurse','HDU'),
  ('ccu','nurse','CCU'),
  ('ventilator','nurse','Ventilator care'),
  ('tracheostomy','nurse','Tracheostomy care'),
  ('dialysis','nurse','Dialysis'),
  ('ot_scrub','nurse','OT scrub'),
  ('ot_circulating','nurse','OT circulating'),
  ('anaesthesia_assist','nurse','Anaesthesia assistance'),
  ('cssd','nurse','CSSD'),
  ('maternity','nurse','Maternity'),
  ('labour_room','nurse','Labour room'),
  ('nicu','nurse','NICU'),
  ('picu','nurse','PICU'),
  ('lactation','nurse','Lactation support'),
  ('home_attendant','nurse','Home attendant'),
  ('elderly','nurse','Elderly care'),
  ('palliative','nurse','Palliative care'),
  ('wound','nurse','Wound care'),
  ('stoma','nurse','Stoma care'),
  ('catheter','nurse','Catheter care'),
  ('ryles_tube','nurse','Ryle''s tube'),
  ('iv_therapy','nurse','IV therapy'),
  ('emg','technician','EMG'),
  ('ncs','technician','NCS'),
  ('eeg','technician','EEG'),
  ('vep','technician','VEP'),
  ('bera','technician','BERA'),
  ('vng','technician','VNG'),
  ('ecg','technician','ECG'),
  ('xray','technician','X-ray'),
  ('audiometry','technician','Audiometry'),
  ('neuro','physiotherapist','Neuro physiotherapy'),
  ('orthopaedic','physiotherapist','Orthopaedic therapy'),
  ('sports','physiotherapist','Sports injury rehab'),
  ('paediatric','physiotherapist','Paediatric therapy'),
  ('geriatric','physiotherapist','Geriatric therapy'),
  ('cardio_respiratory','physiotherapist','Cardio-respiratory'),
  ('post_surgical','physiotherapist','Post-surgical rehab'),
  ('pelvic_floor','physiotherapist','Pelvic floor'),
  ('general','physiotherapist','General physiotherapy')
ON CONFLICT (code) DO NOTHING;

-- Rejects a skill the catalogue does not know, at save time, for the role that
-- owns the row. Unknown codes are the failure that looks like nothing at all.
CREATE OR REPLACE FUNCTION public.assert_known_skills(p_role text, p_codes text[])
RETURNS void LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_bad text;
BEGIN
  SELECT string_agg(c, ', ') INTO v_bad
    FROM unnest(COALESCE(p_codes, '{}')) AS c
   WHERE NOT EXISTS (SELECT 1 FROM public.care_skill_catalogue k
                      WHERE k.code = c AND k.role = p_role AND k.active);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'CARE_UNKNOWN_SKILL: % is not in the % catalogue.', v_bad, p_role;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.assert_known_skills(text, text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.nurses_validate_skills() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN PERFORM public.assert_known_skills('nurse', NEW.skills); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS tr_nurses_validate_skills ON public.nurses;
CREATE TRIGGER tr_nurses_validate_skills BEFORE INSERT OR UPDATE OF skills
  ON public.nurses FOR EACH ROW EXECUTE FUNCTION public.nurses_validate_skills();

CREATE OR REPLACE FUNCTION public.technicians_validate_tests() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN PERFORM public.assert_known_skills('technician', NEW.tests); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS tr_technicians_validate_tests ON public.technicians;
CREATE TRIGGER tr_technicians_validate_tests BEFORE INSERT OR UPDATE OF tests
  ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.technicians_validate_tests();

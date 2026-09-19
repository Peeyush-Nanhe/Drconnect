-- ============================================================================
-- Demo profile rows for the nurse and technician portals.
--
-- Why the nurse screen is empty while the physiotherapist screen is full: the
-- portals are identical in code. getNurseBoard and getTherapistBoard both look
-- their profile up by user_id and both return an empty board when there is no
-- row. physio_therapists has a row for Dr. Kavita Deshmukh; nurses and
-- technicians have no rows at all, because nothing ever created them. The
-- tables were added by 20260916120000 with no seed, and a staff row is only
-- written when that person opens Profile and presses Save.
--
-- So this is missing data, not missing code. Nurse and technician get the same
-- starting rows the physiotherapist already had.
--
-- Written against auth.users by email, so it works whatever ids the demo
-- accounts were created with, and does nothing at all if an account has not
-- been created yet. Safe to run more than once.
-- ============================================================================

DO $$
DECLARE v_uid uuid;
BEGIN
  -- ------------------------------------------------------------- nurse ----
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'nurse1@demo.med';

  IF v_uid IS NULL THEN
    RAISE NOTICE 'nurse1@demo.med does not exist yet; skipping the nurse seed.';
  ELSE
    INSERT INTO public.nurses (
      user_id, full_name, phone, qualification, registration_number,
      years_experience, skills, specialty, shift_prefs,
      home_care, hospital_duty, areas, city, preferred_facilities,
      bio, languages, is_online, verified, active)
    VALUES (
      v_uid,
      'Sister Asha Pawar',
      '+91 98220 41185',
      'gnm',
      'MNC-2016-11842',
      9,
      -- Every code here is a value from NURSE_SKILLS in care-staff-catalog.ts.
      -- The handover's known pitfall was a nurse stored with ward_general while
      -- duties asked for general_ward: she matched nothing and looked healthy.
      ARRAY['general_ward','icu','ventilator','tracheostomy','wound_care',
            'catheter_care','ryles_tube','injection_iv','elderly_bedridden',
            'post_surgical','palliative'],
      'Critical care',
      ARRAY['day_12h','night_12h','live_in_24h'],
      true, true,
      ARRAY['Koregaon Park','Kalyani Nagar','Viman Nagar','Kharadi','Kothrud'],
      'Pune',
      ARRAY[]::text[],
      'Nine years in critical care and post-operative nursing. Comfortable with ventilated and tracheostomy patients at home.',
      ARRAY['English','Hindi','Marathi'],
      false,
      true,
      true)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- -------------------------------------------------------- technician ----
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'tech1@demo.med';

  IF v_uid IS NULL THEN
    RAISE NOTICE 'tech1@demo.med does not exist yet; skipping the technician seed.';
  ELSE
    INSERT INTO public.technicians (
      user_id, full_name, phone, test_types, org, qualification,
      years_experience, areas, city, home_visits, clinic_visits,
      carries_machine, preferred_hubs, preferred_facilities,
      bio, is_online, verified, active, phone_verified)
    VALUES (
      v_uid,
      'Rohit Kale',
      '+91 98905 33270',
      -- Values from TECHNICIAN_TESTS in care-staff-catalog.ts.
      ARRAY['emg','nerve_conduction','eeg','vep','bera','audiometry',
            'tympanometry','ecg','holter'],
      'MyDox Diagnostics',
      'dmlt',
      6,
      ARRAY['Kothrud','Deccan','FC Road','Baner','Aundh','Hinjewadi'],
      'Pune',
      true, true, true,
      ARRAY[]::text[],
      ARRAY[]::text[],
      'Neurophysiology and cardiac testing at home. Carries portable EMG, EEG and ECG equipment.',
      false,
      true,
      true,
      true)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;

-- The portals read profiles.view to decide where a signed-in person lands, and
-- auth.tsx only sets it at sign-up. An account created before the portals
-- existed can carry the wrong view and never reach its own screen.
UPDATE public.profiles p
   SET view = 'nurse'
  FROM auth.users u
 WHERE u.id = p.id AND lower(u.email) = 'nurse1@demo.med'
   AND p.view IS DISTINCT FROM 'nurse';

UPDATE public.profiles p
   SET view = 'technician'
  FROM auth.users u
 WHERE u.id = p.id AND lower(u.email) = 'tech1@demo.med'
   AND p.view IS DISTINCT FROM 'technician';

UPDATE public.profiles p
   SET view = 'physio_staff'
  FROM auth.users u
 WHERE u.id = p.id AND lower(u.email) = 'physio1@demo.med'
   AND p.view IS DISTINCT FROM 'physio_staff';

-- Matching needs the provider role as well as the profile row; without it the
-- account is a patient who happens to own a nurse profile.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'provider'::public.app_role
  FROM auth.users u
 WHERE lower(u.email) IN ('nurse1@demo.med','tech1@demo.med','physio1@demo.med')
ON CONFLICT DO NOTHING;

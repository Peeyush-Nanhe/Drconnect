-- 1. Baseline signup trigger (privileged roles are never granted from an email address)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.phone)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient'::public.app_role)
  ON CONFLICT DO NOTHING;

  -- Never derive admin/super-admin privileges from user-controlled signup data.

  RETURN NEW;
END;
$$;

-- 2. Verified mental-health provider profiles
UPDATE public.provider_directory
   SET verified = true,
       registration_body = 'Maharashtra Medical Council',
       registration_number = 'MMC-2011-44821'
 WHERE name = 'Dr. Sunita Pawar';

UPDATE public.provider_directory
   SET verified = true,
       registration_body = 'Maharashtra Medical Council',
       registration_number = 'MMC-2009-33110'
 WHERE name = 'Dr. Vikram Bhosale';

INSERT INTO public.provider_directory
  (id, name, specialty, hospital, area, city, phone, rating, years_experience,
   registration_body, registration_number, verified, active_case_load)
VALUES
  ('a1000000-0000-4000-8000-000000000001','Dr. Rohan Kulkarni','Psychiatrist','Sahyadri Hospital','Deccan','Pune','+912066001101',4.8,14,'Maharashtra Medical Council','MMC-2012-51204',true,6),
  ('a1000000-0000-4000-8000-000000000002','Dr. Ishita Menon','Psychiatrist','Jehangir Hospital','Camp','Pune','+912066001102',4.6,9,'Maharashtra Medical Council','MMC-2017-61932',true,4),
  ('a1000000-0000-4000-8000-000000000003','Dr. Aditi Rane','Clinical Psychologist','Mindspace Clinic','Kothrud','Pune','+912066001103',4.9,11,'Rehabilitation Council of India','RCI-A45781',true,7),
  ('a1000000-0000-4000-8000-000000000004','Neha Prabhu','Clinical Psychologist','Mindspace Clinic','Baner','Pune','+912066001104',4.7,6,'Rehabilitation Council of India','RCI-A61204',true,5),
  ('a1000000-0000-4000-8000-000000000005','Sameer Joshi','Psychiatric Social Worker','Sahyadri Hospital','Deccan','Pune','+912066001105',4.5,8,'State Mental Health Authority','SMHA-PSW-3391',true,3),
  ('a1000000-0000-4000-8000-000000000006','Sister Lata Kamble','Psychiatric Nurse','Sahyadri Hospital','Deccan','Pune','+912066001106',4.6,12,'Maharashtra Nursing Council','MNC-RN-77120',true,4),
  ('a1000000-0000-4000-8000-000000000007','Pooja Shetty','Occupational Therapist','Ruby Hall Clinic','Sassoon Road','Pune','+912066001107',4.4,7,'All India Occupational Therapists Association','AIOTA-22841',true,2),
  ('a1000000-0000-4000-8000-000000000008','Dr. Kunal Sane','Urologist','Ruby Hall Clinic','Sassoon Road','Pune','+912066001108',4.5,13,'Maharashtra Medical Council','MMC-2010-40922',true,1),
  ('a1000000-0000-4000-8000-000000000009','Dr. Farida Contractor','Endocrinologist','Jehangir Hospital','Camp','Pune','+912066001109',4.7,15,'Maharashtra Medical Council','MMC-2008-30771',true,2),
  ('a1000000-0000-4000-8000-00000000000a','Ritu Bansal','Dietitian','Mindspace Clinic','Kothrud','Pune','+912066001110',4.3,5,'Indian Dietetic Association','IDA-9921',true,1)
ON CONFLICT (id) DO NOTHING;

-- 3. Real screening records + care teams for existing demo patients
DO $seed$
DECLARE
  p1 uuid := '69c0c6c3-be8f-4112-b945-696f758ef909'; -- patient1@demo.med
  p2 uuid := '78ed4aaf-fc64-4c55-a182-4c553ba2d7bc'; -- patient2@demo.med
  p3 uuid := '82592f40-914d-4704-ad49-56f6751ea607'; -- patient@demo.med
  coord uuid := '24fc3feb-b1d0-4806-a6dd-ac2371daf3fe';
  t uuid;
BEGIN
  -- These analytics fixtures reference fixed demo-user UUIDs from the original
  -- hosted project. Skip them on a fresh database where those users do not exist.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p1)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p2)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p3)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = coord) THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.mw_care_teams LIMIT 1) THEN
    RETURN;
  END IF;

  -- Team A: depression, improving, SLA met, fully assembled
  t := 'b1000000-0000-4000-8000-000000000001';
  INSERT INTO public.mw_care_teams
    (id, patient_id, track, anchor_role, anchor_summary, anchor_modality, urgent,
     screening_instrument, screening_score, screening_band, screening_red_flag,
     assigned_coordinator_id, status, first_contact_at, assembled_at,
     first_contact_due_at, assembly_due_at, review_flag, programme_tier,
     programme_enrolled_at, coordination_fee, coordination_fee_disclosed_at, created_at, updated_at)
  VALUES (t, p1, 'depression', 'psychiatrist', 'Moderately severe PHQ-9, low mood 8 weeks',
     'online', false, 'PHQ-9', 17, 'Moderately severe', false, coord, 'active',
     now() - interval '58 day' + interval '2 hour', now() - interval '57 day',
     now() - interval '58 day' + interval '4 hour', now() - interval '56 day',
     false, 'programme', now() - interval '57 day', 2499, now() - interval '58 day',
     now() - interval '58 day', now() - interval '3 day');
  INSERT INTO public.mw_care_team_members (team_id, role, role_label, required, provider_id, provider_name, status, appointment_at, created_at, updated_at) VALUES
    (t,'care_coordinator','Care Coordinator',true,'a1000000-0000-4000-8000-000000000005','Sameer Joshi','confirmed', now() - interval '57 day', now() - interval '58 day', now() - interval '57 day'),
    (t,'psychiatrist','Psychiatrist',true,'a1000000-0000-4000-8000-000000000001','Dr. Rohan Kulkarni','confirmed', now() - interval '56 day', now() - interval '58 day', now() - interval '57 day'),
    (t,'clinical_psychologist','Clinical Psychologist',true,'a1000000-0000-4000-8000-000000000003','Dr. Aditi Rane','confirmed', now() - interval '55 day', now() - interval '58 day', now() - interval '57 day'),
    (t,'physician','Physician',false,'f4c0b406-d851-480d-a003-f485087f1473','Dr. Vikram Bhosale','confirmed', now() - interval '54 day', now() - interval '58 day', now() - interval '56 day');
  INSERT INTO public.mw_measurements (team_id, patient_id, instrument, score, band, red_flag, taken_at) VALUES
    (t,p1,'PHQ-9',17,'Moderately severe',false, now() - interval '58 day'),
    (t,p1,'PHQ-9',14,'Moderate',false, now() - interval '44 day'),
    (t,p1,'PHQ-9',10,'Moderate',false, now() - interval '30 day'),
    (t,p1,'PHQ-9',7,'Mild',false, now() - interval '16 day'),
    (t,p1,'PHQ-9',5,'Mild',false, now() - interval '3 day');

  -- Team B: anxiety, improving slowly, first contact met
  t := 'b1000000-0000-4000-8000-000000000002';
  INSERT INTO public.mw_care_teams
    (id, patient_id, track, anchor_role, anchor_summary, anchor_modality, urgent,
     screening_instrument, screening_score, screening_band, screening_red_flag,
     assigned_coordinator_id, status, first_contact_at, assembled_at,
     first_contact_due_at, assembly_due_at, review_flag, coordination_fee,
     coordination_fee_disclosed_at, created_at, updated_at)
  VALUES (t, p2, 'anxiety', 'clinical_psychologist', 'GAD-7 severe, panic episodes at work',
     'online', false, 'GAD-7', 16, 'Severe', false, coord, 'active',
     now() - interval '31 day' + interval '3 hour', now() - interval '30 day',
     now() - interval '31 day' + interval '4 hour', now() - interval '29 day',
     false, 1999, now() - interval '31 day', now() - interval '31 day', now() - interval '2 day');
  INSERT INTO public.mw_care_team_members (team_id, role, role_label, required, provider_id, provider_name, status, appointment_at, created_at, updated_at) VALUES
    (t,'care_coordinator','Care Coordinator',true,'a1000000-0000-4000-8000-000000000005','Sameer Joshi','confirmed', now() - interval '30 day', now() - interval '31 day', now() - interval '30 day'),
    (t,'clinical_psychologist','Clinical Psychologist',true,'a1000000-0000-4000-8000-000000000004','Neha Prabhu','confirmed', now() - interval '29 day', now() - interval '31 day', now() - interval '30 day'),
    (t,'psychiatrist','Psychiatrist',false,'a1000000-0000-4000-8000-000000000002','Dr. Ishita Menon','confirmed', now() - interval '27 day', now() - interval '31 day', now() - interval '29 day'),
    (t,'cardiologist','Cardiologist',false,'b49661c2-e375-4399-a8b0-1581984d7a71','Dr. Anil Deshpande','declined', NULL, now() - interval '31 day', now() - interval '30 day');
  INSERT INTO public.mw_measurements (team_id, patient_id, instrument, score, band, red_flag, taken_at) VALUES
    (t,p2,'GAD-7',16,'Severe',false, now() - interval '31 day'),
    (t,p2,'GAD-7',13,'Moderate',false, now() - interval '18 day'),
    (t,p2,'GAD-7',11,'Moderate',false, now() - interval '9 day'),
    (t,p2,'GAD-7',9,'Mild',false, now() - interval '2 day');

  -- Team C: urgent depression with red flag, first contact breached, still assembling
  t := 'b1000000-0000-4000-8000-000000000003';
  INSERT INTO public.mw_care_teams
    (id, patient_id, track, anchor_role, anchor_summary, anchor_modality, modality_reason, urgent,
     screening_instrument, screening_score, screening_band, screening_red_flag,
     assigned_coordinator_id, status, first_contact_at, assembled_at,
     first_contact_due_at, assembly_due_at, review_flag, coordination_fee,
     coordination_fee_disclosed_at, created_at, updated_at)
  VALUES (t, p3, 'depression', 'psychiatrist', 'Severe PHQ-9 with safety item flagged',
     'in_person', 'Safety item on PHQ-9 flagged — in-person review required', true,
     'PHQ-9', 22, 'Severe', true, NULL, 'assembling',
     NULL, NULL, now() - interval '9 hour', now() + interval '39 hour',
     true, 2499, now() - interval '13 hour', now() - interval '13 hour', now() - interval '6 hour');
  INSERT INTO public.mw_care_team_members (team_id, role, role_label, required, provider_id, provider_name, status, created_at, updated_at) VALUES
    (t,'care_coordinator','Care Coordinator',true,NULL,NULL,'pending', now() - interval '13 hour', now() - interval '13 hour'),
    (t,'psychiatrist','Psychiatrist',true,'a1000000-0000-4000-8000-000000000001','Dr. Rohan Kulkarni','pending', now() - interval '13 hour', now() - interval '7 hour'),
    (t,'psychiatric_nurse','Psychiatric Nurse',false,NULL,NULL,'pending', now() - interval '13 hour', now() - interval '13 hour');
  INSERT INTO public.mw_measurements (team_id, patient_id, instrument, score, band, red_flag, taken_at) VALUES
    (t,p3,'PHQ-9',22,'Severe',true, now() - interval '13 hour');

  -- Team D: schizophrenia care, long programme, partly filled, assembly overdue
  t := 'b1000000-0000-4000-8000-000000000004';
  INSERT INTO public.mw_care_teams
    (id, patient_id, track, anchor_role, anchor_summary, anchor_modality, urgent,
     screening_instrument, screening_score, screening_band, screening_red_flag,
     assigned_coordinator_id, status, first_contact_at, assembled_at,
     first_contact_due_at, assembly_due_at, review_flag, programme_tier,
     programme_enrolled_at, coordination_fee, coordination_fee_disclosed_at, created_at, updated_at)
  VALUES (t, p1, 'schizophrenia', 'psychiatrist', 'Relapse prevention and family support',
     'in_person', false, NULL, NULL, NULL, false, coord, 'assembling',
     now() - interval '6 day' + interval '5 hour', NULL,
     now() - interval '6 day' + interval '4 hour', now() - interval '4 day',
     true, 'programme', now() - interval '6 day', 3499, now() - interval '6 day',
     now() - interval '6 day', now() - interval '1 day');
  INSERT INTO public.mw_care_team_members (team_id, role, role_label, required, provider_id, provider_name, status, appointment_at, created_at, updated_at) VALUES
    (t,'care_coordinator','Care Coordinator',true,'a1000000-0000-4000-8000-000000000005','Sameer Joshi','confirmed', now() - interval '5 day', now() - interval '6 day', now() - interval '5 day'),
    (t,'psychiatrist','Psychiatrist',true,'a1000000-0000-4000-8000-000000000002','Dr. Ishita Menon','confirmed', now() - interval '4 day', now() - interval '6 day', now() - interval '5 day'),
    (t,'psychiatric_nurse','Psychiatric Nurse',true,'a1000000-0000-4000-8000-000000000006','Sister Lata Kamble','pending', NULL, now() - interval '6 day', now() - interval '2 day'),
    (t,'psychiatric_social_worker','Psychiatric Social Worker',true,NULL,NULL,'pending', NULL, now() - interval '6 day', now() - interval '6 day'),
    (t,'occupational_therapist','Occupational Therapist',false,'a1000000-0000-4000-8000-000000000007','Pooja Shetty','confirmed', now() - interval '3 day', now() - interval '6 day', now() - interval '4 day'),
    (t,'vocational_rehab','Vocational Rehabilitation',false,NULL,NULL,'pending', NULL, now() - interval '6 day', now() - interval '6 day');

  -- Team E: sexual wellness, discreet, assembled quickly
  t := 'b1000000-0000-4000-8000-000000000005';
  INSERT INTO public.mw_care_teams
    (id, patient_id, track, anchor_role, anchor_summary, anchor_modality, urgent,
     screening_instrument, screening_score, screening_band, screening_red_flag,
     assigned_coordinator_id, status, first_contact_at, assembled_at,
     first_contact_due_at, assembly_due_at, review_flag, coordination_fee,
     coordination_fee_disclosed_at, created_at, updated_at)
  VALUES (t, p2, 'sexual_wellness', 'urologist', 'Discreet consult — performance concerns, 4 months',
     'online', false, NULL, NULL, NULL, false, coord, 'active',
     now() - interval '12 day' + interval '1 hour', now() - interval '11 day',
     now() - interval '12 day' + interval '4 hour', now() - interval '10 day',
     false, 1799, now() - interval '12 day', now() - interval '12 day', now() - interval '5 day');
  INSERT INTO public.mw_care_team_members (team_id, role, role_label, required, provider_id, provider_name, status, appointment_at, created_at, updated_at) VALUES
    (t,'care_coordinator','Care Coordinator',true,'a1000000-0000-4000-8000-000000000005','Sameer Joshi','confirmed', now() - interval '11 day', now() - interval '12 day', now() - interval '11 day'),
    (t,'urologist','Urologist',true,'a1000000-0000-4000-8000-000000000008','Dr. Kunal Sane','confirmed', now() - interval '10 day', now() - interval '12 day', now() - interval '11 day'),
    (t,'endocrinologist','Endocrinologist',false,'a1000000-0000-4000-8000-000000000009','Dr. Farida Contractor','confirmed', now() - interval '8 day', now() - interval '12 day', now() - interval '10 day'),
    (t,'clinical_psychologist','Clinical Psychologist',false,'a1000000-0000-4000-8000-000000000004','Neha Prabhu','confirmed', now() - interval '7 day', now() - interval '12 day', now() - interval '10 day');

  -- Team F: anxiety, worsening trend, flagged for review
  t := 'b1000000-0000-4000-8000-000000000006';
  INSERT INTO public.mw_care_teams
    (id, patient_id, track, anchor_role, anchor_summary, anchor_modality, urgent,
     screening_instrument, screening_score, screening_band, screening_red_flag,
     assigned_coordinator_id, status, first_contact_at, assembled_at,
     first_contact_due_at, assembly_due_at, review_flag, coordination_fee,
     coordination_fee_disclosed_at, created_at, updated_at)
  VALUES (t, p3, 'anxiety', 'clinical_psychologist', 'Generalised anxiety, sleep badly affected',
     'online', false, 'GAD-7', 11, 'Moderate', false, coord, 'active',
     now() - interval '21 day' + interval '6 hour', now() - interval '19 day',
     now() - interval '21 day' + interval '4 hour', now() - interval '19 day',
     true, 1999, now() - interval '21 day', now() - interval '21 day', now() - interval '1 day');
  INSERT INTO public.mw_care_team_members (team_id, role, role_label, required, provider_id, provider_name, status, appointment_at, created_at, updated_at) VALUES
    (t,'care_coordinator','Care Coordinator',true,'a1000000-0000-4000-8000-000000000005','Sameer Joshi','confirmed', now() - interval '20 day', now() - interval '21 day', now() - interval '20 day'),
    (t,'clinical_psychologist','Clinical Psychologist',true,'a1000000-0000-4000-8000-000000000003','Dr. Aditi Rane','confirmed', now() - interval '19 day', now() - interval '21 day', now() - interval '19 day'),
    (t,'dietitian','Dietitian',false,'a1000000-0000-4000-8000-00000000000a','Ritu Bansal','pending', NULL, now() - interval '21 day', now() - interval '18 day');
  INSERT INTO public.mw_measurements (team_id, patient_id, instrument, score, band, red_flag, taken_at) VALUES
    (t,p3,'GAD-7',11,'Moderate',false, now() - interval '21 day'),
    (t,p3,'GAD-7',13,'Moderate',false, now() - interval '12 day'),
    (t,p3,'GAD-7',16,'Severe',false, now() - interval '1 day');

  -- Team G: brand new depression referral, unassigned, within SLA
  t := 'b1000000-0000-4000-8000-000000000007';
  INSERT INTO public.mw_care_teams
    (id, patient_id, track, anchor_role, anchor_summary, anchor_modality, urgent,
     screening_instrument, screening_score, screening_band, screening_red_flag,
     assigned_coordinator_id, status, first_contact_due_at, assembly_due_at,
     review_flag, coordination_fee, coordination_fee_disclosed_at, created_at, updated_at)
  VALUES (t, p2, 'depression', 'psychiatrist', 'Mild-moderate PHQ-9, first referral',
     'online', false, 'PHQ-9', 12, 'Moderate', false, NULL, 'assembling',
     now() + interval '2 hour', now() + interval '46 hour', false, 2499,
     now() - interval '2 hour', now() - interval '2 hour', now() - interval '2 hour');
  INSERT INTO public.mw_care_team_members (team_id, role, role_label, required, provider_id, provider_name, status, created_at, updated_at) VALUES
    (t,'care_coordinator','Care Coordinator',true,NULL,NULL,'pending', now() - interval '2 hour', now() - interval '2 hour'),
    (t,'psychiatrist','Psychiatrist',true,NULL,NULL,'pending', now() - interval '2 hour', now() - interval '2 hour'),
    (t,'clinical_psychologist','Clinical Psychologist',true,NULL,NULL,'pending', now() - interval '2 hour', now() - interval '2 hour');
  INSERT INTO public.mw_measurements (team_id, patient_id, instrument, score, band, red_flag, taken_at) VALUES
    (t,p2,'PHQ-9',12,'Moderate',false, now() - interval '2 hour');
END
$seed$;
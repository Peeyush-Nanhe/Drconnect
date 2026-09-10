
-- HOSPITALS catalog
CREATE TABLE public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area text NOT NULL,
  city text NOT NULL DEFAULT 'Pune',
  phone text,
  specialties text[] NOT NULL DEFAULT '{}',
  emergency boolean NOT NULL DEFAULT false,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hospitals TO anon, authenticated;
GRANT ALL ON public.hospitals TO service_role;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospitals public read" ON public.hospitals FOR SELECT USING (true);
CREATE POLICY "admins manage hospitals" ON public.hospitals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_hospitals_updated_at BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PROVIDER DIRECTORY (public listings, not tied to auth users)
CREATE TABLE public.provider_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialty text NOT NULL,
  hospital text,
  area text,
  city text NOT NULL DEFAULT 'Pune',
  phone text,
  rating numeric(2,1) DEFAULT 4.5,
  years_experience int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_directory TO anon, authenticated;
GRANT ALL ON public.provider_directory TO service_role;
ALTER TABLE public.provider_directory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers public read" ON public.provider_directory FOR SELECT USING (true);
CREATE POLICY "admins manage providers" ON public.provider_directory FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_provider_directory_updated_at BEFORE UPDATE ON public.provider_directory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CARE PROGRAMS catalog
CREATE TABLE public.care_programs_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tier text,
  description text,
  monthly_fee numeric(10,2),
  city text NOT NULL DEFAULT 'Pune',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.care_programs_catalog TO anon, authenticated;
GRANT ALL ON public.care_programs_catalog TO service_role;
ALTER TABLE public.care_programs_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programs public read" ON public.care_programs_catalog FOR SELECT USING (true);
CREATE POLICY "admins manage programs" ON public.care_programs_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_care_programs_catalog_updated_at BEFORE UPDATE ON public.care_programs_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BLOOD DONATION CAMPS catalog
CREATE TABLE public.blood_donation_camps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hospital text,
  area text NOT NULL,
  city text NOT NULL DEFAULT 'Pune',
  camp_date date NOT NULL,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blood_donation_camps TO anon, authenticated;
GRANT ALL ON public.blood_donation_camps TO service_role;
ALTER TABLE public.blood_donation_camps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camps public read" ON public.blood_donation_camps FOR SELECT USING (true);
CREATE POLICY "admins manage camps" ON public.blood_donation_camps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_blood_donation_camps_updated_at BEFORE UPDATE ON public.blood_donation_camps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SEED DATA
INSERT INTO public.hospitals (name, area, phone, specialties, emergency, lat, lng) VALUES
('Ruby Hall Clinic','Sassoon Road','020-66455555',ARRAY['Cardiology','Neurology','Oncology','Emergency'],true,18.5314,73.8798),
('Jehangir Hospital','Sassoon Road','020-66819999',ARRAY['Cardiology','Orthopedics','Gastroenterology'],true,18.5297,73.8779),
('Sahyadri Super Speciality Hospital','Deccan Gymkhana','020-67213000',ARRAY['Cardiology','Neurosurgery','Transplant'],true,18.5163,73.8419),
('Deenanath Mangeshkar Hospital','Erandwane','020-40151000',ARRAY['Cardiology','Oncology','Pediatrics','Emergency'],true,18.5089,73.8267),
('Aditya Birla Memorial Hospital','Chinchwad','020-30717500',ARRAY['Cardiology','Neurology','Emergency'],true,18.6298,73.7997),
('Manipal Hospital','Baner','020-71075000',ARRAY['General Surgery','Orthopedics','Emergency'],true,18.5590,73.7810),
('Columbia Asia Hospital','Kharadi','020-71534444',ARRAY['Pediatrics','Gynecology','Emergency'],true,18.5514,73.9436),
('Noble Hospital','Hadapsar','020-66285000',ARRAY['Cardiology','Nephrology','Emergency'],true,18.4988,73.9260),
('Poona Hospital','Sadashiv Peth','020-66096000',ARRAY['General Medicine','Orthopedics'],true,18.5119,73.8496),
('Inamdar Multispeciality Hospital','Fatima Nagar','020-26810111',ARRAY['Cardiology','Orthopedics','Emergency'],true,18.4967,73.9017),
('Jupiter Hospital','Baner','020-27290700',ARRAY['Oncology','Neurology','Emergency'],true,18.5595,73.7847),
('KEM Hospital','Rasta Peth','020-66037300',ARRAY['General Medicine','Pediatrics','Emergency'],true,18.5237,73.8730);

INSERT INTO public.provider_directory (name, specialty, hospital, area, phone, rating, years_experience) VALUES
('Dr. Anil Deshpande','Cardiologist','Ruby Hall Clinic','Sassoon Road','+91-98220-11223',4.8,22),
('Dr. Priya Kulkarni','Pediatrician','Deenanath Mangeshkar Hospital','Erandwane','+91-98220-22334',4.9,15),
('Dr. Rajesh Patil','Orthopedic Surgeon','Sahyadri Hospital','Deccan Gymkhana','+91-98220-33445',4.7,18),
('Dr. Meera Joshi','Gynecologist','Jehangir Hospital','Sassoon Road','+91-98220-44556',4.8,20),
('Dr. Vikram Bhosale','General Physician','Noble Hospital','Hadapsar','+91-98220-55667',4.6,12),
('Dr. Sneha Karve','Dermatologist','Manipal Hospital','Baner','+91-98220-66778',4.7,10),
('Dr. Amit Sathe','Neurologist','Sahyadri Hospital','Deccan Gymkhana','+91-98220-77889',4.9,25),
('Dr. Kavita Marathe','ENT Specialist','Poona Hospital','Sadashiv Peth','+91-98220-88990',4.5,14),
('Dr. Ravi Chavan','Emergency Medicine','Aditya Birla Memorial','Chinchwad','+91-98220-99001',4.8,16),
('Dr. Sunita Pawar','Psychiatrist','Jupiter Hospital','Baner','+91-98220-10112',4.7,17),
('Dr. Mahesh Gokhale','Nephrologist','Noble Hospital','Hadapsar','+91-98220-21223',4.8,19),
('Dr. Anjali Deshmukh','Oncologist','Ruby Hall Clinic','Sassoon Road','+91-98220-32334',4.9,21);

INSERT INTO public.care_programs_catalog (code, name, tier, description, monthly_fee) VALUES
('senior_care_basic','Senior Care - Basic','basic','Weekly nurse visit + monthly doctor checkup at home',2999),
('senior_care_premium','Senior Care - Premium','premium','Daily nurse visit + 24x7 doctor helpline + monthly full checkup',7999),
('chronic_care_diabetes','Diabetes Management','standard','Monthly endocrinologist consult + glucose monitoring + diet plan',3499),
('chronic_care_cardiac','Cardiac Care','premium','Cardiologist consult + ECG at home + medication delivery',5999),
('post_op_recovery','Post-Operative Home Recovery','standard','Nurse visits + physiotherapy + wound care for 30 days',8999),
('maternity_care','Maternity Care Program','premium','Prenatal + postnatal visits + lactation consultant',11999),
('pediatric_wellness','Pediatric Wellness','basic','Monthly pediatrician checkup + vaccination reminders',1999),
('mental_wellness','Mental Wellness Program','standard','Bi-weekly counsellor sessions + psychiatrist review',4499);

INSERT INTO public.blood_donation_camps (name, hospital, area, camp_date, lat, lng) VALUES
('Ruby Hall Voluntary Drive','Ruby Hall Clinic','Sassoon Road', current_date + 7, 18.5314, 73.8798),
('Sahyadri Blood Camp','Sahyadri Hospital','Deccan Gymkhana', current_date + 12, 18.5163, 73.8419),
('Baner Community Camp','Manipal Hospital','Baner', current_date + 18, 18.5590, 73.7810),
('Hinjewadi IT Park Drive','Jupiter Hospital','Hinjewadi', current_date + 21, 18.5912, 73.7389),
('Kothrud Rotary Camp','Deenanath Mangeshkar Hospital','Kothrud', current_date + 25, 18.5074, 73.8077),
('Kharadi EON IT Drive','Columbia Asia','Kharadi', current_date + 30, 18.5514, 73.9436);

-- Pune hubs
INSERT INTO public.hubs (name, area, lat, lng) VALUES
('MedConnect Hub - Koregaon Park','Koregaon Park',18.5362,73.8939),
('MedConnect Hub - Baner','Baner',18.5590,73.7810),
('MedConnect Hub - Wakad','Wakad',18.5987,73.7628),
('MedConnect Hub - Aundh','Aundh',18.5590,73.8078),
('MedConnect Hub - Hinjewadi','Hinjewadi',18.5912,73.7389),
('MedConnect Hub - Kothrud','Kothrud',18.5074,73.8077),
('MedConnect Hub - Hadapsar','Hadapsar',18.4988,73.9260),
('MedConnect Hub - Viman Nagar','Viman Nagar',18.5679,73.9143);

-- Beds for each Pune hub (3 beds each)
INSERT INTO public.hub_beds (hub_id, room_label, status)
SELECT h.id, 'Room ' || g.n, 'available'
FROM public.hubs h
CROSS JOIN generate_series(1,3) g(n)
WHERE h.area IN ('Koregaon Park','Baner','Wakad','Aundh','Hinjewadi','Kothrud','Hadapsar','Viman Nagar');

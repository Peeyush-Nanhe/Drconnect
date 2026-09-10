ALTER TABLE public.care_program_bookings
  DROP CONSTRAINT IF EXISTS care_program_bookings_program_check;

ALTER TABLE public.care_program_bookings
  ADD CONSTRAINT care_program_bookings_program_check
  CHECK (program IN ('assistive_living','rehab','ivf_fertility','weight_management','dialysis','medical_tourism'));

CREATE TABLE public.coordinator_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_status text NOT NULL DEFAULT 'draft' CHECK (application_status IN ('draft','submitted','verified','rejected','suspended')),
  service_area text,
  languages text[] NOT NULL DEFAULT '{}',
  experience_years integer NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  qualifications text,
  availability_note text,
  is_available boolean NOT NULL DEFAULT true,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.coordinator_profiles TO authenticated;
GRANT ALL ON public.coordinator_profiles TO service_role;
ALTER TABLE public.coordinator_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coordinator_profiles_read_own_or_verified"
ON public.coordinator_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR application_status = 'verified' OR public.has_role(auth.uid(),'facility') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "coordinator_profiles_create_own"
ON public.coordinator_profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND application_status IN ('draft','submitted'));
CREATE POLICY "coordinator_profiles_update_own_or_admin"
ON public.coordinator_profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.coordinator_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_coordinator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  facility_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('general','referral','medical_tourism','dialysis','discharge','home_care','insurance','other')),
  summary text NOT NULL,
  priority text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','priority','urgent')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','assigned','active','waiting','completed','cancelled')),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.coordinator_cases TO authenticated;
GRANT ALL ON public.coordinator_cases TO service_role;
ALTER TABLE public.coordinator_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coordinator_cases_read_participants"
ON public.coordinator_cases FOR SELECT TO authenticated
USING (patient_id = auth.uid() OR requested_by = auth.uid() OR assigned_coordinator_id = auth.uid() OR facility_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "coordinator_cases_create_authorized"
ON public.coordinator_cases FOR INSERT TO authenticated
WITH CHECK (requested_by = auth.uid() AND (patient_id = auth.uid() OR facility_id = auth.uid() OR public.has_role(auth.uid(),'facility')));
CREATE POLICY "coordinator_cases_update_participants"
ON public.coordinator_cases FOR UPDATE TO authenticated
USING (patient_id = auth.uid() OR requested_by = auth.uid() OR assigned_coordinator_id = auth.uid() OR facility_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (patient_id = auth.uid() OR requested_by = auth.uid() OR assigned_coordinator_id = auth.uid() OR facility_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.coordinator_case_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.coordinator_cases(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.coordinator_case_tasks TO authenticated;
GRANT ALL ON public.coordinator_case_tasks TO service_role;
ALTER TABLE public.coordinator_case_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coordinator_case_tasks_read_participants"
ON public.coordinator_case_tasks FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.coordinator_cases c WHERE c.id = case_id AND (c.patient_id = auth.uid() OR c.requested_by = auth.uid() OR c.assigned_coordinator_id = auth.uid() OR c.facility_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))));
CREATE POLICY "coordinator_case_tasks_create_workers"
ON public.coordinator_case_tasks FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.coordinator_cases c WHERE c.id = case_id AND (c.assigned_coordinator_id = auth.uid() OR c.facility_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))));
CREATE POLICY "coordinator_case_tasks_update_workers"
ON public.coordinator_case_tasks FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.coordinator_cases c WHERE c.id = case_id AND (c.assigned_coordinator_id = auth.uid() OR c.facility_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.coordinator_cases c WHERE c.id = case_id AND (c.assigned_coordinator_id = auth.uid() OR c.facility_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))));

CREATE TABLE public.coordinator_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.coordinator_cases(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.coordinator_case_events TO authenticated;
GRANT ALL ON public.coordinator_case_events TO service_role;
ALTER TABLE public.coordinator_case_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coordinator_case_events_read_participants"
ON public.coordinator_case_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.coordinator_cases c WHERE c.id = case_id AND (c.patient_id = auth.uid() OR c.requested_by = auth.uid() OR c.assigned_coordinator_id = auth.uid() OR c.facility_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))));
CREATE POLICY "coordinator_case_events_create_participants"
ON public.coordinator_case_events FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.coordinator_cases c WHERE c.id = case_id AND (c.patient_id = auth.uid() OR c.requested_by = auth.uid() OR c.assigned_coordinator_id = auth.uid() OR c.facility_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))));

CREATE TABLE public.staffing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('locum','shift','full_time')),
  title text NOT NULL,
  specialty text NOT NULL,
  qualification text,
  experience_years integer NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  area text,
  shift_label text,
  starts_at timestamptz,
  ends_at timestamptz,
  compensation numeric(12,2) CHECK (compensation IS NULL OR compensation >= 0),
  compensation_unit text CHECK (compensation_unit IS NULL OR compensation_unit IN ('shift','day','month','fixed')),
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  urgency text NOT NULL DEFAULT 'planned' CHECK (urgency IN ('planned','urgent','emergency')),
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','filled','closed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.staffing_jobs TO authenticated;
GRANT ALL ON public.staffing_jobs TO service_role;
ALTER TABLE public.staffing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staffing_jobs_read_authorized"
ON public.staffing_jobs FOR SELECT TO authenticated
USING (facility_id = auth.uid() OR status = 'open' OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "staffing_jobs_create_facility"
ON public.staffing_jobs FOR INSERT TO authenticated
WITH CHECK (facility_id = auth.uid() AND public.has_role(auth.uid(),'facility'));
CREATE POLICY "staffing_jobs_update_owner"
ON public.staffing_jobs FOR UPDATE TO authenticated
USING (facility_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (facility_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.staffing_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.staffing_jobs(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','shortlisted','accepted','declined','withdrawn','completed','cancelled')),
  application_note text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, provider_id)
);
GRANT SELECT, INSERT, UPDATE ON public.staffing_assignments TO authenticated;
GRANT ALL ON public.staffing_assignments TO service_role;
ALTER TABLE public.staffing_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staffing_assignments_read_participants"
ON public.staffing_assignments FOR SELECT TO authenticated
USING (provider_id = auth.uid() OR EXISTS (SELECT 1 FROM public.staffing_jobs j WHERE j.id = job_id AND j.facility_id = auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "staffing_assignments_apply_provider"
ON public.staffing_assignments FOR INSERT TO authenticated
WITH CHECK (provider_id = auth.uid() AND public.has_role(auth.uid(),'provider') AND EXISTS (SELECT 1 FROM public.staffing_jobs j WHERE j.id = job_id AND j.status = 'open'));
CREATE POLICY "staffing_assignments_update_participants"
ON public.staffing_assignments FOR UPDATE TO authenticated
USING (provider_id = auth.uid() OR EXISTS (SELECT 1 FROM public.staffing_jobs j WHERE j.id = job_id AND j.facility_id = auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (provider_id = auth.uid() OR EXISTS (SELECT 1 FROM public.staffing_jobs j WHERE j.id = job_id AND j.facility_id = auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE INDEX coordinator_cases_patient_idx ON public.coordinator_cases(patient_id, created_at DESC);
CREATE INDEX coordinator_cases_assignee_idx ON public.coordinator_cases(assigned_coordinator_id, status, created_at DESC);
CREATE INDEX coordinator_case_tasks_case_idx ON public.coordinator_case_tasks(case_id, status, due_at);
CREATE INDEX coordinator_case_events_case_idx ON public.coordinator_case_events(case_id, created_at DESC);
CREATE INDEX staffing_jobs_open_idx ON public.staffing_jobs(status, specialty, starts_at);
CREATE INDEX staffing_jobs_facility_idx ON public.staffing_jobs(facility_id, created_at DESC);
CREATE INDEX staffing_assignments_job_idx ON public.staffing_assignments(job_id, status);
CREATE INDEX staffing_assignments_provider_idx ON public.staffing_assignments(provider_id, created_at DESC);

CREATE TRIGGER coordinator_profiles_set_updated_at BEFORE UPDATE ON public.coordinator_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER coordinator_cases_set_updated_at BEFORE UPDATE ON public.coordinator_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER coordinator_case_tasks_set_updated_at BEFORE UPDATE ON public.coordinator_case_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER staffing_jobs_set_updated_at BEFORE UPDATE ON public.staffing_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER staffing_assignments_set_updated_at BEFORE UPDATE ON public.staffing_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_staffing_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_job public.staffing_jobs%ROWTYPE;
  accepted_count integer;
BEGIN
  IF NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO target_job FROM public.staffing_jobs WHERE id = NEW.job_id FOR UPDATE;
  IF target_job.id IS NULL OR target_job.status <> 'open' THEN
    RAISE EXCEPTION 'This staffing opportunity is no longer open';
  END IF;

  SELECT count(*) INTO accepted_count
  FROM public.staffing_assignments
  WHERE job_id = NEW.job_id AND status = 'accepted' AND id <> NEW.id;

  IF accepted_count >= target_job.capacity THEN
    RAISE EXCEPTION 'This staffing opportunity is already filled';
  END IF;

  NEW.accepted_at := COALESCE(NEW.accepted_at, now());
  IF accepted_count + 1 >= target_job.capacity THEN
    UPDATE public.staffing_jobs SET status = 'filled', updated_at = now() WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER staffing_assignments_capacity_guard
BEFORE UPDATE OF status ON public.staffing_assignments
FOR EACH ROW EXECUTE FUNCTION public.enforce_staffing_capacity();
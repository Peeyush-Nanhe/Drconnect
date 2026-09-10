-- Care Physician / RMO marketplace persistence + local form capture.
-- Consolidated 2026-09-07 build.

CREATE TABLE IF NOT EXISTS public.care_physician_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  qualification text NOT NULL CHECK (qualification IN ('mbbs','bams','bhms','bums','bds','md','dnb')),
  council_name text,
  council_registration_number text,
  registration_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  experience_years integer NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 60),
  procedures text[] NOT NULL DEFAULT '{}',
  age_groups text[] NOT NULL DEFAULT '{}',
  specialty_interests text[] NOT NULL DEFAULT '{}',
  duty_types text[] NOT NULL DEFAULT '{}',
  preferred_areas text[] NOT NULL DEFAULT '{}',
  preferred_hospitals text[] NOT NULL DEFAULT '{}',
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.care_physician_profiles TO authenticated;
GRANT ALL ON public.care_physician_profiles TO service_role;
ALTER TABLE public.care_physician_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Care physicians read own and facilities read profiles"
ON public.care_physician_profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'facility')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Care physicians create own profile"
ON public.care_physician_profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'provider'));

CREATE POLICY "Care physicians update own profile"
ON public.care_physician_profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage care physician profiles"
ON public.care_physician_profiles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS care_physician_available_idx
  ON public.care_physician_profiles(is_available, registration_verified);
CREATE INDEX IF NOT EXISTS care_physician_areas_gin
  ON public.care_physician_profiles USING gin(preferred_areas);
CREATE INDEX IF NOT EXISTS care_physician_procedures_gin
  ON public.care_physician_profiles USING gin(procedures);

DROP TRIGGER IF EXISTS care_physician_profiles_updated_at ON public.care_physician_profiles;
CREATE TRIGGER care_physician_profiles_updated_at
BEFORE UPDATE ON public.care_physician_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.protect_care_physician_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin');
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.registration_verified, false) AND NOT is_admin THEN
      RAISE EXCEPTION 'Registration verification can only be granted by an administrator';
    END IF;
  ELSIF (NEW.registration_verified IS DISTINCT FROM OLD.registration_verified
      OR NEW.verified_at IS DISTINCT FROM OLD.verified_at) AND NOT is_admin THEN
    RAISE EXCEPTION 'Registration verification can only be changed by an administrator';
  END IF;
  IF NEW.registration_verified AND NEW.verified_at IS NULL THEN
    NEW.verified_at := now();
  ELSIF NOT NEW.registration_verified THEN
    NEW.verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS care_physician_verification_guard ON public.care_physician_profiles;
CREATE TRIGGER care_physician_verification_guard
BEFORE INSERT OR UPDATE ON public.care_physician_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_care_physician_verification();

ALTER TABLE public.staffing_jobs
  ADD COLUMN IF NOT EXISTS required_procedures text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS staffing_jobs_required_procedures_gin
  ON public.staffing_jobs USING gin(required_procedures);

-- Existing direct provider inserts must stay as applications only. Atomic acceptance uses the RPC below.
DROP POLICY IF EXISTS "staffing_assignments_apply_provider" ON public.staffing_assignments;
CREATE POLICY "staffing_assignments_apply_provider"
ON public.staffing_assignments FOR INSERT TO authenticated
WITH CHECK (
  provider_id = auth.uid()
  AND status = 'applied'
  AND public.has_role(auth.uid(),'provider')
  AND EXISTS (SELECT 1 FROM public.staffing_jobs j WHERE j.id = job_id AND j.status = 'open')
);

CREATE OR REPLACE FUNCTION public.guard_care_physician_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_job public.staffing_jobs%ROWTYPE;
  cp public.care_physician_profiles%ROWTYPE;
  gated_ids constant text[] := ARRAY['intubation','centralline','ventilator','acls','lp'];
  gated_needed boolean;
  accepted_count integer;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.job_id IS NOT DISTINCT FROM OLD.job_id
     AND NEW.provider_id IS NOT DISTINCT FROM OLD.provider_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO target_job FROM public.staffing_jobs WHERE id = NEW.job_id FOR UPDATE;
  IF target_job.id IS NULL THEN
    RAISE EXCEPTION 'Staffing opportunity not found';
  END IF;

  SELECT * INTO cp FROM public.care_physician_profiles WHERE user_id = NEW.provider_id;
  IF cp.user_id IS NULL THEN
    RAISE EXCEPTION 'Complete your Care Physician profile before applying for hospital duties';
  END IF;
  IF NOT cp.is_available AND NEW.status IN ('applied','shortlisted','accepted') THEN
    RAISE EXCEPTION 'Set yourself available before accepting a new duty';
  END IF;

  IF COALESCE(target_job.experience_years, 0) > COALESCE(cp.experience_years, 0) THEN
    RAISE EXCEPTION 'Minimum experience requirement is not met';
  END IF;

  IF target_job.qualification IS NOT NULL AND btrim(target_job.qualification) <> '' THEN
    IF NOT (
      lower(target_job.qualification) = lower(cp.qualification)
      OR (lower(target_job.qualification) = 'mbbs' AND lower(cp.qualification) IN ('md','dnb'))
      OR (lower(target_job.qualification) IN ('md','dnb') AND lower(cp.qualification) IN ('md','dnb'))
    ) THEN
      RAISE EXCEPTION 'Required qualification is not met';
    END IF;
  END IF;

  gated_needed := target_job.duty_type IN ('icu','cardiac_icu','nicu')
    OR COALESCE(target_job.required_procedures, '{}') && gated_ids;

  IF gated_needed AND NOT cp.registration_verified THEN
    RAISE EXCEPTION 'Registration verification pending: ICU and gated clinical duties are blocked';
  END IF;
  IF gated_needed AND NOT (cp.procedures && gated_ids) THEN
    RAISE EXCEPTION 'At least one verified critical-care procedure credential is required for this duty';
  END IF;
  IF COALESCE(array_length(target_job.required_procedures, 1), 0) > 0
     AND NOT (target_job.required_procedures <@ cp.procedures) THEN
    RAISE EXCEPTION 'Your profile does not include every required procedure for this duty';
  END IF;

  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    IF target_job.status <> 'open' THEN
      RAISE EXCEPTION 'This staffing opportunity is no longer open';
    END IF;
    SELECT count(*) INTO accepted_count
      FROM public.staffing_assignments
      WHERE job_id = NEW.job_id AND status = 'accepted'
        AND (TG_OP = 'INSERT' OR id <> NEW.id);
    IF accepted_count >= target_job.capacity THEN
      RAISE EXCEPTION 'This staffing opportunity is already filled';
    END IF;
    NEW.accepted_at := COALESCE(NEW.accepted_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS care_physician_assignment_guard_insert ON public.staffing_assignments;
CREATE TRIGGER care_physician_assignment_guard_insert
BEFORE INSERT ON public.staffing_assignments
FOR EACH ROW EXECUTE FUNCTION public.guard_care_physician_assignment();

DROP TRIGGER IF EXISTS care_physician_assignment_guard_update ON public.staffing_assignments;
CREATE TRIGGER care_physician_assignment_guard_update
BEFORE UPDATE OF status, job_id, provider_id ON public.staffing_assignments
FOR EACH ROW EXECUTE FUNCTION public.guard_care_physician_assignment();

CREATE OR REPLACE FUNCTION public.mark_staffing_job_filled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepted_count integer;
  cap integer;
BEGIN
  IF NEW.status <> 'accepted' THEN RETURN NEW; END IF;
  SELECT capacity INTO cap FROM public.staffing_jobs WHERE id = NEW.job_id;
  SELECT count(*) INTO accepted_count FROM public.staffing_assignments
    WHERE job_id = NEW.job_id AND status = 'accepted';
  IF accepted_count >= COALESCE(cap, 1) THEN
    UPDATE public.staffing_jobs SET status = 'filled', updated_at = now() WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staffing_job_fill_after_insert ON public.staffing_assignments;
CREATE TRIGGER staffing_job_fill_after_insert
AFTER INSERT ON public.staffing_assignments
FOR EACH ROW EXECUTE FUNCTION public.mark_staffing_job_filled();

DROP TRIGGER IF EXISTS staffing_job_fill_after_update ON public.staffing_assignments;
CREATE TRIGGER staffing_job_fill_after_update
AFTER UPDATE OF status ON public.staffing_assignments
FOR EACH ROW EXECUTE FUNCTION public.mark_staffing_job_filled();

CREATE OR REPLACE FUNCTION public.claim_staffing_job(_job_id uuid)
RETURNS TABLE(assignment_id uuid, assignment_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  target_job public.staffing_jobs%ROWTYPE;
  target_assignment public.staffing_assignments%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(uid, 'provider') THEN RAISE EXCEPTION 'Provider account required'; END IF;

  SELECT * INTO target_job FROM public.staffing_jobs WHERE id = _job_id FOR UPDATE;
  IF target_job.id IS NULL THEN RAISE EXCEPTION 'Staffing opportunity not found'; END IF;
  IF target_job.status <> 'open' THEN RAISE EXCEPTION 'This staffing opportunity is no longer open'; END IF;

  SELECT * INTO target_assignment
  FROM public.staffing_assignments
  WHERE job_id = _job_id AND provider_id = uid
  FOR UPDATE;

  IF target_assignment.id IS NULL THEN
    INSERT INTO public.staffing_assignments(job_id, provider_id, status, accepted_at)
    VALUES (_job_id, uid, 'accepted', now())
    RETURNING * INTO target_assignment;
  ELSE
    UPDATE public.staffing_assignments
       SET status = 'accepted', accepted_at = COALESCE(accepted_at, now()), updated_at = now()
     WHERE id = target_assignment.id
     RETURNING * INTO target_assignment;
  END IF;

  RETURN QUERY SELECT target_assignment.id, target_assignment.status;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_staffing_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_staffing_job(uuid) TO authenticated, service_role;

-- Keep completed-form capture inside the same Supabase project instead of a hidden external project.
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  form_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.form_submissions TO authenticated;
GRANT ALL ON public.form_submissions TO service_role;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own form submissions"
ON public.form_submissions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own form submissions"
ON public.form_submissions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE INDEX IF NOT EXISTS form_submissions_user_idx
  ON public.form_submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS form_submissions_type_idx
  ON public.form_submissions(form_type, created_at DESC);

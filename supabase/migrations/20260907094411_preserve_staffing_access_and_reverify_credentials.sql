-- Keep assigned jobs visible after they fill. The private membership helper
-- avoids jobs -> assignments -> jobs policy recursion and checks only the caller.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_staffing_assignment(_job_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.staffing_assignments a
    WHERE a.job_id = _job_id AND a.provider_id = (SELECT auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION private.has_staffing_assignment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_staffing_assignment(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "staffing_jobs_read_authorized" ON public.staffing_jobs;
CREATE POLICY "staffing_jobs_read_authorized"
ON public.staffing_jobs FOR SELECT TO authenticated
USING (
  facility_id = (SELECT auth.uid())
  OR status = 'open'
  OR public.has_role((SELECT auth.uid()), 'admin')
  OR public.has_role((SELECT auth.uid()), 'super_admin')
  OR private.has_staffing_assignment(id)
);

-- Verification applies to the identity/qualification reviewed by the admin.
-- Any change to those details invalidates the old verification, including changes
-- made by an admin; verification can then be explicitly granted in a separate step.
CREATE OR REPLACE FUNCTION public.protect_care_physician_verification()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_admin boolean := COALESCE(auth.role() = 'service_role', false)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.registration_verified, false) AND NOT is_admin THEN
      RAISE EXCEPTION 'Registration verification can only be granted by an administrator';
    END IF;
  ELSE
    IF (NEW.registration_verified IS DISTINCT FROM OLD.registration_verified
        OR NEW.verified_at IS DISTINCT FROM OLD.verified_at) AND NOT is_admin THEN
      RAISE EXCEPTION 'Registration verification can only be changed by an administrator';
    END IF;
    IF NEW.qualification IS DISTINCT FROM OLD.qualification
       OR NEW.council_name IS DISTINCT FROM OLD.council_name
       OR NEW.council_registration_number IS DISTINCT FROM OLD.council_registration_number THEN
      NEW.registration_verified := false;
      NEW.verified_at := NULL;
    END IF;
  END IF;
  IF NEW.registration_verified AND NEW.verified_at IS NULL THEN
    NEW.verified_at := now();
  ELSIF NOT NEW.registration_verified THEN
    NEW.verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_care_physician_verification() FROM PUBLIC, anon, authenticated;

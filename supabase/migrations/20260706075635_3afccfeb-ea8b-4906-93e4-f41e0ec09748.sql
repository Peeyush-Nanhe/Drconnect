
-- Drop the security-definer view we introduced
DROP VIEW IF EXISTS public.public_profiles;

-- Replace the owner-only SELECT policy with a broad one, and use column-level
-- privileges to keep sensitive columns (phone) out of the Data API.
DROP POLICY IF EXISTS "own or admin profile read" ON public.profiles;
CREATE POLICY "profiles readable non-sensitive"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Column-level grants: expose only safe columns to authenticated (and anon).
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, specialty, hub_id, lat, lng, view, last_seen_at, created_at, updated_at)
  ON public.profiles TO authenticated;
GRANT SELECT (id, full_name, specialty, view, last_seen_at)
  ON public.profiles TO anon;
-- Phone column deliberately not granted; only service_role (admin backend) can read it.

-- Harden has_role so signed-in users can only check their own role.
-- Triggers (which run without auth.uid()) still work.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

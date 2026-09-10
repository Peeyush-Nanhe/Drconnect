-- Secure provider/facility onboarding.
-- New auth users always receive patient access. A claimed provider/facility role is
-- stored only as a pending request and must be approved by a super administrator.

-- Defence in depth for databases upgraded from early demo builds.
DROP TRIGGER IF EXISTS seed_demo_admin_roles_trg ON auth.users;
DROP TRIGGER IF EXISTS seed_demo_admin_roles ON auth.users;
DROP TRIGGER IF EXISTS trg_seed_demo_admin_roles ON auth.users;
DROP FUNCTION IF EXISTS public.seed_demo_admin_roles() CASCADE;

CREATE TABLE IF NOT EXISTS public.account_role_requests (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_role public.app_role NOT NULL CHECK (requested_role IN ('provider','facility')),
  requested_view text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.account_role_requests TO authenticated;
GRANT ALL ON public.account_role_requests TO service_role;
ALTER TABLE public.account_role_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own role request"
ON public.account_role_requests FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins read role requests"
ON public.account_role_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Users create own pending role request"
ON public.account_role_requests FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
  AND requested_role IN ('provider','facility')
);

CREATE POLICY "Users update own pending role request"
ON public.account_role_requests FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND requested_role IN ('provider','facility'));

CREATE POLICY "Admins manage role requests"
ON public.account_role_requests FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS account_role_requests_updated_at ON public.account_role_requests;
CREATE TRIGGER account_role_requests_updated_at
BEFORE UPDATE ON public.account_role_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.protect_account_role_request_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  privileged boolean;
BEGIN
  privileged := auth.role() = 'service_role'
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin');

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' AND NOT privileged THEN
      RAISE EXCEPTION 'New access requests must start as pending';
    END IF;
  ELSIF NOT privileged AND (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
    OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
  ) THEN
    RAISE EXCEPTION 'Only administrators can review an access request';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_role_request_review_guard ON public.account_role_requests;
CREATE TRIGGER account_role_request_review_guard
BEFORE INSERT OR UPDATE ON public.account_role_requests
FOR EACH ROW EXECUTE FUNCTION public.protect_account_role_request_review();

-- Replace the temporary demo-admin signup function. Never trust client metadata
-- to directly grant provider, facility or administrator privileges.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested text := lower(COALESCE(NEW.raw_user_meta_data->>'role',''));
  requested_view text := NULLIF(NEW.raw_user_meta_data->>'subtype','');
  signup_kind text := lower(COALESCE(NEW.raw_user_meta_data->>'kind',''));
BEGIN
  IF signup_kind = 'doctor' AND requested_view IS NULL THEN
    requested_view := 'medico';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, view)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.phone,
    requested_view
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient'::public.app_role)
  ON CONFLICT DO NOTHING;

  IF requested IN ('provider','facility') THEN
    INSERT INTO public.account_role_requests(user_id, requested_role, requested_view, status)
    VALUES (NEW.id, requested::public.app_role, requested_view, 'pending')
    ON CONFLICT (user_id) DO UPDATE
      SET requested_role = EXCLUDED.requested_role,
          requested_view = COALESCE(EXCLUDED.requested_view, public.account_role_requests.requested_view),
          status = CASE WHEN public.account_role_requests.status = 'approved' THEN 'approved' ELSE 'pending' END,
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE INDEX IF NOT EXISTS account_role_requests_status_idx
  ON public.account_role_requests(status, requested_role, created_at DESC);

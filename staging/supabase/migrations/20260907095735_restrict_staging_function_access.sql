-- These lookups already have participant RLS policies on their source tables.
-- Execute as the caller so arbitrary IDs cannot bypass those policies.
ALTER FUNCTION public.get_active_family_plan(uuid) SECURITY INVOKER;
ALTER FUNCTION public.check_family_plan_call_entitlement(uuid, text) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.get_active_family_plan(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_family_plan_call_entitlement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_family_plan(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_family_plan_call_entitlement(uuid, text) TO authenticated, service_role;

-- Submitting an application is not approval. Membership requires an approved
-- provider role AND an administrator-verified coordinator application.
CREATE OR REPLACE FUNCTION public.is_active_coordinator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND _user_id = (SELECT auth.uid())
    AND (
      public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'super_admin')
      OR (public.has_role(_user_id, 'provider') AND EXISTS (
        SELECT 1 FROM public.coordinator_profiles cp
        WHERE cp.user_id = _user_id AND cp.application_status = 'verified'
      ))
    );
$$;
REVOKE ALL ON FUNCTION public.is_active_coordinator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_coordinator(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.protect_coordinator_review()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  privileged boolean := COALESCE(auth.role() = 'service_role', false)
    OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin');
BEGIN
  IF NOT privileged THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.application_status NOT IN ('draft','submitted') OR NEW.verified_at IS NOT NULL THEN
        RAISE EXCEPTION 'Only an administrator can verify a coordinator';
      END IF;
    ELSIF NEW.verified_at IS DISTINCT FROM OLD.verified_at
       OR (NEW.application_status IS DISTINCT FROM OLD.application_status AND (
         OLD.application_status NOT IN ('draft','submitted','rejected')
         OR NEW.application_status NOT IN ('draft','submitted')
       )) THEN
      RAISE EXCEPTION 'Only an administrator can change coordinator approval';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.protect_coordinator_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER coordinator_review_guard
BEFORE INSERT OR UPDATE ON public.coordinator_profiles
FOR EACH ROW EXECUTE FUNCTION private.protect_coordinator_review();

-- Trigger-only routines need no direct API execution. Other privileged helpers
-- are authenticated operations; retain their signed-in grants and internal use.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature, p.prorettype = 'trigger'::regtype AS is_trigger
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
  LOOP
    IF fn.is_trigger THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.signature);
    END IF;
  END LOOP;
END;
$$;

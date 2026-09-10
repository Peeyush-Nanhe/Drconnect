
-- 1) Remove demo admin backdoor
DROP TRIGGER IF EXISTS seed_demo_admin_roles ON auth.users;
DROP TRIGGER IF EXISTS trg_seed_demo_admin_roles ON auth.users;
DROP FUNCTION IF EXISTS public.seed_demo_admin_roles() CASCADE;

-- 2) Fix request_audit_log INSERT policy (remove open-status clause)
DROP POLICY IF EXISTS audit_insert_participants_or_admin ON public.request_audit_log;
CREATE POLICY audit_insert_participants_or_admin
ON public.request_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  ((actor_id IS NULL) OR (actor_id = auth.uid()))
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.care_requests cr
      WHERE cr.id = request_audit_log.request_id
        AND (cr.patient_id = auth.uid() OR cr.accepted_by = auth.uid())
    )
  )
);

-- 3) Revoke EXECUTE on SECURITY DEFINER trigger-only functions
-- These are invoked by triggers, not by API callers.
REVOKE ALL ON FUNCTION public.handle_new_user()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_care_request_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_care_request_event()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autosave_my_medico()          FROM PUBLIC, anon, authenticated;
-- has_role is intentionally kept executable by authenticated because RLS policies invoke it.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

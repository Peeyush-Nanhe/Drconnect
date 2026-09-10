
-- 1) Restrict access to sensitive PII (phone) on public.profiles.
--    Table-level GRANT SELECT trumps column-level revokes, so we swap to
--    an explicit column allow-list that excludes 'phone'. Owner reads of
--    their own phone happen through the service role (admin server fns).
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, hub_id, lat, lng, specialty, view, last_seen_at, created_at, updated_at)
  ON public.profiles TO authenticated;

-- 2) Revoke EXECUTE on SECURITY DEFINER functions that should never be
--    called directly by signed-in users. Trigger functions run regardless
--    of role EXECUTE. has_role() must remain callable by authenticated
--    because RLS policies invoke it as the querying role.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_care_request_update()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_care_request_event()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.autosave_my_medico()           FROM PUBLIC, anon, authenticated;

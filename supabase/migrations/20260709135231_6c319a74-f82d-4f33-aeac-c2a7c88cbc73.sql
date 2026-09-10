REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.autosave_my_medico() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_care_request_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_care_request_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_favorite_medicos_updated_at() FROM PUBLIC, anon, authenticated;
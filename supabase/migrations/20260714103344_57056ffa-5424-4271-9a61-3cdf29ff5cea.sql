REVOKE EXECUTE ON FUNCTION public.find_provider_user_id_by_name(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_provider_user_id_by_name(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_provider_user_id_by_name(text) TO authenticated;
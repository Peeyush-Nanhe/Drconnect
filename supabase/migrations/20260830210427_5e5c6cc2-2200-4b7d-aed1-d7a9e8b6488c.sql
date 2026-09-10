REVOKE ALL ON FUNCTION public.enforce_staffing_capacity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_staffing_capacity() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_staffing_capacity() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_staffing_capacity() TO service_role;
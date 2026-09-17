-- Migration: 20260917140000_pc_chat_inbox_stub.sql
-- Provide public.pc_chat_inbox RPC returning empty list when canonical post-consultation chat tables are not active,
-- preventing 404 (PGRST202) schema cache misses on inbox polls.

CREATE OR REPLACE FUNCTION public.pc_chat_inbox()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT '[]'::jsonb;
$$;

REVOKE ALL ON FUNCTION public.pc_chat_inbox() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pc_chat_inbox() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pc_chat_inbox() TO service_role;

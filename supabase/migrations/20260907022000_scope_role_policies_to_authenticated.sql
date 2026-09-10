-- Recovered security hardening from the earlier codebase.
-- Policies that call has_role() are authorization checks for signed-in users.
-- Restrict legacy PUBLIC-role policies to authenticated so anonymous reads do not
-- attempt to execute the deliberately protected has_role() authorization helper.
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles = ARRAY['public']::name[]
      AND (
        COALESCE(qual, '') ILIKE '%has_role%'
        OR COALESCE(with_check, '') ILIKE '%has_role%'
      )
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;

-- READ ONLY. Run first in the intended STAGING project. No phone/GPS/patient names.
-- Current observation on 12 September 2026: V2 tables absent, pg_cron absent,
-- one legacy ambulance row still at 'arrived'. Do not auto-close real cases.
SELECT current_database() AS database_name,
       to_regclass('public.profiles') AS profiles,
       to_regclass('public.user_roles') AS roles,
       to_regclass('public.account_role_requests') AS approvals,
       to_regclass('public.hospitals') AS hospitals,
       to_regclass('public.emergency_cases') AS existing_emergency_cases,
       EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='emergency_private') AS emergency_private_exists,
       EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') AS cron_installed;
SELECT status,count(*) AS legacy_case_count FROM public.ambulance_requests GROUP BY status;
-- Existing V2 objects: STOP and reconcile migrations rather than dropping tables.
-- For first installation: 01_dispatch_core.sql leaves dispatch DISABLED by default.
-- Enable pg_cron, then review/run 02_schedule_dispatch.sql and 03_verify_installation.sql.
-- The authorized administrator must properly finish old cases before enabling cutover.

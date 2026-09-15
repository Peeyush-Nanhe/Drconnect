-- READ-ONLY health check after 01_dispatch_core.sql and 02_schedule_dispatch.sql.
-- Run as the authorized database administrator. Contains no patient/phone/GPS output.
SELECT to_regclass('public.emergency_cases') AS case_table,
       to_regclass('public.emergency_offers') AS offer_table,
       to_regclass('public.emergency_positions') AS position_table,
       to_regprocedure('public.emergency_command(text,jsonb)') AS checked_command;
SELECT enabled,preferred_seconds,initial_radius_km,max_radius_km,worker_checked_at,
       worker_checked_at > clock_timestamp()-interval '30 seconds' AS worker_recent
FROM emergency_private.settings;
SELECT c.relname AS table_name,c.relrowsecurity AS row_security_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('emergency_cases','emergency_offers','emergency_events','emergency_notifications','emergency_positions') ORDER BY 1;
SELECT kind,count(*) AS configured_resources,count(*) FILTER(WHERE enabled) AS switched_on
FROM emergency_private.resources GROUP BY kind ORDER BY kind;
SELECT schemaname,tablename FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND tablename LIKE 'emergency_%' ORDER BY tablename;
-- After enabling pg_cron, inspect the named jobs and recent run status:
SELECT jobname,schedule,active FROM cron.job
WHERE jobname IN ('mydox-emergency-dispatch-v2','mydox-emergency-position-retention');
SELECT j.jobname,r.status,r.return_message,r.start_time,r.end_time
FROM cron.job_run_details r JOIN cron.job j USING(jobid)
WHERE j.jobname='mydox-emergency-dispatch-v2' ORDER BY r.start_time DESC LIMIT 5;

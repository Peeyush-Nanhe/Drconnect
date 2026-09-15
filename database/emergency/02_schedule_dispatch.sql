-- Run AFTER 01_dispatch_core.sql in the same staging project.
-- Enable Supabase Cron / pg_cron in Dashboard -> Integrations first.
-- This worker creates offers and advances escalation even when patient apps are closed.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('emergency_private.tick()') IS NULL THEN RAISE EXCEPTION 'Install dispatch core first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  RAISE EXCEPTION 'Enable Supabase Cron (pg_cron) first, then run this scheduling script';
 END IF;
END $$;
SELECT cron.schedule('mydox-emergency-dispatch-v2','10 seconds','SELECT emergency_private.tick();');
-- Latest-position retention only. Audit/event records are retained separately for operator policy.
SELECT cron.schedule('mydox-emergency-position-retention','15 * * * *',
 $$DELETE FROM public.emergency_positions p USING public.emergency_cases c
   WHERE p.case_id=c.id AND c.state<>'open' AND c.updated_at<clock_timestamp()-interval '24 hours';$$);
COMMIT;
-- Monitor cron.job_run_details and emergency_dashboard('admin').worker_checked_at.
-- Schedule intervals are targets, not delivery/response SLAs.

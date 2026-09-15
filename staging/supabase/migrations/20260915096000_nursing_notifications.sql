-- ============================================================================
-- Nursing: notifications, on the outbox pattern already in this database.
--
-- home_visit_notification_jobs, chat_notification_outbox and
-- clinic_notification_jobs already exist. A fourth shape would mean a fourth
-- worker, so this one is deliberately the same: a durable row per recipient,
-- a dedupe key, a lease, and retries with backoff.
--
-- Enqueueing is done by triggers rather than by each RPC. Every path that
-- creates an offer or moves a day then notifies, including ones added later.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nursing_notification_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL,
  recipient_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engagement_id uuid REFERENCES public.nursing_engagements(id) ON DELETE CASCADE,
  visit_id      uuid REFERENCES public.nursing_visits(id) ON DELETE CASCADE,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel       text NOT NULL DEFAULT 'push',
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','sent','failed','disabled')),
  attempts      integer NOT NULL DEFAULT 0,
  available_at  timestamptz NOT NULL DEFAULT now(),
  locked_at     timestamptz,
  lease_token   uuid,
  sent_at       timestamptz,
  last_error    text,
  dedupe_key    text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nursing_jobs_due_idx
  ON public.nursing_notification_jobs (status, available_at);
CREATE INDEX IF NOT EXISTS nursing_jobs_recipient_idx
  ON public.nursing_notification_jobs (recipient_id, created_at DESC);

ALTER TABLE public.nursing_notification_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nursing_notification_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.nursing_notification_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.nursing_enqueue_notification(
  p_kind text, p_recipient uuid, p_engagement uuid, p_visit uuid,
  p_payload jsonb DEFAULT '{}'::jsonb, p_dedupe text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_recipient IS NULL THEN RETURN; END IF;
  INSERT INTO public.nursing_notification_jobs
    (kind, recipient_id, engagement_id, visit_id, payload, dedupe_key)
  VALUES (p_kind, p_recipient, p_engagement, p_visit, COALESCE(p_payload,'{}'::jsonb),
          COALESCE(p_dedupe,
            p_kind || ':' || p_recipient::text || ':' ||
            COALESCE(p_visit::text, p_engagement::text, gen_random_uuid()::text)))
  ON CONFLICT (dedupe_key) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.nursing_enqueue_notification(text, uuid, uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- triggers ----
CREATE OR REPLACE FUNCTION public.nursing_notify_engagement_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_eng public.nursing_engagements;
BEGIN
  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = NEW.engagement_id;
  PERFORM public.nursing_enqueue_notification(
    CASE WHEN v_eng.preferred_nurse_id = NEW.nurse_id
         THEN 'nursing.offer.preferred' ELSE 'nursing.offer.broadcast' END,
    NEW.nurse_id, NEW.engagement_id, NULL,
    jsonb_build_object('days', NEW.days_offered, 'amount', NEW.offer_amount,
                       'start_date', v_eng.start_date, 'kind', v_eng.kind));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tr_nursing_notify_engagement_offer ON public.nursing_engagement_offers;
CREATE TRIGGER tr_nursing_notify_engagement_offer
  AFTER INSERT ON public.nursing_engagement_offers
  FOR EACH ROW EXECUTE FUNCTION public.nursing_notify_engagement_offer();

CREATE OR REPLACE FUNCTION public.nursing_notify_visit_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_visit public.nursing_visits;
BEGIN
  SELECT * INTO v_visit FROM public.nursing_visits WHERE id = NEW.visit_id;
  PERFORM public.nursing_enqueue_notification(
    'nursing.cover.offer', NEW.nurse_id, v_visit.engagement_id, NEW.visit_id,
    jsonb_build_object('visit_date', v_visit.visit_date, 'amount', NEW.offer_amount));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tr_nursing_notify_visit_offer ON public.nursing_visit_offers;
CREATE TRIGGER tr_nursing_notify_visit_offer
  AFTER INSERT ON public.nursing_visit_offers
  FOR EACH ROW EXECUTE FUNCTION public.nursing_notify_visit_offer();

CREATE OR REPLACE FUNCTION public.nursing_notify_engagement_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignment_state = 'assigned' AND OLD.assignment_state <> 'assigned' THEN
    PERFORM public.nursing_enqueue_notification(
      'nursing.assigned.patient', NEW.patient_id, NEW.id, NULL,
      jsonb_build_object('nurse_id', NEW.primary_nurse_id, 'start_date', NEW.start_date),
      'nursing.assigned.patient:' || NEW.id::text);
    PERFORM public.nursing_enqueue_notification(
      'nursing.assigned.nurse', NEW.primary_nurse_id, NEW.id, NULL,
      jsonb_build_object('days', NEW.days_scheduled, 'start_date', NEW.start_date),
      'nursing.assigned.nurse:' || NEW.id::text);
  ELSIF NEW.assignment_state = 'unfilled' AND OLD.assignment_state <> 'unfilled' THEN
    -- The family has paid and nobody came. This one must never be silent.
    PERFORM public.nursing_enqueue_notification(
      'nursing.unfilled', NEW.patient_id, NEW.id, NULL,
      jsonb_build_object('start_date', NEW.start_date, 'amount', NEW.total_amount),
      'nursing.unfilled:' || NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tr_nursing_notify_engagement_state ON public.nursing_engagements;
CREATE TRIGGER tr_nursing_notify_engagement_state
  AFTER UPDATE OF assignment_state ON public.nursing_engagements
  FOR EACH ROW EXECUTE FUNCTION public.nursing_notify_engagement_state();

CREATE OR REPLACE FUNCTION public.nursing_notify_visit_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_patient uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT patient_id INTO v_patient
    FROM public.nursing_engagements WHERE id = NEW.engagement_id;

  IF NEW.status = 'en_route' THEN
    PERFORM public.nursing_enqueue_notification('nursing.en_route', v_patient,
      NEW.engagement_id, NEW.id, jsonb_build_object('nurse_id', NEW.assigned_nurse_id),
      'nursing.en_route:' || NEW.id::text);
  ELSIF NEW.status = 'arrived' THEN
    PERFORM public.nursing_enqueue_notification('nursing.arrived', v_patient,
      NEW.engagement_id, NEW.id, '{}'::jsonb, 'nursing.arrived:' || NEW.id::text);
  ELSIF NEW.status = 'seeking_cover' THEN
    PERFORM public.nursing_enqueue_notification('nursing.day_released', v_patient,
      NEW.engagement_id, NEW.id,
      jsonb_build_object('visit_date', NEW.visit_date, 'notice_hours', NEW.notice_hours),
      'nursing.day_released:' || NEW.id::text);
  ELSIF NEW.status = 'missed' THEN
    PERFORM public.nursing_enqueue_notification('nursing.day_missed', v_patient,
      NEW.engagement_id, NEW.id, jsonb_build_object('visit_date', NEW.visit_date),
      'nursing.day_missed:' || NEW.id::text);
  ELSIF NEW.status = 'completed' THEN
    PERFORM public.nursing_enqueue_notification('nursing.day_completed', v_patient,
      NEW.engagement_id, NEW.id, jsonb_build_object('visit_date', NEW.visit_date),
      'nursing.day_completed:' || NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tr_nursing_notify_visit_status ON public.nursing_visits;
CREATE TRIGGER tr_nursing_notify_visit_status
  AFTER UPDATE OF status ON public.nursing_visits
  FOR EACH ROW EXECUTE FUNCTION public.nursing_notify_visit_status();

-- ---------------------------------------------------------------- worker ---
CREATE OR REPLACE FUNCTION public.nursing_notification_claim(p_limit integer DEFAULT 25)
RETURNS SETOF public.nursing_notification_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lease uuid := gen_random_uuid();
BEGIN
  RETURN QUERY
  UPDATE public.nursing_notification_jobs j
     SET status = 'processing', locked_at = now(), lease_token = v_lease,
         attempts = j.attempts + 1
   WHERE j.id IN (
     SELECT id FROM public.nursing_notification_jobs
      WHERE status = 'pending' AND available_at <= now()
      ORDER BY available_at
      FOR UPDATE SKIP LOCKED
      LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 200)))
  RETURNING j.*;
END $$;

CREATE OR REPLACE FUNCTION public.nursing_notification_settle(
  p_id uuid, p_lease uuid, p_ok boolean, p_error text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.nursing_notification_jobs
     SET status = CASE WHEN p_ok THEN 'sent'
                       WHEN attempts >= 5 THEN 'failed'
                       ELSE 'pending' END,
         sent_at = CASE WHEN p_ok THEN now() ELSE sent_at END,
         last_error = CASE WHEN p_ok THEN NULL ELSE left(p_error, 500) END,
         -- Backoff: 1, 2, 4, 8, 16 minutes.
         available_at = CASE WHEN p_ok THEN available_at
                             ELSE now() + make_interval(mins => power(2, least(attempts,4))::int) END,
         locked_at = NULL, lease_token = NULL
   WHERE id = p_id AND lease_token = p_lease;
END $$;

REVOKE ALL ON FUNCTION public.nursing_notification_claim(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nursing_notification_settle(uuid, uuid, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nursing_notification_claim(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.nursing_notification_settle(uuid, uuid, boolean, text) TO service_role;

-- One place for the cron to call.
CREATE OR REPLACE FUNCTION public.nursing_cron_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_escalated integer; v_unfilled integer; v_missed integer;
BEGIN
  v_escalated := public.nursing_escalation_tick();
  v_unfilled  := public.nursing_sweep_unfilled();
  v_missed    := public.nursing_tick();
  RETURN jsonb_build_object('escalated', v_escalated,
                            'unfilled', v_unfilled, 'missed', v_missed);
END $$;
REVOKE ALL ON FUNCTION public.nursing_cron_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nursing_cron_tick() TO service_role;

-- The cron and the notification worker run as service_role. Revoking from
-- PUBLIC also removes service_role's inherited EXECUTE, so grant it back
-- explicitly or the sweeps fail with "permission denied for function".
GRANT EXECUTE ON FUNCTION public.nursing_enqueue_notification(text, uuid, uuid, uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_nursing_engagement(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_nursing_visit(uuid)      TO service_role;
GRANT EXECUTE ON FUNCTION public.nursing_roster(double precision, double precision, numeric, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.escalate_nursing_engagement(uuid)  TO service_role;

-- ============================================================================
-- Module-wide grant hardening.
--
-- Postgres grants EXECUTE to PUBLIC by default and anon inherits it, so a
-- SECURITY DEFINER function is reachable anonymously unless it is revoked —
-- and a SECURITY DEFINER trigger function reachable by authenticated is an RPC
-- nobody meant to publish. database.test.mjs asserts both. Close the whole
-- module in one sweep, then re-grant only what a client legitimately calls.
-- ============================================================================
DO $$
DECLARE v_fn record;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure AS sig,
           p.prorettype = 'trigger'::regtype AS is_trigger
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef AND p.proname LIKE '%nursing%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_fn.sig);
    IF v_fn.is_trigger THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', v_fn.sig);
    END IF;
  END LOOP;
END $$;

-- Client surface.
GRANT EXECUTE ON FUNCTION public.create_nursing_engagement(
  integer, date, time, text, text, double precision, double precision, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_nursing_engagement(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_nursing_engagement(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_nursing_engagement_offers()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_nursing_engagement(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_nursing_visit(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_nursing_visit(uuid, text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_nursing_visit_by_family(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_nursing_visit(uuid, public.nursing_visit_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_nursing_offers()                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.nursing_nurse_conflicts(uuid, uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_nursing_arrival_code(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_nursing_arrival(uuid, text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.nursing_visit_directions(uuid)             TO authenticated;

-- Server surface.
GRANT EXECUTE ON FUNCTION public.nursing_tick()                             TO service_role;
GRANT EXECUTE ON FUNCTION public.nursing_sweep_unfilled()                   TO service_role;
GRANT EXECUTE ON FUNCTION public.nursing_escalation_tick()                  TO service_role;
GRANT EXECUTE ON FUNCTION public.nursing_cron_tick()                        TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_nursing_engagement(uuid)         TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_nursing_visit(uuid)              TO service_role;
GRANT EXECUTE ON FUNCTION public.nursing_roster(double precision, double precision, numeric, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.nursing_enqueue_notification(text, uuid, uuid, uuid, jsonb, text)   TO service_role;
GRANT EXECUTE ON FUNCTION public.nursing_notification_claim(integer)        TO service_role;
GRANT EXECUTE ON FUNCTION public.nursing_notification_settle(uuid, uuid, boolean, text) TO service_role;

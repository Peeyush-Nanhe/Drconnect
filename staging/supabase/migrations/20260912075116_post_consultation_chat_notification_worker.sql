-- Notification delivery stays off. Only newly queued synthetic chat events can
-- be dispatched after an operator explicitly configures the channel and worker.
CREATE TABLE public.chat_notification_delivery_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  channel text NOT NULL DEFAULT 'fcm' CHECK (channel = 'fcm')
);
INSERT INTO public.chat_notification_delivery_config(singleton) VALUES (true);
ALTER TABLE public.chat_notification_delivery_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_notification_delivery_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.chat_notification_delivery_config TO service_role;

ALTER TABLE public.chat_notification_outbox
  DROP CONSTRAINT chat_notification_outbox_status_check,
  ADD CONSTRAINT chat_notification_outbox_status_check CHECK (status IN ('disabled','pending','processing','accepted','failed','cancelled')),
  ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  ADD COLUMN available_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN locked_at timestamptz,
  ADD COLUMN lease_token uuid,
  ADD COLUMN accepted_at timestamptz,
  ADD COLUMN last_error text;
CREATE INDEX chat_notification_claim_idx ON public.chat_notification_outbox(available_at,created_at,id)
  WHERE status IN ('pending','failed','processing');

-- A recorded provider acceptance is final for an event/device/token snapshot.
-- A provider timeout or crash before recording remains an unknown outcome:
-- retries can duplicate external delivery; the stable event_id is the app key.
CREATE TABLE public.chat_notification_device_deliveries (
  event_id uuid NOT NULL REFERENCES public.chat_notification_outbox(id) ON DELETE CASCADE,
  device_token_id uuid NOT NULL REFERENCES public.device_tokens(id) ON DELETE CASCADE,
  token_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','failed','invalid')),
  provider_message_id text CHECK (length(provider_message_id) <= 300),
  accepted_at timestamptz,
  PRIMARY KEY(event_id,device_token_id),
  CHECK ((status = 'accepted') = (accepted_at IS NOT NULL AND provider_message_id IS NOT NULL))
);
CREATE INDEX chat_notification_device_idx ON public.chat_notification_device_deliveries(device_token_id);
ALTER TABLE public.chat_notification_device_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_notification_device_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_notification_device_deliveries TO service_role;

CREATE FUNCTION private.pc_chat_notification_allowed(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_notification_outbox n
    JOIN public.chat_conversations c ON c.id = n.conversation_id
    JOIN public.chat_consultation_episodes e ON e.id = n.episode_id AND e.conversation_id = c.id
    WHERE n.id = p_id AND c.revoked_at IS NULL
      AND n.recipient_id IN (c.patient_id,c.provider_id)
      AND private.pc_chat_enabled(c.patient_id) AND private.pc_chat_enabled(c.provider_id)
      AND private.pc_chat_doctor(c.provider_id)
      AND (
        (n.event_kind = 'message_saved' AND n.prescription_request_id IS NULL AND EXISTS (
          SELECT 1 FROM public.chat_messages m WHERE m.id = n.message_id
          AND m.conversation_id = c.id AND m.episode_id = e.id AND m.recipient_id = n.recipient_id
          AND m.sender_id IN (c.patient_id,c.provider_id) AND m.sender_id <> n.recipient_id
        )) OR (n.message_id IS NULL AND EXISTS (
          SELECT 1 FROM public.chat_prescription_requests r
          JOIN public.chat_prescription_events v ON v.request_id = r.id
          WHERE r.id = n.prescription_request_id AND r.conversation_id = c.id AND r.episode_id = e.id
          AND r.requested_by = c.patient_id AND n.event_kind = 'prescription_' || v.to_status
          AND ((v.to_status = 'requested' AND v.actor_id = c.patient_id AND n.recipient_id = c.provider_id)
            OR (v.to_status IN ('reviewing','declined') AND v.actor_id = c.provider_id AND n.recipient_id = c.patient_id))
        ))
      )
  )
$$;

CREATE FUNCTION private.pc_chat_queue_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT enabled FROM public.chat_notification_delivery_config WHERE singleton)
    AND private.pc_chat_notification_allowed(NEW.id) THEN
    UPDATE public.chat_notification_outbox SET status = 'pending' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER pc_chat_queue_notification AFTER INSERT ON public.chat_notification_outbox
FOR EACH ROW EXECUTE FUNCTION private.pc_chat_queue_notification();

CREATE FUNCTION private.pc_chat_claim_notifications(p_limit integer DEFAULT 10) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n public.chat_notification_outbox; result jsonb := '[]'::jsonb; lease uuid;
BEGIN
  IF NOT COALESCE((SELECT enabled FROM public.chat_notification_delivery_config WHERE singleton),false) THEN RETURN result; END IF;
  UPDATE public.chat_notification_outbox SET status = 'failed', lease_token = NULL, last_error = 'Worker lease exhausted'
    WHERE status = 'processing' AND attempts = 5 AND locked_at < now() - interval '5 minutes';
  FOR n IN SELECT * FROM public.chat_notification_outbox
    WHERE attempts < 5 AND ((status IN ('pending','failed') AND available_at <= now())
      OR (status = 'processing' AND locked_at < now() - interval '5 minutes'))
    ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT least(greatest(COALESCE(p_limit,10),1),20)
  LOOP
    IF NOT private.pc_chat_notification_allowed(n.id) THEN
      UPDATE public.chat_notification_outbox SET status = 'cancelled', lease_token = NULL, last_error = 'Recipient access unavailable' WHERE id = n.id;
      CONTINUE;
    END IF;
    lease := gen_random_uuid();
    UPDATE public.chat_notification_outbox SET status = 'processing', attempts = attempts + 1, locked_at = now(), lease_token = lease, last_error = NULL WHERE id = n.id;
    result := result || jsonb_build_array(jsonb_build_object('id',n.id,'conversation_id',n.conversation_id,'episode_id',n.episode_id,'lease_token',lease));
  END LOOP;
  RETURN result;
END
$$;

CREATE FUNCTION private.pc_chat_notification_lease(p_id uuid,p_lease_token uuid) RETURNS public.chat_notification_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n public.chat_notification_outbox;
BEGIN
  SELECT * INTO n FROM public.chat_notification_outbox WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR n.status <> 'processing' OR p_lease_token IS NULL OR n.lease_token IS DISTINCT FROM p_lease_token
    OR n.locked_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Notification worker lease is stale' USING ERRCODE = '40001';
  END IF;
  RETURN n;
END
$$;

CREATE FUNCTION private.pc_chat_prepare_notification(p_id uuid,p_lease_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n public.chat_notification_outbox;
BEGIN
  n := private.pc_chat_notification_lease(p_id,p_lease_token);
  IF NOT COALESCE((SELECT enabled FROM public.chat_notification_delivery_config WHERE singleton),false)
    OR NOT private.pc_chat_notification_allowed(p_id) THEN RETURN '[]'::jsonb; END IF;
  INSERT INTO public.chat_notification_device_deliveries(event_id,device_token_id,token_fingerprint)
    SELECT n.id,t.id,md5(t.token) FROM public.device_tokens t
    WHERE t.user_id = n.recipient_id AND t.enabled AND t.provider = 'fcm'
    ORDER BY t.id LIMIT 20 ON CONFLICT(event_id,device_token_id) DO NOTHING;
  RETURN (SELECT COALESCE(jsonb_agg(device_token_id ORDER BY device_token_id),'[]'::jsonb)
    FROM public.chat_notification_device_deliveries WHERE event_id = n.id AND status IN ('pending','failed'));
END
$$;

-- Recheck immediately before each device send, including changed device owner,
-- token rotation, opt-out, clinician eligibility and both conversation members.
CREATE FUNCTION private.pc_chat_authorize_notification_device(p_id uuid,p_lease_token uuid,p_device_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n public.chat_notification_outbox; token_value text;
BEGIN
  n := private.pc_chat_notification_lease(p_id,p_lease_token);
  IF NOT COALESCE((SELECT enabled FROM public.chat_notification_delivery_config WHERE singleton),false)
    OR NOT private.pc_chat_notification_allowed(p_id) THEN RETURN NULL; END IF;
  SELECT t.token INTO token_value FROM public.chat_notification_device_deliveries d
    JOIN public.device_tokens t ON t.id = d.device_token_id
    WHERE d.event_id = n.id AND d.device_token_id = p_device_id AND d.status IN ('pending','failed')
      AND t.user_id = n.recipient_id AND t.enabled AND t.provider = 'fcm' AND md5(t.token) = d.token_fingerprint;
  IF NOT FOUND THEN
    UPDATE public.chat_notification_device_deliveries SET status = 'invalid'
      WHERE event_id = n.id AND device_token_id = p_device_id AND status IN ('pending','failed');
    RETURN NULL;
  END IF;
  UPDATE public.chat_notification_outbox SET locked_at = now() WHERE id = n.id;
  RETURN jsonb_build_object('token',token_value);
END
$$;

CREATE FUNCTION private.pc_chat_record_notification_device(p_id uuid,p_lease_token uuid,p_device_id uuid,p_outcome text,p_provider_id text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n public.chat_notification_outbox; fingerprint text;
BEGIN
  n := private.pc_chat_notification_lease(p_id,p_lease_token);
  IF p_outcome NOT IN ('accepted','failed','invalid') OR p_outcome IS NULL
    OR (p_outcome = 'accepted' AND (NULLIF(trim(p_provider_id),'') IS NULL OR length(p_provider_id) > 300)) THEN
    RAISE EXCEPTION 'Valid notification provider result required';
  END IF;
  UPDATE public.chat_notification_device_deliveries SET status = p_outcome,
    provider_message_id = CASE WHEN p_outcome = 'accepted' THEN p_provider_id ELSE NULL END,
    accepted_at = CASE WHEN p_outcome = 'accepted' THEN now() ELSE NULL END
    WHERE event_id = n.id AND device_token_id = p_device_id AND status IN ('pending','failed')
    RETURNING token_fingerprint INTO fingerprint;
  IF NOT FOUND THEN RAISE EXCEPTION 'Notification device result is already final or not targeted'; END IF;
  IF p_outcome = 'invalid' THEN
    UPDATE public.device_tokens SET enabled = false WHERE id = p_device_id AND user_id = n.recipient_id AND md5(token) = fingerprint;
  END IF;
END
$$;

CREATE FUNCTION private.pc_chat_finish_notification(p_id uuid,p_lease_token uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n public.chat_notification_outbox; outcome text; failure text;
BEGIN
  n := private.pc_chat_notification_lease(p_id,p_lease_token);
  IF NOT COALESCE((SELECT enabled FROM public.chat_notification_delivery_config WHERE singleton),false)
    OR NOT private.pc_chat_notification_allowed(p_id) THEN outcome := 'cancelled'; failure := 'Recipient access or delivery channel unavailable';
  ELSIF EXISTS (SELECT 1 FROM public.chat_notification_device_deliveries WHERE event_id = n.id AND status = 'accepted')
    AND NOT EXISTS (SELECT 1 FROM public.chat_notification_device_deliveries WHERE event_id = n.id AND status IN ('pending','failed')) THEN outcome := 'accepted';
  ELSE outcome := 'failed'; failure := 'Provider acceptance incomplete or no eligible device'; END IF;
  UPDATE public.chat_notification_outbox SET status = outcome, lease_token = NULL,
    accepted_at = CASE WHEN outcome = 'accepted' THEN now() ELSE NULL END, last_error = failure,
    available_at = now() + make_interval(secs => (30 * power(2,least(attempts,5)))::integer)
    WHERE id = n.id;
  RETURN outcome;
END
$$;

-- Narrow worker APIs require service_role, never a user JWT or an admin role.
CREATE FUNCTION public.pc_chat_claim_notifications(p_limit integer DEFAULT 10) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.pc_chat_claim_notifications(p_limit) $$;
CREATE FUNCTION public.pc_chat_prepare_notification(p_id uuid,p_lease_token uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.pc_chat_prepare_notification(p_id,p_lease_token) $$;
CREATE FUNCTION public.pc_chat_authorize_notification_device(p_id uuid,p_lease_token uuid,p_device_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.pc_chat_authorize_notification_device(p_id,p_lease_token,p_device_id) $$;
CREATE FUNCTION public.pc_chat_record_notification_device(p_id uuid,p_lease_token uuid,p_device_id uuid,p_outcome text,p_provider_id text DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.pc_chat_record_notification_device(p_id,p_lease_token,p_device_id,p_outcome,p_provider_id) $$;
CREATE FUNCTION public.pc_chat_finish_notification(p_id uuid,p_lease_token uuid) RETURNS text
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.pc_chat_finish_notification(p_id,p_lease_token) $$;
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('private','public') AND p.proname IN (
      'pc_chat_notification_allowed','pc_chat_queue_notification','pc_chat_notification_lease',
      'pc_chat_claim_notifications','pc_chat_prepare_notification','pc_chat_authorize_notification_device',
      'pc_chat_record_notification_device','pc_chat_finish_notification')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated',f.nspname,f.proname,f.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',f.nspname,f.proname,f.args);
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA private TO service_role;

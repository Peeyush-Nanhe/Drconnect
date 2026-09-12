-- Synthetic-only post-consultation pilot. These are TEST FIXTURES, not approved
-- prices/allowances. No real-patient switch, purchase, call, upload or Rx issuance.
CREATE TABLE public.post_consultation_chat_policies (
  version text PRIMARY KEY,
  test_only boolean NOT NULL CHECK(test_only),
  duration_seconds integer NOT NULL CHECK(duration_seconds>0),
  patient_message_limit integer NOT NULL CHECK(patient_message_limit>0),
  starts_on text NOT NULL CHECK(starts_on='verified_home_visit_completion'),
  scope text NOT NULL CHECK(scope='episode'),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.post_consultation_chat_policies VALUES
 ('synthetic-home-followup-v1',true,86400,25,'verified_home_visit_completion','episode',now());
CREATE TABLE public.post_consultation_chat_pilot_participants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  provider_id uuid NOT NULL REFERENCES auth.users(id),
  scope_key text NOT NULL CHECK(scope_key='home_visit:direct'),
  revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(patient_id<>provider_id), UNIQUE(patient_id,provider_id,scope_key)
);
CREATE INDEX chat_conversations_provider_idx ON public.chat_conversations(provider_id);
CREATE TABLE public.chat_consultation_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id),
  source_kind text NOT NULL CHECK(source_kind='doctor_appointment'),
  source_id uuid NOT NULL REFERENCES public.doctor_appointments(id),
  consultation_label text NOT NULL,
  completed_at timestamptz NOT NULL,
  policy_version text NOT NULL REFERENCES public.post_consultation_chat_policies(version),
  policy_snapshot jsonb NOT NULL,
  patient_send_until timestamptz NOT NULL,
  patient_message_limit integer NOT NULL CHECK(patient_message_limit>0),
  patient_messages_used integer NOT NULL DEFAULT 0 CHECK(patient_messages_used>=0 AND patient_messages_used<=patient_message_limit),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_kind,source_id), UNIQUE(id,conversation_id)
);
CREATE INDEX chat_episodes_conversation_idx ON public.chat_consultation_episodes(conversation_id,completed_at DESC,id);
ALTER TABLE public.chat_messages
 ADD COLUMN conversation_id uuid REFERENCES public.chat_conversations(id),
 ADD COLUMN episode_id uuid,
 ADD COLUMN sender_role text CHECK(sender_role IN ('patient','doctor')),
 ADD COLUMN idempotency_key text,
 ADD COLUMN sequence_id bigint GENERATED ALWAYS AS IDENTITY,
 ADD CONSTRAINT chat_message_episode_fk FOREIGN KEY(episode_id,conversation_id) REFERENCES public.chat_consultation_episodes(id,conversation_id),
 ADD CONSTRAINT chat_message_canonical_shape CHECK(
  (conversation_id IS NULL AND episode_id IS NULL AND sender_role IS NULL AND idempotency_key IS NULL)
  OR (conversation_id IS NOT NULL AND episode_id IS NOT NULL AND sender_role IS NOT NULL AND idempotency_key IS NOT NULL AND recipient_id IS NOT NULL)),
 ADD CONSTRAINT chat_message_actor_idempotency UNIQUE(sender_id,idempotency_key);
CREATE UNIQUE INDEX chat_messages_sequence_idx ON public.chat_messages(sequence_id);
CREATE INDEX chat_messages_conversation_sequence_idx ON public.chat_messages(conversation_id,sequence_id DESC) WHERE conversation_id IS NOT NULL;
CREATE TABLE public.chat_member_receipts (
 conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id),
 member_id uuid NOT NULL REFERENCES auth.users(id),
 last_read_sequence bigint NOT NULL DEFAULT 0 CHECK(last_read_sequence>=0),
 acknowledged_at timestamptz, PRIMARY KEY(conversation_id,member_id)
);
CREATE TABLE public.chat_message_debits (
 message_id uuid PRIMARY KEY REFERENCES public.chat_messages(id),
 episode_id uuid NOT NULL REFERENCES public.chat_consultation_episodes(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 units integer NOT NULL CHECK(units=1),
 policy_version text NOT NULL REFERENCES public.post_consultation_chat_policies(version),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_debits_episode_idx ON public.chat_message_debits(episode_id);
CREATE TABLE public.chat_prescription_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id),
 episode_id uuid NOT NULL,
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 idempotency_key text NOT NULL,
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','reviewing','declined')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid REFERENCES auth.users(id), reviewed_at timestamptz, decline_reason text,
 FOREIGN KEY(episode_id,conversation_id) REFERENCES public.chat_consultation_episodes(id,conversation_id),
 UNIQUE(requested_by,idempotency_key)
);
CREATE INDEX chat_prescription_conversation_idx ON public.chat_prescription_requests(conversation_id,requested_at DESC);
CREATE UNIQUE INDEX chat_prescription_open_idx ON public.chat_prescription_requests(episode_id) WHERE status IN ('requested','reviewing');
CREATE TABLE public.chat_prescription_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES public.chat_prescription_requests(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 from_status text, to_status text NOT NULL CHECK(to_status IN ('requested','reviewing','declined')),
 reason text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(request_id,to_status)
);
CREATE TABLE public.chat_notification_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id),
 episode_id uuid NOT NULL REFERENCES public.chat_consultation_episodes(id),
 message_id uuid REFERENCES public.chat_messages(id),
 prescription_request_id uuid REFERENCES public.chat_prescription_requests(id),
 recipient_id uuid NOT NULL REFERENCES auth.users(id),
 event_kind text NOT NULL CHECK(event_kind IN ('message_saved','prescription_requested','prescription_reviewing','prescription_declined')),
 dedupe_key text NOT NULL UNIQUE,
 -- No clinical preview or external delivery claim: no approved channel exists.
 status text NOT NULL DEFAULT 'disabled' CHECK(status='disabled'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_outbox_conversation_idx ON public.chat_notification_outbox(conversation_id,created_at);
CREATE INDEX chat_messages_episode_idx ON public.chat_messages(episode_id) WHERE episode_id IS NOT NULL;
CREATE INDEX chat_receipts_member_idx ON public.chat_member_receipts(member_id);
CREATE INDEX chat_episodes_policy_idx ON public.chat_consultation_episodes(policy_version);
CREATE INDEX chat_debits_actor_idx ON public.chat_message_debits(actor_id);
CREATE INDEX chat_debits_policy_idx ON public.chat_message_debits(policy_version);
CREATE INDEX chat_prescription_reviewer_idx ON public.chat_prescription_requests(reviewed_by);
CREATE INDEX chat_prescription_events_actor_idx ON public.chat_prescription_events(actor_id);
CREATE INDEX chat_outbox_episode_idx ON public.chat_notification_outbox(episode_id);
CREATE INDEX chat_outbox_message_idx ON public.chat_notification_outbox(message_id);
CREATE INDEX chat_outbox_prescription_idx ON public.chat_notification_outbox(prescription_request_id);
CREATE INDEX chat_outbox_recipient_idx ON public.chat_notification_outbox(recipient_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['post_consultation_chat_policies','post_consultation_chat_pilot_participants','chat_conversations','chat_consultation_episodes','chat_member_receipts','chat_message_debits','chat_prescription_requests','chat_prescription_events','chat_notification_outbox'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;

CREATE FUNCTION private.pc_chat_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='post_consultation_chat_policies' THEN RAISE EXCEPTION 'Chat policy versions are immutable; add a new version'; END IF;
 IF TG_TABLE_NAME='chat_conversations' THEN
  IF (NEW.id,NEW.patient_id,NEW.provider_id,NEW.scope_key,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.patient_id,OLD.provider_id,OLD.scope_key,OLD.created_at) THEN RAISE EXCEPTION 'Conversation participants and scope are immutable'; END IF;
 END IF;
 IF TG_TABLE_NAME='chat_consultation_episodes' THEN
  IF (to_jsonb(NEW)-'patient_messages_used') IS DISTINCT FROM (to_jsonb(OLD)-'patient_messages_used') THEN RAISE EXCEPTION 'Consultation episode and policy snapshot are immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER chat_policy_immutable BEFORE UPDATE OR DELETE ON public.post_consultation_chat_policies FOR EACH ROW EXECUTE FUNCTION private.pc_chat_immutable();
CREATE TRIGGER chat_conversation_immutable BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION private.pc_chat_immutable();
CREATE TRIGGER chat_episode_immutable BEFORE UPDATE ON public.chat_consultation_episodes FOR EACH ROW EXECUTE FUNCTION private.pc_chat_immutable();
CREATE FUNCTION private.pc_chat_enabled(p_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_uid IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.post_consultation_chat_pilot_participants p JOIN auth.users u ON u.id=p.user_id
  WHERE p.user_id=p_uid AND p.revoked_at IS NULL AND (u.email LIKE '%@example.invalid' OR u.email LIKE '%@postchat-test.invalid'))
$$;
CREATE FUNCTION private.pc_chat_doctor(p_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_uid AND role='provider')
 AND EXISTS(SELECT 1 FROM public.account_role_requests WHERE user_id=p_uid AND status='approved' AND requested_role='provider' AND requested_view IN ('doctor','medico','care_physician'))
 AND EXISTS(SELECT 1 FROM public.care_physician_profiles WHERE user_id=p_uid AND registration_verified)
$$;
CREATE FUNCTION private.pc_chat_member(p_conversation uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.chat_conversations c
 WHERE c.id=p_conversation AND c.revoked_at IS NULL AND auth.uid() IN (c.patient_id,c.provider_id)
 AND private.pc_chat_enabled(c.patient_id) AND private.pc_chat_enabled(c.provider_id) AND private.pc_chat_doctor(c.provider_id))
$$;
CREATE FUNCTION private.pc_chat_require(p_conversation uuid) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to open follow-up chat' USING ERRCODE='42501'; END IF;
 IF NOT private.pc_chat_member(p_conversation) THEN RAISE EXCEPTION 'Chat access is unavailable or revoked' USING ERRCODE='42501'; END IF;
 RETURN auth.uid();
END $$;

-- Reuse the existing transport. Canonical writes go ONLY through atomic RPCs.
-- Preserve surgical-role communication using authoritative stored participants.
CREATE FUNCTION private.pc_surgery_member(p_thread text,p_sender uuid,p_recipient uuid,p_write boolean) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.surgery_booking_roles r JOIN public.surgery_bookings b ON b.id=r.booking_id
 WHERE p_thread='surgery:'||r.id::text AND r.assigned_to IS NOT NULL
 AND auth.uid() IN (b.facility_id,r.assigned_to)
 AND ((p_sender=b.facility_id AND p_recipient=r.assigned_to) OR (p_sender=r.assigned_to AND p_recipient=b.facility_id))
 AND (NOT p_write OR (r.status='accepted' AND b.status<>'cancelled' AND (r.chat_expires_at IS NULL OR r.chat_expires_at>now()))))
$$;
DROP POLICY "participants can read" ON public.chat_messages;
DROP POLICY "sender can insert" ON public.chat_messages;
CREATE POLICY "authorised canonical and historical messages" ON public.chat_messages FOR SELECT TO authenticated USING(
 (conversation_id IS NOT NULL AND private.pc_chat_member(conversation_id))
 OR (conversation_id IS NULL AND
  CASE WHEN thread_key LIKE 'surgery:%' THEN private.pc_surgery_member(thread_key,sender_id,recipient_id,false)
       ELSE (auth.uid()=sender_id OR auth.uid()=recipient_id) END));
CREATE POLICY "verified surgical role messages only" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK(
 conversation_id IS NULL AND episode_id IS NULL AND sender_role IS NULL AND idempotency_key IS NULL
 AND auth.uid()=sender_id AND length(trim(body)) BETWEEN 1 AND 4000
 AND private.pc_surgery_member(thread_key,sender_id,recipient_id,true));
REVOKE ALL ON public.chat_messages FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.chat_messages_sequence_id_seq TO authenticated,service_role;

CREATE FUNCTION private.pc_chat_summary(p_conversation uuid,p_episode uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=private.pc_chat_require(p_conversation); c public.chat_conversations; e public.chat_consultation_episodes; other_user uuid; member text; receipt bigint; can_send boolean; latest public.chat_messages;
BEGIN
 SELECT * INTO c FROM public.chat_conversations WHERE id=p_conversation;
 SELECT * INTO e FROM public.chat_consultation_episodes WHERE conversation_id=c.id AND (p_episode IS NULL OR id=p_episode) ORDER BY completed_at DESC,id DESC LIMIT 1;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Authorised consultation episode required'; END IF;
 member:=CASE WHEN u=c.provider_id THEN 'doctor' ELSE 'patient' END;
 other_user:=CASE WHEN member='doctor' THEN c.patient_id ELSE c.provider_id END;
 SELECT COALESCE(last_read_sequence,0) INTO receipt FROM public.chat_member_receipts WHERE conversation_id=c.id AND member_id=u;
 SELECT * INTO latest FROM public.chat_messages WHERE conversation_id=c.id ORDER BY sequence_id DESC LIMIT 1;
 can_send:=member='doctor' OR (now()<e.patient_send_until AND e.patient_messages_used<e.patient_message_limit);
 RETURN jsonb_build_object('conversation_id',c.id,'episode_id',e.id,'source_kind',e.source_kind,'source_id',e.source_id,
 'actor_id',u,'member_role',member,'other_id',other_user,'other_name',(SELECT COALESCE(NULLIF(full_name,''),CASE WHEN member='doctor' THEN 'Patient' ELSE 'Doctor' END) FROM public.profiles WHERE id=other_user),
 'other_role',CASE WHEN member='doctor' THEN 'patient' ELSE 'doctor' END,'consultation_label',e.consultation_label,'completed_at',e.completed_at,
 'patient_messages_remaining',e.patient_message_limit-e.patient_messages_used,'patient_messages_limit',e.patient_message_limit,'patient_send_until',e.patient_send_until,
 'can_send',can_send,'send_disabled_reason',CASE WHEN can_send THEN NULL WHEN now()>=e.patient_send_until THEN 'The synthetic test allowance has expired' ELSE 'The synthetic test patient message allowance is exhausted' END,
 'last_body',latest.body,'last_at',latest.created_at,'last_read_sequence',COALESCE(receipt,0),
 'unread_count',(SELECT count(*) FROM public.chat_messages WHERE conversation_id=c.id AND recipient_id=u AND sequence_id>COALESCE(receipt,0)),
 'policy_version',e.policy_version,'test_only',true,
 'episodes',(SELECT COALESCE(jsonb_agg(jsonb_build_object('episode_id',id,'source_kind',source_kind,'source_id',source_id,'consultation_label',consultation_label,'completed_at',completed_at) ORDER BY completed_at DESC,id DESC),'[]'::jsonb) FROM public.chat_consultation_episodes WHERE conversation_id=c.id),
 'prescription_requests',(SELECT COALESCE(jsonb_agg(to_jsonb(r)-'idempotency_key' ORDER BY requested_at DESC),'[]'::jsonb) FROM public.chat_prescription_requests r WHERE conversation_id=c.id));
END $$;
CREATE FUNCTION private.pc_chat_context() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('enabled',private.pc_chat_enabled(auth.uid()),'test_only',true,'policy_version','synthetic-home-followup-v1',
 'unavailable_reason',CASE WHEN private.pc_chat_enabled(auth.uid()) THEN NULL ELSE 'Follow-up chat is restricted to synthetic testing pending owner policy approval' END,
 'attachments_enabled',false,'calls_enabled',false,'payments_enabled',false,'prescription_issuance_enabled',false,'notifications_enabled',false)
$$;
CREATE FUNCTION private.pc_chat_open(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); cid uuid; eid uuid; sid uuid; a public.doctor_appointments; p public.post_consultation_chat_policies;
BEGIN
 IF u IS NULL OR NOT private.pc_chat_enabled(u) THEN RAISE EXCEPTION 'Follow-up chat is restricted to synthetic testing pending owner policy approval' USING ERRCODE='42501'; END IF;
 IF NULLIF(p_input->>'conversation_id','') IS NOT NULL THEN
  RETURN private.pc_chat_summary((p_input->>'conversation_id')::uuid,NULLIF(p_input->>'episode_id','')::uuid);
 END IF;
 IF COALESCE(p_input->>'source_kind','') NOT IN ('doctor_appointment','home_visit') THEN
  RAISE EXCEPTION 'Verified clinic/video consultation completion is not yet integrated; client completion and payment fields cannot establish chat access';
 END IF;
 sid:=(p_input->>'source_id')::uuid;
 SELECT * INTO a FROM public.doctor_appointments WHERE id=sid;
 IF NOT FOUND OR (u<>a.patient_id AND u IS DISTINCT FROM a.provider_id) THEN RAISE EXCEPTION 'Authorised completed consultation required' USING ERRCODE='42501'; END IF;
 IF a.dependent_id IS NOT NULL THEN RAISE EXCEPTION 'Verified guardian/dependent chat delegation is not implemented' USING ERRCODE='42501'; END IF;
 IF a.mode<>'home_visit' THEN RAISE EXCEPTION 'Verified clinic/video consultation completion is not yet integrated'; END IF;
 IF a.status<>'completed' OR a.home_visit_status<>'completed' OR a.completed_at IS NULL OR a.completed_at>now()
 OR NOT EXISTS(SELECT 1 FROM public.home_visit_details d WHERE d.booking_id=a.id AND d.actor_id=a.patient_id AND d.patient_id=a.patient_id)
 OR NOT EXISTS(SELECT 1 FROM public.home_visit_encounters e WHERE e.booking_id=a.id AND e.author_id=a.provider_id AND e.signed_at IS NOT NULL AND length(trim(e.summary))>0)
 OR NOT EXISTS(SELECT 1 FROM public.home_visit_arrival_secrets s WHERE s.booking_id=a.id AND s.consumed_at IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM public.home_visit_events v WHERE v.booking_id=a.id AND v.kind='complete' AND v.actor_id=a.provider_id)
 THEN RAISE EXCEPTION 'Genuine clinician completion, signed encounter and patient arrival acknowledgement required'; END IF;
 IF NOT private.pc_chat_enabled(a.patient_id) OR NOT private.pc_chat_enabled(a.provider_id) OR NOT private.pc_chat_doctor(a.provider_id) THEN RAISE EXCEPTION 'Both synthetic participants and a verified approved clinician are required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.chat_conversations(patient_id,provider_id,scope_key) VALUES(a.patient_id,a.provider_id,'home_visit:direct') ON CONFLICT(patient_id,provider_id,scope_key) DO NOTHING;
 SELECT id INTO cid FROM public.chat_conversations WHERE patient_id=a.patient_id AND provider_id=a.provider_id AND scope_key='home_visit:direct' FOR UPDATE;
 PERFORM private.pc_chat_require(cid);
 SELECT * INTO p FROM public.post_consultation_chat_policies WHERE version='synthetic-home-followup-v1';
 INSERT INTO public.chat_consultation_episodes(conversation_id,source_kind,source_id,consultation_label,completed_at,policy_version,policy_snapshot,patient_send_until,patient_message_limit)
 VALUES(cid,'doctor_appointment',a.id,a.service,a.completed_at,p.version,to_jsonb(p),a.completed_at+make_interval(secs=>p.duration_seconds),p.patient_message_limit)
 ON CONFLICT(source_kind,source_id) DO NOTHING;
 SELECT id INTO eid FROM public.chat_consultation_episodes WHERE source_kind='doctor_appointment' AND source_id=a.id AND conversation_id=cid;
 IF eid IS NULL THEN RAISE EXCEPTION 'Consultation identity changed; reviewed reconciliation required'; END IF;
 INSERT INTO public.chat_member_receipts(conversation_id,member_id) VALUES(cid,a.patient_id),(cid,a.provider_id) ON CONFLICT DO NOTHING;
 RETURN private.pc_chat_summary(cid,eid);
END $$;
CREATE FUNCTION private.pc_chat_inbox() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; result jsonb; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to read follow-up chats' USING ERRCODE='42501'; END IF;
 IF NOT private.pc_chat_enabled(auth.uid()) THEN RETURN '[]'::jsonb; END IF;
 -- Verified lazy creation makes either participant's inbox discover genuine
 -- completed visits even if the counterpart has never opened chat.
 FOR a IN SELECT b.id FROM public.doctor_appointments b
 JOIN public.home_visit_details d ON d.booking_id=b.id AND d.actor_id=b.patient_id AND d.patient_id=b.patient_id
 JOIN public.home_visit_encounters e ON e.booking_id=b.id AND e.author_id=b.provider_id AND e.signed_at IS NOT NULL AND length(trim(e.summary))>0
 JOIN public.home_visit_arrival_secrets s ON s.booking_id=b.id AND s.consumed_at IS NOT NULL
 WHERE auth.uid() IN (b.patient_id,b.provider_id) AND b.mode='home_visit' AND b.dependent_id IS NULL AND b.status='completed' AND b.home_visit_status='completed' AND b.completed_at<=now()
 AND private.pc_chat_enabled(b.patient_id) AND private.pc_chat_enabled(b.provider_id) AND private.pc_chat_doctor(b.provider_id)
 AND EXISTS(SELECT 1 FROM public.home_visit_events WHERE booking_id=b.id AND kind='complete' AND actor_id=b.provider_id)
 AND NOT EXISTS(SELECT 1 FROM public.chat_conversations c WHERE c.patient_id=b.patient_id AND c.provider_id=b.provider_id AND c.revoked_at IS NOT NULL)
 LOOP PERFORM private.pc_chat_open(jsonb_build_object('source_kind','doctor_appointment','source_id',a.id)); END LOOP;
 SELECT COALESCE(jsonb_agg(row_data ORDER BY COALESCE(row_data->>'last_at',row_data->>'completed_at') DESC,row_data->>'conversation_id'),'[]'::jsonb) INTO result
 FROM (SELECT private.pc_chat_summary(id) row_data FROM public.chat_conversations WHERE private.pc_chat_member(id)) q;
 RETURN result;
END $$;
CREATE FUNCTION private.pc_chat_history(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid:=(p_input->>'conversation_id')::uuid; n integer:=LEAST(100,GREATEST(1,COALESCE((p_input->>'limit')::integer,50))); before_id bigint:=NULLIF(p_input->>'before_sequence','')::bigint; after_id bigint:=NULLIF(p_input->>'after_sequence','')::bigint; rows jsonb; next_id bigint;
BEGIN
 PERFORM private.pc_chat_require(cid);
 SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY sequence_id),'[]'::jsonb),min(sequence_id) INTO rows,next_id FROM (
 SELECT id,conversation_id,episode_id,sender_id,sender_role,body,created_at,sequence_id,idempotency_key
 FROM public.chat_messages WHERE conversation_id=cid AND (before_id IS NULL OR sequence_id<before_id) AND (after_id IS NULL OR sequence_id>after_id)
 ORDER BY CASE WHEN after_id IS NOT NULL THEN sequence_id END ASC,sequence_id DESC LIMIT n) q;
 RETURN jsonb_build_object('messages',rows,'next_before_sequence',CASE WHEN EXISTS(SELECT 1 FROM public.chat_messages WHERE conversation_id=cid AND sequence_id<next_id) THEN next_id ELSE NULL END);
END $$;
CREATE FUNCTION private.pc_chat_send(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid:=(p_input->>'conversation_id')::uuid; eid uuid:=(p_input->>'episode_id')::uuid; u uuid:=private.pc_chat_require(cid); c public.chat_conversations; e public.chat_consultation_episodes; m public.chat_messages; message_body text:=trim(COALESCE(p_input->>'body','')); key text:=p_input->>'idempotency_key'; member text; recipient uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN ('conversation_id','episode_id','body','idempotency_key')) THEN RAISE EXCEPTION 'Unsupported message fields; only text messages are enabled'; END IF;
 IF length(message_body) NOT BETWEEN 1 AND 4000 OR octet_length(message_body)>16000 THEN RAISE EXCEPTION 'Message must contain 1 to 4000 characters'; END IF;
 IF key IS NULL OR length(key) NOT BETWEEN 8 AND 128 THEN RAISE EXCEPTION 'A stable idempotency key is required'; END IF;
 -- Actor/key lock handles retried requests across devices and conversations.
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':'||key,17));
 SELECT * INTO c FROM public.chat_conversations WHERE id=cid FOR UPDATE;
 PERFORM private.pc_chat_require(cid);
 SELECT * INTO m FROM public.chat_messages WHERE sender_id=u AND idempotency_key=key;
 IF FOUND THEN
  IF m.conversation_id IS DISTINCT FROM cid OR m.episode_id IS DISTINCT FROM eid OR m.body IS DISTINCT FROM message_body THEN RAISE EXCEPTION 'Idempotency key was already used for a different message'; END IF;
  RETURN to_jsonb(m)-'thread_key'-'recipient_id';
 END IF;
 SELECT * INTO e FROM public.chat_consultation_episodes WHERE id=eid AND conversation_id=cid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Authorised consultation episode required'; END IF;
 member:=CASE WHEN u=c.provider_id THEN 'doctor' ELSE 'patient' END;
 recipient:=CASE WHEN member='doctor' THEN c.patient_id ELSE c.provider_id END;
 IF member='patient' THEN
  IF now()>=e.patient_send_until THEN RAISE EXCEPTION 'The synthetic test allowance has expired'; END IF;
  IF e.patient_messages_used>=e.patient_message_limit THEN RAISE EXCEPTION 'The synthetic test patient message allowance is exhausted'; END IF;
 END IF;
 INSERT INTO public.chat_messages(thread_key,sender_id,recipient_id,body,conversation_id,episode_id,sender_role,idempotency_key)
 VALUES('consultation:'||cid::text,u,recipient,message_body,cid,eid,member,key) RETURNING * INTO m;
 IF member='patient' THEN
  UPDATE public.chat_consultation_episodes SET patient_messages_used=patient_messages_used+1 WHERE id=eid;
  INSERT INTO public.chat_message_debits(message_id,episode_id,actor_id,units,policy_version) VALUES(m.id,eid,u,1,e.policy_version);
 END IF;
 INSERT INTO public.chat_notification_outbox(conversation_id,episode_id,message_id,recipient_id,event_kind,dedupe_key)
 VALUES(cid,eid,m.id,recipient,'message_saved','message:'||m.id::text);
 RETURN to_jsonb(m)-'thread_key'-'recipient_id';
END $$;
CREATE FUNCTION private.pc_chat_ack_read(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid:=(p_input->>'conversation_id')::uuid; u uuid:=private.pc_chat_require(cid); seq bigint:=(p_input->>'through_sequence')::bigint; saved bigint;
BEGIN
 IF seq IS NULL OR seq<0 OR (seq<>0 AND NOT EXISTS(SELECT 1 FROM public.chat_messages WHERE conversation_id=cid AND sequence_id=seq)) THEN RAISE EXCEPTION 'A displayed message from this conversation is required'; END IF;
 INSERT INTO public.chat_member_receipts(conversation_id,member_id,last_read_sequence,acknowledged_at) VALUES(cid,u,seq,now())
 ON CONFLICT(conversation_id,member_id) DO UPDATE SET last_read_sequence=GREATEST(public.chat_member_receipts.last_read_sequence,excluded.last_read_sequence),acknowledged_at=now()
 RETURNING last_read_sequence INTO saved;
 RETURN jsonb_build_object('last_read_sequence',saved);
END $$;
CREATE FUNCTION private.pc_chat_prescription(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid:=(p_input->>'conversation_id')::uuid; eid uuid:=(p_input->>'episode_id')::uuid; u uuid:=private.pc_chat_require(cid); action text:=p_input->>'action'; c public.chat_conversations; r public.chat_prescription_requests; key text:=p_input->>'idempotency_key'; recipient uuid; event text; previous_status text;
BEGIN
 IF action NOT IN ('request','review','decline') OR action IS NULL THEN RAISE EXCEPTION 'Signed prescription issuance is not integrated; supported actions are request, review and decline'; END IF;
 IF action='request' THEN PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':prescription:'||COALESCE(key,''),17)); END IF;
 SELECT * INTO c FROM public.chat_conversations WHERE id=cid FOR UPDATE;
 PERFORM private.pc_chat_require(cid);
 IF NOT EXISTS(SELECT 1 FROM public.chat_consultation_episodes WHERE id=eid AND conversation_id=cid) THEN RAISE EXCEPTION 'Authorised consultation episode required'; END IF;
 IF action='request' THEN
  IF u<>c.patient_id THEN RAISE EXCEPTION 'Only the patient can request a prescription'; END IF;
  IF key IS NULL OR length(key) NOT BETWEEN 8 AND 128 THEN RAISE EXCEPTION 'A stable idempotency key is required'; END IF;
  SELECT * INTO r FROM public.chat_prescription_requests WHERE requested_by=u AND idempotency_key=key;
  IF FOUND THEN
   IF r.conversation_id<>cid OR r.episode_id<>eid THEN RAISE EXCEPTION 'Idempotency key was already used for a different request'; END IF;
   RETURN to_jsonb(r)-'idempotency_key';
  END IF;
  IF EXISTS(SELECT 1 FROM public.chat_prescription_requests WHERE episode_id=eid AND status IN ('requested','reviewing')) THEN RAISE EXCEPTION 'A prescription request is already awaiting the clinician'; END IF;
  INSERT INTO public.chat_prescription_requests(conversation_id,episode_id,requested_by,idempotency_key) VALUES(cid,eid,u,key) RETURNING * INTO r;
  recipient:=c.provider_id; event:='prescription_requested';
 ELSE
  IF u<>c.provider_id THEN RAISE EXCEPTION 'Only the treating clinician can review or decline'; END IF;
  SELECT * INTO r FROM public.chat_prescription_requests WHERE id=(p_input->>'request_id')::uuid AND conversation_id=cid AND episode_id=eid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Authorised prescription request required'; END IF;
  IF r.status='declined' THEN
   IF action<>'decline' OR r.decline_reason IS DISTINCT FROM left(NULLIF(trim(p_input->>'reason'),''),500) THEN RAISE EXCEPTION 'The clinician decision is final; a new request is required'; END IF;
   RETURN to_jsonb(r)-'idempotency_key';
  END IF;
  IF action='review' AND r.status='reviewing' THEN RETURN to_jsonb(r)-'idempotency_key'; END IF;
  previous_status:=r.status;
  UPDATE public.chat_prescription_requests SET status=CASE WHEN action='review' THEN 'reviewing' ELSE 'declined' END,reviewed_by=u,reviewed_at=now(),decline_reason=CASE WHEN action='decline' THEN left(NULLIF(trim(p_input->>'reason'),''),500) ELSE NULL END WHERE id=r.id RETURNING * INTO r;
  recipient:=c.patient_id; event:='prescription_'||r.status;
 END IF;
 INSERT INTO public.chat_prescription_events(request_id,actor_id,from_status,to_status,reason)
 VALUES(r.id,u,previous_status,r.status,r.decline_reason);
 INSERT INTO public.chat_notification_outbox(conversation_id,episode_id,prescription_request_id,recipient_id,event_kind,dedupe_key)
 VALUES(cid,eid,r.id,recipient,event,event||':'||r.id::text) ON CONFLICT(dedupe_key) DO NOTHING;
 RETURN to_jsonb(r)-'idempotency_key';
END $$;

-- Public invoker wrappers are the narrow PostgREST API; elevated bodies live in
-- a non-exposed schema, check auth identity/membership, and fix search_path.
CREATE FUNCTION public.pc_chat_context() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.pc_chat_context() $$;
CREATE FUNCTION public.pc_chat_inbox() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.pc_chat_inbox() $$;
CREATE FUNCTION public.pc_chat_open(p_input jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.pc_chat_open(p_input) $$;
CREATE FUNCTION public.pc_chat_history(p_input jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.pc_chat_history(p_input) $$;
CREATE FUNCTION public.pc_chat_send(p_input jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.pc_chat_send(p_input) $$;
CREATE FUNCTION public.pc_chat_ack_read(p_input jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.pc_chat_ack_read(p_input) $$;
CREATE FUNCTION public.pc_chat_prescription(p_input jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.pc_chat_prescription(p_input) $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('private','public') AND (p.proname LIKE 'pc_chat_%' OR p.proname='pc_surgery_member') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated',f.nspname,f.proname,f.args);
  IF f.proname<>'pc_chat_immutable' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated,service_role',f.nspname,f.proname,f.args); END IF;
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA private TO authenticated;

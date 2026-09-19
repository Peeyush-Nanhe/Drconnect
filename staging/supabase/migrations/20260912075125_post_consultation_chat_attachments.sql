-- Synthetic fixture only. No production attachment policy is approved.
-- JPEG/PNG/PDF, 8 MiB, one patient message unit, 15-minute upload intent.
ALTER TABLE public.post_consultation_chat_pilot_participants ADD COLUMN attachments_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE public.chat_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id),
 episode_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 idempotency_key text NOT NULL,
 policy_version text NOT NULL DEFAULT 'synthetic-attachment-v1' CHECK(policy_version='synthetic-attachment-v1'),
 filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 120),
 mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','application/pdf')),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 8388608),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 object_key text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','uploading','finalized','rejected','deleting','cleaned')),
 lease_token uuid,
 scan_engine text,
 scanned_at timestamptz,
 message_id uuid UNIQUE REFERENCES public.chat_messages(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 FOREIGN KEY(episode_id,conversation_id) REFERENCES public.chat_consultation_episodes(id,conversation_id),
 UNIQUE(actor_id,idempotency_key),
 CHECK((status='finalized')=(message_id IS NOT NULL)),
 CHECK(status<>'finalized' OR (scanned_at IS NOT NULL AND scan_engine IS NOT NULL))
);
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_attachments FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.chat_attachments TO service_role;
CREATE INDEX chat_attachments_episode_idx ON public.chat_attachments(episode_id);
CREATE INDEX chat_attachments_conversation_idx ON public.chat_attachments(conversation_id);
CREATE INDEX chat_attachments_cleanup_idx ON public.chat_attachments(expires_at,id) WHERE status<>'finalized';
ALTER TABLE public.chat_messages
 ADD COLUMN attachment_id uuid UNIQUE REFERENCES public.chat_attachments(id),
 ADD COLUMN message_kind text NOT NULL DEFAULT 'text' CHECK(message_kind IN ('text','attachment')),
 ADD CONSTRAINT chat_message_attachment_shape CHECK((message_kind='attachment')=(attachment_id IS NOT NULL));

-- The hosted platform owns Storage. Local PostgreSQL fixtures do not emulate it.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  VALUES('mydox-chat-quarantine','mydox-chat-quarantine',false,8388608,ARRAY['application/octet-stream'])
  ON CONFLICT(id) DO NOTHING;
  IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='mydox-chat-quarantine' AND public) THEN
   RAISE EXCEPTION 'Attachment quarantine must be private';
  END IF;
  EXECUTE 'CREATE POLICY "chat quarantine server access only" ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING(bucket_id<>''mydox-chat-quarantine'') WITH CHECK(bucket_id<>''mydox-chat-quarantine'')';
 END IF;
END $$;

CREATE FUNCTION private.pc_chat_attachment_member(p_actor uuid,p_conversation uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_actor IS NOT NULL AND EXISTS(SELECT 1 FROM public.chat_conversations c WHERE c.id=p_conversation
 AND c.revoked_at IS NULL AND p_actor IN (c.patient_id,c.provider_id)
 AND private.pc_chat_enabled(c.patient_id) AND private.pc_chat_enabled(c.provider_id) AND private.pc_chat_doctor(c.provider_id))
$$;
CREATE FUNCTION private.pc_chat_attachment_enabled(p_actor uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.pc_chat_enabled(p_actor) AND EXISTS(SELECT 1 FROM public.post_consultation_chat_pilot_participants WHERE user_id=p_actor AND attachments_enabled AND revoked_at IS NULL)
$$;
CREATE OR REPLACE FUNCTION private.pc_chat_context() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('enabled',private.pc_chat_enabled(auth.uid()),'test_only',true,'policy_version','synthetic-home-followup-v1',
 'unavailable_reason',CASE WHEN private.pc_chat_enabled(auth.uid()) THEN NULL ELSE 'Follow-up chat is restricted to synthetic testing pending owner policy approval' END,
 'attachments_enabled',private.pc_chat_attachment_enabled(auth.uid()),'calls_enabled',false,'payments_enabled',false,'prescription_issuance_enabled',false,'notifications_enabled',false)
$$;
CREATE FUNCTION private.pc_chat_attachment_message(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT to_jsonb(m)-'thread_key'-'recipient_id'||jsonb_build_object('attachment',jsonb_build_object(
 'id',a.id,'filename',a.filename,'mime_type',a.mime_type,'byte_size',a.byte_size,'sha256',a.sha256,'policy_version',a.policy_version))
 FROM public.chat_attachments a JOIN public.chat_messages m ON m.id=a.message_id
 WHERE a.id=p_id AND a.status='finalized'
$$;
CREATE FUNCTION private.pc_chat_attachment_intent(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid:=(p_input->>'conversation_id')::uuid; eid uuid:=(p_input->>'episode_id')::uuid;
 u uuid:=private.pc_chat_require(cid); a public.chat_attachments; key text:=p_input->>'idempotency_key';
 name text:=p_input->>'filename'; mime text:=p_input->>'mime_type'; size integer:=(p_input->>'byte_size')::integer; hash text:=p_input->>'sha256';
BEGIN
 IF key IS NULL OR length(key) NOT BETWEEN 8 AND 128 OR name IS NULL OR length(name) NOT BETWEEN 1 AND 120
 OR name ~ '[[:cntrl:]/\\]' OR hash IS NULL OR hash !~ '^[a-f0-9]{64}$'
 OR size IS NULL OR size NOT BETWEEN 1 AND 8388608 OR mime IS NULL OR mime NOT IN ('image/jpeg','image/png','application/pdf')
 OR NOT ((mime='image/jpeg' AND lower(name) ~ '\.jpe?g$') OR (mime='image/png' AND lower(name) ~ '\.png$') OR (mime='application/pdf' AND lower(name) ~ '\.pdf$')) THEN
  RAISE EXCEPTION 'Valid synthetic attachment metadata required';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.chat_consultation_episodes WHERE id=eid AND conversation_id=cid) THEN RAISE EXCEPTION 'Authorised consultation episode required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':attachment-intents',17));
 PERFORM private.pc_chat_require(cid);
 SELECT * INTO a FROM public.chat_attachments WHERE actor_id=u AND idempotency_key=key;
 IF a.status IS DISTINCT FROM 'finalized' AND NOT private.pc_chat_attachment_enabled(u) THEN RAISE EXCEPTION 'Attachments are not enabled for this synthetic participant' USING ERRCODE='55000'; END IF;
 IF FOUND THEN
  IF (a.conversation_id,a.episode_id,a.filename,a.mime_type,a.byte_size,a.sha256) IS DISTINCT FROM (cid,eid,name,mime,size,hash) THEN RAISE EXCEPTION 'Idempotency key belongs to a different attachment'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.chat_messages WHERE sender_id=u AND idempotency_key=key) THEN RAISE EXCEPTION 'Idempotency key belongs to another message'; END IF;
  IF (SELECT count(*) FROM public.chat_attachments WHERE actor_id=u AND status IN ('pending','uploading') AND expires_at>now())>=3
   OR (SELECT count(*) FROM public.chat_attachments WHERE actor_id=u AND created_at>now()-interval '1 day')>=40 THEN RAISE EXCEPTION 'Synthetic attachment upload limit reached'; END IF;
  INSERT INTO public.chat_attachments(conversation_id,episode_id,actor_id,idempotency_key,filename,mime_type,byte_size,sha256,object_key)
  VALUES(cid,eid,u,key,name,mime,size,hash,'intents/'||gen_random_uuid()::text) RETURNING * INTO a;
 END IF;
 RETURN jsonb_build_object('id',a.id,'status',a.status,'expires_at',a.expires_at,'message',private.pc_chat_attachment_message(a.id),'test_only',true);
END $$;
CREATE FUNCTION public.pc_chat_attachment_intent(p_input jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.pc_chat_attachment_intent(p_input) $$;

-- Service RPC actor IDs come only from server Auth verification, never client JSON.
CREATE FUNCTION public.pc_chat_attachment_claim(p_actor uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.chat_attachments;
BEGIN
 SELECT * INTO a FROM public.chat_attachments WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR a.actor_id<>p_actor OR NOT private.pc_chat_attachment_member(p_actor,a.conversation_id) THEN RAISE EXCEPTION 'Attachment access unavailable' USING ERRCODE='42501'; END IF;
 IF a.status='finalized' THEN RETURN jsonb_build_object('status','finalized','message',private.pc_chat_attachment_message(a.id)); END IF;
 IF NOT private.pc_chat_attachment_enabled(p_actor) THEN RAISE EXCEPTION 'Attachments are not enabled for this synthetic participant' USING ERRCODE='55000'; END IF;
 IF a.status<>'pending' OR a.expires_at<=now() THEN RAISE EXCEPTION 'Upload intent is already used or expired'; END IF;
 UPDATE public.chat_attachments SET status='uploading',lease_token=gen_random_uuid(),expires_at=now()+interval '5 minutes' WHERE id=a.id RETURNING * INTO a;
 RETURN to_jsonb(a)-'message_id';
END $$;
CREATE FUNCTION public.pc_chat_attachment_finalize(p_actor uuid,p_id uuid,p_lease uuid,p_sha256 text,p_size integer,p_mime text,p_scan_engine text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.chat_attachments; c public.chat_conversations; e public.chat_consultation_episodes; m public.chat_messages; member text; recipient uuid;
BEGIN
 SELECT * INTO a FROM public.chat_attachments WHERE id=p_id;
 IF NOT FOUND OR a.actor_id<>p_actor THEN RAISE EXCEPTION 'Attachment access unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text||':'||a.idempotency_key,17));
 SELECT * INTO c FROM public.chat_conversations WHERE id=a.conversation_id FOR UPDATE;
 SELECT * INTO a FROM public.chat_attachments WHERE id=p_id FOR UPDATE;
 IF NOT private.pc_chat_attachment_member(p_actor,a.conversation_id) THEN RAISE EXCEPTION 'Attachment access unavailable or revoked' USING ERRCODE='42501'; END IF;
 IF a.status='finalized' THEN
  IF a.sha256 IS DISTINCT FROM p_sha256 OR a.byte_size IS DISTINCT FROM p_size OR a.mime_type IS DISTINCT FROM p_mime THEN RAISE EXCEPTION 'Attachment content differs from saved message'; END IF;
  RETURN private.pc_chat_attachment_message(a.id);
 END IF;
 IF NOT private.pc_chat_attachment_enabled(p_actor) THEN RAISE EXCEPTION 'Attachments are not enabled for this synthetic participant' USING ERRCODE='55000'; END IF;
 IF a.status<>'uploading' OR a.lease_token IS DISTINCT FROM p_lease OR p_lease IS NULL OR a.expires_at<=now()
 OR a.sha256 IS DISTINCT FROM p_sha256 OR a.byte_size IS DISTINCT FROM p_size OR a.mime_type IS DISTINCT FROM p_mime
 OR p_scan_engine IS NULL OR length(p_scan_engine) NOT BETWEEN 8 AND 200 OR p_scan_engine NOT LIKE 'ClamAV %' THEN RAISE EXCEPTION 'Current upload lease and verified clean content required'; END IF;
 IF EXISTS(SELECT 1 FROM public.chat_messages WHERE sender_id=p_actor AND idempotency_key=a.idempotency_key) THEN RAISE EXCEPTION 'Idempotency key belongs to another message'; END IF;
 SELECT * INTO e FROM public.chat_consultation_episodes WHERE id=a.episode_id AND conversation_id=c.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Authorised consultation episode required' USING ERRCODE='42501'; END IF;
 member:=CASE WHEN p_actor=c.provider_id THEN 'doctor' ELSE 'patient' END;
 recipient:=CASE WHEN member='doctor' THEN c.patient_id ELSE c.provider_id END;
 IF member='patient' AND (now()>=e.patient_send_until OR e.patient_messages_used>=e.patient_message_limit) THEN RAISE EXCEPTION 'Synthetic patient attachment allowance expired or exhausted'; END IF;
 INSERT INTO public.chat_messages(thread_key,sender_id,recipient_id,body,conversation_id,episode_id,sender_role,idempotency_key,message_kind,attachment_id)
 VALUES('consultation:'||c.id::text,p_actor,recipient,a.filename,c.id,e.id,member,a.idempotency_key,'attachment',a.id) RETURNING * INTO m;
 UPDATE public.chat_attachments SET status='finalized',message_id=m.id,scan_engine=p_scan_engine,scanned_at=now(),lease_token=NULL WHERE id=a.id;
 IF member='patient' THEN
  UPDATE public.chat_consultation_episodes SET patient_messages_used=patient_messages_used+1 WHERE id=e.id;
  INSERT INTO public.chat_message_debits(message_id,episode_id,actor_id,units,policy_version) VALUES(m.id,e.id,p_actor,1,e.policy_version);
 END IF;
 INSERT INTO public.chat_notification_outbox(conversation_id,episode_id,message_id,recipient_id,event_kind,dedupe_key)
 VALUES(c.id,e.id,m.id,recipient,'message_saved','message:'||m.id::text);
 RETURN private.pc_chat_attachment_message(a.id);
END $$;
CREATE FUNCTION public.pc_chat_attachment_reject(p_actor uuid,p_id uuid,p_lease uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.chat_attachments SET status='rejected',expires_at=now(),lease_token=NULL
 WHERE id=p_id AND actor_id=p_actor AND status='uploading' AND lease_token=p_lease
$$;
CREATE FUNCTION public.pc_chat_attachment_download(p_actor uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.chat_attachments;
BEGIN
 SELECT * INTO a FROM public.chat_attachments WHERE id=p_id AND status='finalized';
 IF NOT FOUND OR NOT private.pc_chat_attachment_member(p_actor,a.conversation_id) THEN RAISE EXCEPTION 'Attachment access unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('id',a.id,'object_key',a.object_key,'filename',a.filename,'mime_type',a.mime_type,'byte_size',a.byte_size,'sha256',a.sha256);
END $$;
CREATE FUNCTION public.pc_chat_attachment_cleanup_claim() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 -- Cleaned tombstones remain retryable: a storage request whose response was
 -- lost may finish after an earlier deletion. Repeated removal converges safely.
 WITH picked AS (SELECT id FROM public.chat_attachments WHERE status<>'finalized' AND expires_at<=now() ORDER BY expires_at,id FOR UPDATE SKIP LOCKED LIMIT 20),
 changed AS (UPDATE public.chat_attachments a SET status='deleting',lease_token=gen_random_uuid(),expires_at=now()+interval '5 minutes' FROM picked WHERE a.id=picked.id RETURNING a.id,a.object_key,a.lease_token)
 SELECT COALESCE(jsonb_agg(to_jsonb(changed)),'[]'::jsonb) INTO result FROM changed;
 RETURN result;
END $$;
CREATE FUNCTION public.pc_chat_attachment_cleanup_finish(p_id uuid,p_lease uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.chat_attachments SET status='cleaned',lease_token=NULL,expires_at=now()+interval '1 hour' WHERE id=p_id AND status='deleting' AND lease_token=p_lease
$$;

CREATE OR REPLACE FUNCTION private.pc_chat_history(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid:=(p_input->>'conversation_id')::uuid; n integer:=LEAST(100,GREATEST(1,COALESCE((p_input->>'limit')::integer,50))); before_id bigint:=NULLIF(p_input->>'before_sequence','')::bigint; after_id bigint:=NULLIF(p_input->>'after_sequence','')::bigint; rows jsonb; next_id bigint;
BEGIN
 PERFORM private.pc_chat_require(cid);
 SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY sequence_id),'[]'::jsonb),min(sequence_id) INTO rows,next_id FROM (
 SELECT m.id,m.conversation_id,m.episode_id,m.sender_id,m.sender_role,m.body,m.created_at,m.sequence_id,m.idempotency_key,m.message_kind,
 CASE WHEN a.id IS NOT NULL THEN jsonb_build_object('id',a.id,'filename',a.filename,'mime_type',a.mime_type,'byte_size',a.byte_size,'sha256',a.sha256,'policy_version',a.policy_version) ELSE NULL END attachment
 FROM public.chat_messages m LEFT JOIN public.chat_attachments a ON a.id=m.attachment_id AND a.status='finalized'
 WHERE m.conversation_id=cid AND (before_id IS NULL OR sequence_id<before_id) AND (after_id IS NULL OR sequence_id>after_id)
 ORDER BY CASE WHEN after_id IS NOT NULL THEN sequence_id END ASC,sequence_id DESC LIMIT n) q;
 RETURN jsonb_build_object('messages',rows,'next_before_sequence',CASE WHEN EXISTS(SELECT 1 FROM public.chat_messages WHERE conversation_id=cid AND sequence_id<next_id) THEN next_id ELSE NULL END);
END $$;

REVOKE ALL ON FUNCTION private.pc_chat_attachment_member(uuid,uuid),private.pc_chat_attachment_message(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.pc_chat_attachment_enabled(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.pc_chat_attachment_intent(jsonb),public.pc_chat_attachment_intent(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.pc_chat_attachment_intent(jsonb),public.pc_chat_attachment_intent(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.pc_chat_attachment_claim(uuid,uuid),public.pc_chat_attachment_finalize(uuid,uuid,uuid,text,integer,text,text),public.pc_chat_attachment_reject(uuid,uuid,uuid),public.pc_chat_attachment_download(uuid,uuid),public.pc_chat_attachment_cleanup_claim(),public.pc_chat_attachment_cleanup_finish(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pc_chat_attachment_claim(uuid,uuid),public.pc_chat_attachment_finalize(uuid,uuid,uuid,text,integer,text,text),public.pc_chat_attachment_reject(uuid,uuid,uuid),public.pc_chat_attachment_download(uuid,uuid),public.pc_chat_attachment_cleanup_claim(),public.pc_chat_attachment_cleanup_finish(uuid,uuid) TO service_role;

-- Cross-kind idempotency must not turn an attachment into a text retry.
CREATE OR REPLACE FUNCTION private.pc_chat_send(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  IF m.message_kind<>'text' OR m.conversation_id IS DISTINCT FROM cid OR m.episode_id IS DISTINCT FROM eid OR m.body IS DISTINCT FROM message_body THEN RAISE EXCEPTION 'Idempotency key was already used for a different message'; END IF;
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

-- Receipts acknowledge consumption by an authenticated recipient session.
-- A database insert, notification-provider acceptance or sender-side event is
-- never a receipt. The watermark means at least one recipient session, not all
-- registered devices, and remains scoped to the existing synthetic membership.
ALTER TABLE public.chat_member_receipts
  ADD COLUMN last_received_sequence bigint NOT NULL DEFAULT 0 CHECK (last_received_sequence >= 0),
  ADD COLUMN received_at timestamptz;

-- Existing explicit read acknowledgements already imply receipt of incoming
-- messages through that boundary. Do not infer receipt from an outgoing message
-- or set a received timestamp for members who have not acknowledged anything.
UPDATE public.chat_member_receipts r SET
  last_received_sequence = COALESCE((SELECT max(m.sequence_id) FROM public.chat_messages m
    WHERE m.conversation_id = r.conversation_id AND m.recipient_id = r.member_id
      AND m.sender_id <> r.member_id AND m.sequence_id <= r.last_read_sequence),0),
  received_at = r.acknowledged_at
WHERE r.acknowledged_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.chat_messages m
  WHERE m.conversation_id = r.conversation_id AND m.recipient_id = r.member_id
    AND m.sender_id <> r.member_id AND m.sequence_id <= r.last_read_sequence);

CREATE FUNCTION private.pc_chat_received_from_read() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE incoming bigint;
BEGIN
  IF NEW.acknowledged_at IS NOT NULL THEN
    SELECT max(sequence_id) INTO incoming FROM public.chat_messages
      WHERE conversation_id = NEW.conversation_id AND recipient_id = NEW.member_id
        AND sender_id <> NEW.member_id AND sequence_id <= NEW.last_read_sequence;
    IF incoming > NEW.last_received_sequence THEN
      NEW.last_received_sequence := incoming;
      NEW.received_at := NEW.acknowledged_at;
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER pc_chat_received_from_read
BEFORE INSERT OR UPDATE OF last_read_sequence ON public.chat_member_receipts
FOR EACH ROW EXECUTE FUNCTION private.pc_chat_received_from_read();
REVOKE ALL ON FUNCTION private.pc_chat_received_from_read() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.pc_chat_ack_received(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cid uuid := (p_input->>'conversation_id')::uuid;
  u uuid := private.pc_chat_require(cid);
  seq bigint := (p_input->>'through_sequence')::bigint;
  saved bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN ('conversation_id','through_sequence')) THEN
    RAISE EXCEPTION 'Only conversation and received sequence are accepted';
  END IF;
  IF seq IS NULL OR seq <= 0 OR NOT EXISTS (SELECT 1 FROM public.chat_messages
    WHERE conversation_id = cid AND sequence_id = seq AND recipient_id = u AND sender_id <> u) THEN
    RAISE EXCEPTION 'A received message addressed to this conversation member is required';
  END IF;
  INSERT INTO public.chat_member_receipts(conversation_id,member_id,last_received_sequence,received_at)
    VALUES(cid,u,seq,now())
  ON CONFLICT(conversation_id,member_id) DO UPDATE SET
    last_received_sequence = GREATEST(public.chat_member_receipts.last_received_sequence,excluded.last_received_sequence),
    received_at = CASE WHEN excluded.last_received_sequence > public.chat_member_receipts.last_received_sequence
      THEN excluded.received_at ELSE public.chat_member_receipts.received_at END
  RETURNING last_received_sequence INTO saved;
  RETURN jsonb_build_object('last_received_sequence',saved);
END
$$;
CREATE FUNCTION public.pc_chat_ack_received(p_input jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.pc_chat_ack_received(p_input) $$;
REVOKE ALL ON FUNCTION private.pc_chat_ack_received(jsonb),public.pc_chat_ack_received(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.pc_chat_ack_received(jsonb),public.pc_chat_ack_received(jsonb) TO authenticated,service_role;

-- Preserve summary behaviour and expose only this conversation's other member.
-- Both values are server-acknowledged watermarks, never inferred from messages.
CREATE OR REPLACE FUNCTION private.pc_chat_summary(p_conversation uuid,p_episode uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=private.pc_chat_require(p_conversation); c public.chat_conversations; e public.chat_consultation_episodes; other_user uuid; member text; receipt bigint; can_send boolean; latest public.chat_messages; received bigint; counterpart_received bigint; counterpart_read bigint;
BEGIN
 SELECT * INTO c FROM public.chat_conversations WHERE id=p_conversation;
 SELECT * INTO e FROM public.chat_consultation_episodes WHERE conversation_id=c.id AND (p_episode IS NULL OR id=p_episode) ORDER BY completed_at DESC,id DESC LIMIT 1;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Authorised consultation episode required'; END IF;
 member:=CASE WHEN u=c.provider_id THEN 'doctor' ELSE 'patient' END;
 other_user:=CASE WHEN member='doctor' THEN c.patient_id ELSE c.provider_id END;
 SELECT COALESCE(last_read_sequence,0),COALESCE(last_received_sequence,0) INTO receipt,received FROM public.chat_member_receipts WHERE conversation_id=c.id AND member_id=u;
 SELECT last_received_sequence,last_read_sequence INTO counterpart_received,counterpart_read FROM public.chat_member_receipts WHERE conversation_id=c.id AND member_id=other_user;
 SELECT * INTO latest FROM public.chat_messages WHERE conversation_id=c.id ORDER BY sequence_id DESC LIMIT 1;
 can_send:=member='doctor' OR (now()<e.patient_send_until AND e.patient_messages_used<e.patient_message_limit);
 RETURN jsonb_build_object('conversation_id',c.id,'episode_id',e.id,'source_kind',e.source_kind,'source_id',e.source_id,
 'actor_id',u,'member_role',member,'other_id',other_user,'other_name',(SELECT COALESCE(NULLIF(full_name,''),CASE WHEN member='doctor' THEN 'Patient' ELSE 'Doctor' END) FROM public.profiles WHERE id=other_user),
 'other_role',CASE WHEN member='doctor' THEN 'patient' ELSE 'doctor' END,'consultation_label',e.consultation_label,'completed_at',e.completed_at,
 'patient_messages_remaining',e.patient_message_limit-e.patient_messages_used,'patient_messages_limit',e.patient_message_limit,'patient_send_until',e.patient_send_until,
 'can_send',can_send,'send_disabled_reason',CASE WHEN can_send THEN NULL WHEN now()>=e.patient_send_until THEN 'The synthetic test allowance has expired' ELSE 'The synthetic test patient message allowance is exhausted' END,
 'last_body',latest.body,'last_at',latest.created_at,'last_read_sequence',COALESCE(receipt,0),
 'last_received_sequence',COALESCE(received,0),'counterpart_last_received_sequence',COALESCE(counterpart_received,0),'counterpart_last_read_sequence',COALESCE(counterpart_read,0),
 'unread_count',(SELECT count(*) FROM public.chat_messages WHERE conversation_id=c.id AND recipient_id=u AND sequence_id>COALESCE(receipt,0)),
 'policy_version',e.policy_version,'test_only',true,
 'episodes',(SELECT COALESCE(jsonb_agg(jsonb_build_object('episode_id',id,'source_kind',source_kind,'source_id',source_id,'consultation_label',consultation_label,'completed_at',completed_at) ORDER BY completed_at DESC,id DESC),'[]'::jsonb) FROM public.chat_consultation_episodes WHERE conversation_id=c.id),
 'prescription_requests',(SELECT COALESCE(jsonb_agg(to_jsonb(r)-'idempotency_key' ORDER BY requested_at DESC),'[]'::jsonb) FROM public.chat_prescription_requests r WHERE conversation_id=c.id));
END $$;

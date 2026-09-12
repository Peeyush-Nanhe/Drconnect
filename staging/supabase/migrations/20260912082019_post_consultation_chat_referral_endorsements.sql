-- An existing referral is not proof of clinical authorship: legacy participants
-- can edit its identity/content. Only an explicit, current clinician endorsement
-- creates canonical provenance. This remains restricted to synthetic chat.
CREATE TABLE public.chat_service_referral_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id),
  episode_id uuid NOT NULL,
  referral_id uuid NOT NULL UNIQUE REFERENCES public.service_referrals(id),
  endorsed_by uuid NOT NULL REFERENCES auth.users(id),
  patient_id uuid NOT NULL REFERENCES auth.users(id),
  service_key text NOT NULL,
  service_label text NOT NULL,
  service_tab text,
  note text,
  preview_digest text NOT NULL CHECK (preview_digest ~ '^[0-9a-f]{64}$'),
  endorsed_at timestamptz NOT NULL DEFAULT now(),
  declined_at timestamptz,
  FOREIGN KEY(episode_id,conversation_id) REFERENCES public.chat_consultation_episodes(id,conversation_id),
  CHECK (endorsed_by <> patient_id),
  CHECK (length(service_label) BETWEEN 1 AND 300 AND length(service_key) BETWEEN 1 AND 100),
  CHECK (note IS NULL OR length(note) <= 2000)
);
CREATE INDEX chat_referral_episode_idx ON public.chat_service_referral_endorsements(episode_id,conversation_id,endorsed_at,id);
CREATE INDEX chat_referral_conversation_idx ON public.chat_service_referral_endorsements(conversation_id);
CREATE INDEX chat_referral_doctor_idx ON public.chat_service_referral_endorsements(endorsed_by);
CREATE INDEX chat_referral_patient_idx ON public.chat_service_referral_endorsements(patient_id);
ALTER TABLE public.chat_service_referral_endorsements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_service_referral_endorsements FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.chat_service_referral_endorsements TO service_role;

CREATE FUNCTION private.pc_chat_referral_digest(r public.service_referrals) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')
$$;

-- Exact stable keys used by the existing MyDoxFull referral review handler.
-- Category-only recommendations are accepted only with their exact existing
-- category label, which cannot match a specific item via the legacy fallback.
-- Provider names, availability and price are never inferred from display text.
CREATE FUNCTION private.pc_chat_referral_destination(p_tab text,p_key text,p_label text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE
 WHEN COALESCE((jsonb_build_object(
  'doctor',jsonb_build_array('gp','pedia','gyne','derm','ortho','obgyn','gastro','eye','ent','dental','cardio','psych','neuro','pulm','homeo','emerg','endo','urol','nephro','surgery','patho','radio','rheum','plastic','geriatric','anesth','onco','vasc'),
  'therapist',jsonb_build_array('physio','speech','psycho','occup','resp'),
  'technician',jsonb_build_array('lab','ecg','eeg','xray','ncs','audio','ot'),
  'test',jsonb_build_array('lab','ecg','eeg','xray','ncs','audio','ot'),
  'nurse',jsonb_build_array('n_gen','n_baby'),
  'care',jsonb_build_array('cp_cath','cp_wound','cp_stitch','cp_iv','cp_suct','cp_bed'),
  'scan',jsonb_build_array('sono','ct','mri','xray','dexa'),
  'diet',jsonb_build_array('diet1','diet2','diet3')) -> p_tab) ? p_key,false) THEN 'service'
 WHEN (p_tab,p_key,p_label) IN (
  ('doctor','doctor','Doctor Consultation'),('nurse','nurse','Nurse Visit'),
  ('therapist','therapist','Physiotherapy'),('diet','diet','Dietitian'),
  ('technician','technician','Technician (Home Test)'),('technician','test','Lab Test'),
  ('scan','scan','Scan (CT / MRI / X-ray)')) THEN 'category'
 ELSE NULL END
$$;

CREATE FUNCTION private.pc_chat_referral_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid;
BEGIN
 IF TG_TABLE_NAME='service_referrals' THEN
  SELECT conversation_id INTO cid FROM public.chat_service_referral_endorsements WHERE referral_id=OLD.id;
  IF FOUND THEN
   IF (to_jsonb(NEW)-'status'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'updated_at') THEN
    RAISE EXCEPTION 'Endorsed referral identity and clinical content are immutable' USING ERRCODE='42501';
   END IF;
   IF NEW.status IS DISTINCT FROM OLD.status AND NOT
    (OLD.status='pending' AND NEW.status='declined' AND auth.uid()=OLD.patient_id) THEN
    RAISE EXCEPTION 'Only the recipient may decline an endorsed recommendation; booking requires separate confirmation' USING ERRCODE='42501';
   END IF;
   IF NEW.status IS DISTINCT FROM OLD.status THEN PERFORM private.pc_chat_require(cid); END IF;
  END IF;
 ELSE
  IF (to_jsonb(NEW)-'declined_at') IS DISTINCT FROM (to_jsonb(OLD)-'declined_at')
   OR (OLD.declined_at IS NOT NULL AND NEW.declined_at IS DISTINCT FROM OLD.declined_at) THEN
   RAISE EXCEPTION 'Referral endorsement provenance is immutable' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END
$$;
CREATE TRIGGER pc_chat_endorsed_referral_immutable BEFORE UPDATE ON public.service_referrals
FOR EACH ROW EXECUTE FUNCTION private.pc_chat_referral_immutable();
CREATE TRIGGER pc_chat_referral_provenance_immutable BEFORE UPDATE ON public.chat_service_referral_endorsements
FOR EACH ROW EXECUTE FUNCTION private.pc_chat_referral_immutable();

-- The existing patient card also uses its ordinary declined status update.
-- Preserve that entry point while keeping the canonical audit and outbox atomic.
ALTER TABLE public.chat_notification_outbox
 ADD COLUMN referral_endorsement_id uuid REFERENCES public.chat_service_referral_endorsements(id),
 DROP CONSTRAINT chat_notification_outbox_event_kind_check,
 ADD CONSTRAINT chat_notification_outbox_event_kind_check CHECK(event_kind IN (
  'message_saved','prescription_requested','prescription_reviewing','prescription_declined','referral_endorsed','referral_declined'));
CREATE INDEX chat_outbox_referral_idx ON public.chat_notification_outbox(referral_endorsement_id);

CREATE OR REPLACE FUNCTION private.pc_chat_notification_allowed(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.chat_notification_outbox n
  JOIN public.chat_conversations c ON c.id=n.conversation_id
  JOIN public.chat_consultation_episodes e ON e.id=n.episode_id AND e.conversation_id=c.id
  WHERE n.id=p_id AND c.revoked_at IS NULL AND n.recipient_id IN(c.patient_id,c.provider_id)
   AND private.pc_chat_enabled(c.patient_id) AND private.pc_chat_enabled(c.provider_id)
   AND private.pc_chat_doctor(c.provider_id) AND (
    (n.event_kind='message_saved' AND n.prescription_request_id IS NULL AND n.referral_endorsement_id IS NULL AND EXISTS (
     SELECT 1 FROM public.chat_messages m WHERE m.id=n.message_id AND m.conversation_id=c.id AND m.episode_id=e.id
      AND m.recipient_id=n.recipient_id AND m.sender_id IN(c.patient_id,c.provider_id) AND m.sender_id<>n.recipient_id
    )) OR (n.message_id IS NULL AND n.referral_endorsement_id IS NULL AND EXISTS (
     SELECT 1 FROM public.chat_prescription_requests r JOIN public.chat_prescription_events v ON v.request_id=r.id
     WHERE r.id=n.prescription_request_id AND r.conversation_id=c.id AND r.episode_id=e.id AND r.requested_by=c.patient_id
      AND n.event_kind='prescription_'||v.to_status
      AND ((v.to_status='requested' AND v.actor_id=c.patient_id AND n.recipient_id=c.provider_id)
       OR(v.to_status IN('reviewing','declined') AND v.actor_id=c.provider_id AND n.recipient_id=c.patient_id))
    )) OR (n.message_id IS NULL AND n.prescription_request_id IS NULL AND EXISTS (
     SELECT 1 FROM public.chat_service_referral_endorsements r JOIN public.service_referrals s ON s.id=r.referral_id
     WHERE r.id=n.referral_endorsement_id AND r.conversation_id=c.id AND r.episode_id=e.id
      AND r.endorsed_by=c.provider_id AND r.patient_id=c.patient_id
      AND (s.doctor_id,s.patient_id,s.service_key,s.service_label,s.service_tab,s.note)
       IS NOT DISTINCT FROM (r.endorsed_by,r.patient_id,r.service_key,r.service_label,r.service_tab,r.note)
      AND ((n.event_kind='referral_endorsed' AND n.recipient_id=c.patient_id AND s.status='pending' AND r.declined_at IS NULL)
       OR(n.event_kind='referral_declined' AND n.recipient_id=c.provider_id AND s.status='declined' AND r.declined_at IS NOT NULL))
    ))
   )
 )
$$;

CREATE FUNCTION private.pc_chat_referral_declined() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.chat_service_referral_endorsements;
BEGIN
 IF NEW.status='declined' AND OLD.status IS DISTINCT FROM NEW.status THEN
  UPDATE public.chat_service_referral_endorsements SET declined_at=now()
   WHERE referral_id=NEW.id AND declined_at IS NULL RETURNING * INTO r;
  IF FOUND THEN
   INSERT INTO public.chat_notification_outbox(conversation_id,episode_id,referral_endorsement_id,recipient_id,event_kind,dedupe_key)
    VALUES(r.conversation_id,r.episode_id,r.id,r.endorsed_by,'referral_declined','referral:'||r.id||':declined');
  END IF;
 END IF;
 RETURN NEW;
END
$$;
CREATE TRIGGER pc_chat_referral_declined AFTER UPDATE ON public.service_referrals
FOR EACH ROW EXECUTE FUNCTION private.pc_chat_referral_declined();

CREATE FUNCTION private.pc_chat_referrals(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 u uuid; cid uuid; eid uuid; action text; c public.chat_conversations;
 s public.service_referrals; r public.chat_service_referral_endorsements;
 cards jsonb; candidates jsonb; destination text; allowed_keys text[];
BEGIN
 IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Referral action object required'; END IF;
 action:=COALESCE(p_input->>'action','list');
 allowed_keys:=CASE action
  WHEN 'list' THEN ARRAY['action','conversation_id','episode_id']
  WHEN 'endorse' THEN ARRAY['action','conversation_id','episode_id','referral_id','preview_digest']
  WHEN 'review' THEN ARRAY['action','conversation_id','episode_id','endorsement_id']
  WHEN 'decline' THEN ARRAY['action','conversation_id','episode_id','endorsement_id'] END;
 IF allowed_keys IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE NOT(k=ANY(allowed_keys))) THEN
  RAISE EXCEPTION 'Only the scoped referral action and references are accepted';
 END IF;
 cid:=(p_input->>'conversation_id')::uuid; eid:=(p_input->>'episode_id')::uuid;
 u:=private.pc_chat_require(cid);
 SELECT * INTO c FROM public.chat_conversations WHERE id=cid;
 IF NOT EXISTS(SELECT 1 FROM public.chat_consultation_episodes WHERE id=eid AND conversation_id=cid) THEN
  RAISE EXCEPTION 'Authorised consultation episode required' USING ERRCODE='42501';
 END IF;

 IF action='endorse' THEN
  IF u<>c.provider_id THEN RAISE EXCEPTION 'Only the consultation clinician may endorse a recommendation' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.service_referrals WHERE id=(p_input->>'referral_id')::uuid FOR UPDATE;
  IF s.id IS NULL OR s.doctor_id<>u OR s.patient_id<>c.patient_id THEN
   RAISE EXCEPTION 'Own referral for this consultation patient required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO r FROM public.chat_service_referral_endorsements WHERE referral_id=s.id;
  IF r.id IS NOT NULL THEN
   IF r.conversation_id IS DISTINCT FROM cid OR r.episode_id IS DISTINCT FROM eid OR r.preview_digest IS DISTINCT FROM p_input->>'preview_digest' THEN
    RAISE EXCEPTION 'Referral already endorsed with another consultation or preview' USING ERRCODE='23505';
   END IF;
   RETURN jsonb_build_object('id',r.id,'referral_id',r.referral_id,'booking_confirmed',false);
  END IF;
  IF s.status<>'pending' OR s.care_request_id IS NOT NULL
   OR length(trim(s.service_label)) NOT BETWEEN 1 AND 300 OR length(s.service_key) NOT BETWEEN 1 AND 100
   OR COALESCE(length(s.note),0)>2000 OR COALESCE(length(s.service_tab),0)>100 THEN
   RAISE EXCEPTION 'A pending bounded recommendation without a booking is required';
  END IF;
  IF (p_input->>'preview_digest') IS DISTINCT FROM private.pc_chat_referral_digest(s) THEN
   RAISE EXCEPTION 'Recommendation changed; refresh and review it before endorsing' USING ERRCODE='40001';
  END IF;
  INSERT INTO public.chat_service_referral_endorsements(conversation_id,episode_id,referral_id,endorsed_by,patient_id,
   service_key,service_label,service_tab,note,preview_digest)
   VALUES(cid,eid,s.id,u,c.patient_id,s.service_key,s.service_label,s.service_tab,s.note,private.pc_chat_referral_digest(s)) RETURNING * INTO r;
  INSERT INTO public.chat_notification_outbox(conversation_id,episode_id,referral_endorsement_id,recipient_id,event_kind,dedupe_key)
   VALUES(cid,eid,r.id,c.patient_id,'referral_endorsed','referral:'||r.id||':endorsed');
  RETURN jsonb_build_object('id',r.id,'referral_id',r.referral_id,'booking_confirmed',false);
 END IF;

 IF action IN('review','decline') THEN
  IF u<>c.patient_id THEN RAISE EXCEPTION 'Only the consultation patient may choose a recommendation' USING ERRCODE='42501'; END IF;
  -- Lock legacy first, matching endorsement and its legacy update triggers.
  SELECT s0.* INTO s FROM public.service_referrals s0 JOIN public.chat_service_referral_endorsements r0 ON r0.referral_id=s0.id
   WHERE r0.id=(p_input->>'endorsement_id')::uuid AND r0.conversation_id=cid AND r0.episode_id=eid FOR UPDATE OF s0;
  SELECT * INTO r FROM public.chat_service_referral_endorsements WHERE id=(p_input->>'endorsement_id')::uuid
   AND conversation_id=cid AND episode_id=eid;
  IF r.id IS NULL OR s.id IS NULL OR r.endorsed_by<>c.provider_id OR r.patient_id<>u OR s.care_request_id IS NOT NULL
   OR (s.doctor_id,s.patient_id,s.service_key,s.service_label,s.service_tab,s.note)
    IS DISTINCT FROM (r.endorsed_by,r.patient_id,r.service_key,r.service_label,r.service_tab,r.note) THEN
   RAISE EXCEPTION 'Endorsed recommendation is unavailable for this consultation' USING ERRCODE='42501';
  END IF;
  IF action='decline' AND s.status='declined' AND r.declined_at IS NOT NULL THEN
   RETURN jsonb_build_object('id',r.id,'status','declined','booking_confirmed',false);
  END IF;
  IF s.status<>'pending' OR r.declined_at IS NOT NULL THEN RAISE EXCEPTION 'Recommendation is no longer awaiting a choice'; END IF;
  IF action='decline' THEN
   UPDATE public.service_referrals SET status='declined' WHERE id=s.id;
   RETURN jsonb_build_object('id',r.id,'status','declined','booking_confirmed',false);
  END IF;
  destination:=private.pc_chat_referral_destination(r.service_tab,r.service_key,r.service_label);
  IF destination IS NULL THEN RAISE EXCEPTION 'This recommendation has no exact supported booking destination; choose services through the existing service screen'; END IF;
  RETURN jsonb_build_object('referral_id',r.referral_id,'service_key',r.service_key,'service_tab',r.service_tab,
   'service_label',r.service_label,'destination_kind',destination,'booking_confirmed',false);
 END IF;

 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r0.id,'referral_id',r0.referral_id,'episode_id',r0.episode_id,
  'endorsed_by',r0.endorsed_by,'service_key',r0.service_key,'service_label',r0.service_label,'service_tab',r0.service_tab,
  'note',r0.note,'endorsed_at',r0.endorsed_at,'status',CASE WHEN r0.declined_at IS NULL THEN 'pending' ELSE 'declined' END,
  'review_available',s0.status='pending' AND r0.declined_at IS NULL AND s0.care_request_id IS NULL
   AND private.pc_chat_referral_destination(r0.service_tab,r0.service_key,r0.service_label) IS NOT NULL)
  ORDER BY r0.endorsed_at,r0.id),'[]') INTO cards
 FROM public.chat_service_referral_endorsements r0 JOIN public.service_referrals s0 ON s0.id=r0.referral_id
 WHERE r0.conversation_id=cid AND r0.episode_id=eid AND r0.endorsed_by=c.provider_id AND r0.patient_id=c.patient_id
  AND (s0.doctor_id,s0.patient_id,s0.service_key,s0.service_label,s0.service_tab,s0.note)
   IS NOT DISTINCT FROM (r0.endorsed_by,r0.patient_id,r0.service_key,r0.service_label,r0.service_tab,r0.note);
 candidates:='[]';
 IF u=c.provider_id THEN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('referral_id',s0.id,'service_key',s0.service_key,'service_label',s0.service_label,
   'service_tab',s0.service_tab,'note',s0.note,'preview_digest',private.pc_chat_referral_digest(s0)) ORDER BY s0.created_at DESC,s0.id),'[]') INTO candidates
  FROM (SELECT * FROM public.service_referrals s1 WHERE s1.doctor_id=u AND s1.patient_id=c.patient_id AND s1.status='pending'
   AND s1.care_request_id IS NULL AND length(trim(s1.service_label)) BETWEEN 1 AND 300 AND length(s1.service_key) BETWEEN 1 AND 100
   AND COALESCE(length(s1.note),0)<=2000 AND COALESCE(length(s1.service_tab),0)<=100
   AND NOT EXISTS(SELECT 1 FROM public.chat_service_referral_endorsements r1 WHERE r1.referral_id=s1.id)
   ORDER BY s1.created_at DESC,s1.id LIMIT 50) s0;
 END IF;
 RETURN jsonb_build_object('actor_id',u,'conversation_id',cid,'episode_id',eid,
  'member_role',CASE WHEN u=c.provider_id THEN 'doctor' ELSE 'patient' END,'cards',cards,'candidates',candidates);
END
$$;
CREATE FUNCTION public.pc_chat_referrals(p_input jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.pc_chat_referrals(p_input) $$;

REVOKE ALL ON FUNCTION private.pc_chat_referral_digest(public.service_referrals),
 private.pc_chat_referral_destination(text,text,text),private.pc_chat_referral_immutable(),private.pc_chat_referral_declined()
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.pc_chat_referrals(jsonb),public.pc_chat_referrals(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.pc_chat_referrals(jsonb),public.pc_chat_referrals(jsonb) TO authenticated;

BEGIN;

-- Owner-requested rollback of all 12 September chat/clinic work.
-- Restores the application contract from commit 2d9d18b (10 September).
-- Applied migrations stay immutable. No account reset, historical-row deletion,
-- RLS disablement, CASCADE, or production operation is used.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
LOCK TABLE "public"."chat_attachments", "public"."chat_consultation_episodes", "public"."chat_conversations", "public"."chat_member_receipts", "public"."chat_message_debits", "public"."chat_messages", "public"."chat_notification_delivery_config", "public"."chat_notification_device_deliveries", "public"."chat_notification_outbox", "public"."chat_prescription_events", "public"."chat_prescription_requests", "public"."chat_service_referral_endorsements", "public"."clinic_action_replays", "public"."clinic_appointments", "public"."clinic_consultation_pilot_participants", "public"."clinic_consultation_pilot_policies", "public"."clinic_consultation_policy", "public"."clinic_encounters", "public"."clinic_events", "public"."clinic_notification_jobs", "public"."clinic_offerings", "public"."clinic_released_records", "public"."doctor_appointments", "public"."post_consultation_chat_pilot_participants", "public"."post_consultation_chat_policies", "public"."service_referrals" IN ACCESS EXCLUSIVE MODE;
DO $rollback_guard$
DECLARE relation_name text; occupied boolean;
BEGIN
 FOREACH relation_name IN ARRAY ARRAY['public.chat_attachments','public.chat_consultation_episodes','public.chat_conversations','public.chat_member_receipts','public.chat_message_debits','public.chat_notification_device_deliveries','public.chat_notification_outbox','public.chat_prescription_events','public.chat_prescription_requests','public.chat_service_referral_endorsements','public.clinic_action_replays','public.clinic_appointments','public.clinic_consultation_pilot_participants','public.clinic_consultation_pilot_policies','public.clinic_encounters','public.clinic_events','public.clinic_notification_jobs','public.clinic_offerings','public.clinic_released_records','public.post_consultation_chat_pilot_participants'] LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s)',relation_name) INTO occupied;
  IF occupied THEN RAISE EXCEPTION 'Rollback stopped: % contains records requiring preservation',relation_name; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.chat_messages WHERE conversation_id IS NOT NULL OR episode_id IS NOT NULL OR sender_role IS NOT NULL OR idempotency_key IS NOT NULL OR attachment_id IS NOT NULL OR message_kind<>'text') THEN RAISE EXCEPTION 'Rollback stopped: canonical chat message data exists'; END IF;
 IF EXISTS(SELECT 1 FROM public.doctor_appointments WHERE mode='in_clinic') THEN RAISE EXCEPTION 'Rollback stopped: a clinic appointment exists'; END IF;
 IF (SELECT count(*) FROM public.clinic_consultation_policy)<>1 OR EXISTS(SELECT 1 FROM public.clinic_consultation_policy WHERE real_patients_enabled OR settings<>'{}'::jsonb) THEN RAISE EXCEPTION 'Rollback stopped: clinic policy differs from the disabled default'; END IF;
 IF (SELECT count(*) FROM public.chat_notification_delivery_config)<>1 OR EXISTS(SELECT 1 FROM public.chat_notification_delivery_config WHERE enabled OR channel<>'fcm') THEN RAISE EXCEPTION 'Rollback stopped: notification configuration differs from the disabled default'; END IF;
 IF (SELECT count(*) FROM public.post_consultation_chat_policies)<>1 OR EXISTS(SELECT 1 FROM public.post_consultation_chat_policies WHERE version<>'synthetic-home-followup-v1' OR NOT test_only OR duration_seconds<>86400 OR patient_message_limit<>25 OR starts_on<>'verified_home_visit_completion' OR scope<>'episode') THEN RAISE EXCEPTION 'Rollback stopped: chat policy differs from the synthetic seed'; END IF;
 IF to_regclass('storage.objects') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=''mydox-chat-quarantine'')' INTO occupied;
  IF occupied THEN RAISE EXCEPTION 'Rollback stopped: uploaded files exist'; END IF;
 END IF;
END $rollback_guard$;

DROP TRIGGER "chat_episode_immutable" ON "public"."chat_consultation_episodes";

DROP TRIGGER "chat_conversation_immutable" ON "public"."chat_conversations";

DROP TRIGGER "pc_chat_received_from_read" ON "public"."chat_member_receipts";

DROP TRIGGER "pc_chat_queue_notification" ON "public"."chat_notification_outbox";

DROP TRIGGER "pc_chat_referral_provenance_immutable" ON "public"."chat_service_referral_endorsements";

DROP TRIGGER "clinic_lifecycle_consistency" ON "public"."clinic_appointments";

DROP TRIGGER "clinic_encounter_consistency" ON "public"."clinic_encounters";

DROP TRIGGER "clinic_final_draft_guard" ON "public"."clinic_encounters";

DROP TRIGGER "clinic_events_immutable" ON "public"."clinic_events";

DROP TRIGGER "clinic_offering_revision" ON "public"."clinic_offerings";

DROP TRIGGER "clinic_record_chain_guard" ON "public"."clinic_released_records";

DROP TRIGGER "clinic_records_immutable" ON "public"."clinic_released_records";

DROP TRIGGER "clinic_parent_consistency" ON "public"."doctor_appointments";

DROP TRIGGER "clinic_parent_guard" ON "public"."doctor_appointments";

DROP TRIGGER "clinic_preserve_real_care" ON "public"."doctor_appointments";

DROP TRIGGER "chat_policy_immutable" ON "public"."post_consultation_chat_policies";

DROP TRIGGER "pc_chat_endorsed_referral_immutable" ON "public"."service_referrals";

DROP TRIGGER "pc_chat_referral_declined" ON "public"."service_referrals";

DROP POLICY "authorised canonical and historical messages" ON "public"."chat_messages";

DROP POLICY "verified surgical role messages only" ON "public"."chat_messages";

DROP POLICY "clinic_appointment_rollout" ON "public"."doctor_appointments";

DO $storage_policy$ BEGIN
 IF to_regclass('storage.objects') IS NOT NULL THEN
  EXECUTE 'DROP POLICY "chat quarantine server access only" ON storage.objects';
 END IF;
END $storage_policy$;

-- Restore the seven overwritten pre-existing functions before removing their new dependencies.

CREATE OR REPLACE FUNCTION private.hv_assignment_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid; s timestamptz; e timestamptz; BEGIN
 IF TG_TABLE_NAME='care_requests' THEN
  IF NEW.status<>'accepted' OR NEW.accepted_by IS NULL THEN RETURN NEW; END IF; u:=NEW.accepted_by;s:='-infinity';e:='infinity';
 ELSIF TG_TABLE_NAME='staffing_assignments' THEN
  IF NEW.status<>'accepted' THEN RETURN NEW; END IF; u:=NEW.provider_id; SELECT starts_at,ends_at INTO s,e FROM public.staffing_jobs WHERE id=NEW.job_id;
 ELSIF TG_TABLE_NAME='surgery_booking_roles' THEN
  IF NEW.status<>'accepted' OR NEW.assigned_to IS NULL THEN RETURN NEW; END IF; u:=NEW.assigned_to;s:='-infinity';e:='infinity';
 ELSIF TG_TABLE_NAME='physio_visits' THEN
  IF NEW.status NOT IN ('assigned','en_route','in_progress') OR NEW.therapist_id IS NULL THEN RETURN NEW; END IF; SELECT user_id INTO u FROM public.physio_therapists WHERE id=NEW.therapist_id; s:=NEW.scheduled_at;e:=s+make_interval(mins=>NEW.duration_min);
 END IF;
 IF u IS NULL THEN RETURN NEW; END IF;
 PERFORM private.hv_lock(u);
 IF EXISTS(SELECT 1 FROM public.doctor_appointments a WHERE a.provider_id=u AND a.status IN ('pending','confirmed','rescheduled')
 AND (a.mode<>'home_visit' OR a.status<>'pending' OR NOT EXISTS(SELECT 1 FROM public.home_visit_details d WHERE d.booking_id=a.id AND d.pending_deadline<=now()))
 AND tstzrange(a.start_time-make_interval(mins=>a.home_buffer_before_minutes),CASE WHEN a.mode='home_visit' AND a.home_visit_status IN ('en_route','arrived','in_consultation') THEN 'infinity'::timestamptz ELSE a.end_time+make_interval(mins=>a.home_buffer_after_minutes) END,'[)') && tstzrange(COALESCE(s,'-infinity'::timestamptz),COALESCE(e,'infinity'::timestamptz),'[)'))
 OR EXISTS(SELECT 1 FROM public.home_visit_reschedule_holds h WHERE provider_id=u AND expires_at>now() AND tstzrange(h.start_time-make_interval(mins=>h.buffer_before_minutes),h.end_time+make_interval(mins=>h.buffer_after_minutes),'[)') && tstzrange(COALESCE(s,'-infinity'::timestamptz),COALESCE(e,'infinity'::timestamptz),'[)'))
 THEN RAISE EXCEPTION 'Provider capacity conflict with a doctor appointment'; END IF;
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION private.hv_busy(p_provider uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_exclude uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.doctor_appointments a WHERE a.provider_id=p_provider AND a.id IS DISTINCT FROM p_exclude
 AND a.status IN ('pending','confirmed','rescheduled') AND
 (a.mode<>'home_visit' OR a.status<>'pending' OR NOT EXISTS(SELECT 1 FROM public.home_visit_details d WHERE d.booking_id=a.id AND d.pending_deadline<=now()))
 AND tstzrange(a.start_time-make_interval(mins=>a.home_buffer_before_minutes),
 CASE WHEN a.mode='home_visit' AND a.home_visit_status IN ('en_route','arrived','in_consultation') THEN 'infinity'::timestamptz ELSE a.end_time+make_interval(mins=>a.home_buffer_after_minutes) END,'[)') && tstzrange(p_start,p_end,'[)'))
 OR EXISTS(SELECT 1 FROM public.home_visit_reschedule_holds h WHERE h.provider_id=p_provider AND h.booking_id IS DISTINCT FROM p_exclude AND expires_at>now() AND tstzrange(h.start_time-make_interval(mins=>h.buffer_before_minutes),h.end_time+make_interval(mins=>h.buffer_after_minutes),'[)') && tstzrange(p_start,p_end,'[)'))
 OR EXISTS(SELECT 1 FROM public.care_requests r WHERE accepted_by=p_provider AND status='accepted')
 OR EXISTS(SELECT 1 FROM public.staffing_assignments a JOIN public.staffing_jobs j ON j.id=a.job_id WHERE a.provider_id=p_provider AND a.status='accepted' AND j.status NOT IN ('cancelled','closed') AND (j.starts_at IS NULL OR j.ends_at IS NULL OR tstzrange(j.starts_at,j.ends_at,'[)') && tstzrange(p_start,p_end,'[)')))
 OR EXISTS(SELECT 1 FROM public.surgery_booking_roles r JOIN public.surgery_bookings b ON b.id=r.booking_id WHERE r.assigned_to=p_provider AND r.status='accepted' AND b.status NOT IN ('completed','cancelled'))
 OR EXISTS(SELECT 1 FROM public.physio_visits v JOIN public.physio_therapists t ON t.id=v.therapist_id WHERE t.user_id=p_provider AND v.status IN ('assigned','en_route','in_progress') AND (v.scheduled_at IS NULL OR tstzrange(v.scheduled_at,v.scheduled_at+make_interval(mins=>v.duration_min),'[)') && tstzrange(p_start,p_end,'[)')))
$function$
;

CREATE OR REPLACE FUNCTION private.hv_parent_assignment_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r record; s timestamptz; e timestamptz; BEGIN
 IF TG_TABLE_NAME='staffing_jobs' THEN
  IF NEW.status IN ('cancelled','closed') THEN RETURN NEW; END IF;
  s:=COALESCE(NEW.starts_at,'-infinity'::timestamptz); e:=COALESCE(NEW.ends_at,'infinity'::timestamptz);
  FOR r IN SELECT provider_id FROM public.staffing_assignments WHERE job_id=NEW.id AND status='accepted' ORDER BY provider_id LOOP
   PERFORM private.hv_lock(r.provider_id);
   IF EXISTS(SELECT 1 FROM public.doctor_appointments a WHERE a.provider_id=r.provider_id AND a.status IN ('pending','confirmed','rescheduled') AND tstzrange(a.start_time-make_interval(mins=>a.home_buffer_before_minutes),CASE WHEN a.mode='home_visit' AND a.home_visit_status IN ('en_route','arrived','in_consultation') THEN 'infinity'::timestamptz ELSE a.end_time+make_interval(mins=>a.home_buffer_after_minutes) END,'[)') && tstzrange(s,e,'[)'))
   OR EXISTS(SELECT 1 FROM public.home_visit_reschedule_holds h WHERE h.provider_id=r.provider_id AND h.expires_at>now() AND tstzrange(h.start_time-make_interval(mins=>h.buffer_before_minutes),h.end_time+make_interval(mins=>h.buffer_after_minutes),'[)') && tstzrange(s,e,'[)')) THEN RAISE EXCEPTION 'Duty change conflicts with a doctor appointment'; END IF;
  END LOOP;
 ELSIF TG_TABLE_NAME='surgery_bookings' THEN
  IF NEW.status IN ('completed','cancelled') THEN RETURN NEW; END IF;
  FOR r IN SELECT assigned_to provider_id FROM public.surgery_booking_roles WHERE booking_id=NEW.id AND status='accepted' AND assigned_to IS NOT NULL ORDER BY assigned_to LOOP
   PERFORM private.hv_lock(r.provider_id);
   IF EXISTS(SELECT 1 FROM public.doctor_appointments WHERE provider_id=r.provider_id AND status IN ('pending','confirmed','rescheduled')) OR EXISTS(SELECT 1 FROM public.home_visit_reschedule_holds WHERE provider_id=r.provider_id AND expires_at>now()) THEN RAISE EXCEPTION 'Active surgery conflicts with a doctor appointment'; END IF;
  END LOOP;
 ELSIF TG_TABLE_NAME='physio_therapists' THEN
  IF NEW.user_id IS NULL OR NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN RETURN NEW; END IF;
  PERFORM private.hv_lock(NEW.user_id);
  IF EXISTS(SELECT 1 FROM public.physio_visits WHERE therapist_id=NEW.id AND status IN ('assigned','en_route','in_progress')) AND (EXISTS(SELECT 1 FROM public.doctor_appointments WHERE provider_id=NEW.user_id AND status IN ('pending','confirmed','rescheduled')) OR EXISTS(SELECT 1 FROM public.home_visit_reschedule_holds WHERE provider_id=NEW.user_id AND expires_at>now())) THEN RAISE EXCEPTION 'Therapist reassignment conflicts with a doctor appointment'; END IF;
 END IF;
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.atomic_book_appointment(p_provider_id uuid, p_patient_id uuid, p_start_time timestamp with time zone, p_end_time timestamp with time zone, p_service text, p_fee numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a public.provider_availability; win jsonb; valid boolean:=false; bid uuid; BEGIN
 IF auth.uid() IS NULL OR p_patient_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Authenticated patient ownership required'; END IF;
 IF lower(COALESCE(p_service,'')) LIKE '%home%' THEN RAISE EXCEPTION 'Use home-visit quote and booking APIs'; END IF;
 IF p_start_time IS NULL OR p_end_time IS NULL OR p_start_time<=now() OR p_end_time<=p_start_time OR p_fee IS NULL OR p_fee<0 THEN RAISE EXCEPTION 'Valid future appointment interval and fee required'; END IF;
 SELECT * INTO a FROM public.provider_availability WHERE user_id=p_provider_id;
 IF a.user_id IS NULL OR NOT a.is_online OR (p_start_time AT TIME ZONE a.timezone)::date=ANY(a.blocked_dates) OR (p_start_time AT TIME ZONE a.timezone)::date<>(p_end_time AT TIME ZONE a.timezone)::date THEN RAISE EXCEPTION 'Provider is not available for booking'; END IF;
 FOR win IN SELECT * FROM jsonb_array_elements(COALESCE(a.working_hours->lower(to_char(p_start_time AT TIME ZONE a.timezone,'dy')),'[]')) LOOP
  IF (p_start_time AT TIME ZONE a.timezone)::time>=(win->>'start')::time AND (p_end_time AT TIME ZONE a.timezone)::time<=(win->>'end')::time THEN valid:=true; END IF;
 END LOOP;
 IF NOT valid THEN RAISE EXCEPTION 'Requested slot is outside provider working hours'; END IF;
 INSERT INTO public.doctor_appointments(provider_id,patient_id,start_time,end_time,service,fee,provider_timezone) VALUES(p_provider_id,p_patient_id,p_start_time,p_end_time,p_service,p_fee,a.timezone) RETURNING id INTO bid;
 RETURN bid;
END $function$
;

CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a public.doctor_appointments; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthenticated caller'; END IF;
 SELECT * INTO a FROM public.doctor_appointments WHERE id=p_appointment_id FOR UPDATE;
 IF a.id IS NULL OR (auth.uid() IS DISTINCT FROM a.patient_id AND auth.uid() IS DISTINCT FROM a.provider_id) THEN RAISE EXCEPTION 'Unauthorized to cancel this appointment'; END IF;
 IF a.mode='home_visit' THEN RAISE EXCEPTION 'Use the home-visit cancellation action with version and reason'; END IF;
 IF a.status NOT IN ('confirmed','rescheduled') THEN RAISE EXCEPTION 'Only confirmed or rescheduled appointments can be cancelled'; END IF;
 UPDATE public.doctor_appointments SET status='cancelled',updated_at=now() WHERE id=a.id;
END $function$
;

CREATE OR REPLACE FUNCTION public.hv_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid:=private.hv_actor(); bid uuid; r jsonb:='[]'; BEGIN
 FOR bid IN SELECT a.id FROM public.doctor_appointments a JOIN public.home_visit_details d ON d.booking_id=a.id WHERE d.actor_id=u OR d.patient_id=u OR (a.provider_id=u AND d.accepted_at IS NOT NULL) OR (a.home_visit_status='pending' AND d.pending_deadline>now() AND private.hv_doctor(u) AND EXISTS(SELECT 1 FROM public.home_visit_offers o WHERE o.booking_id=a.id AND o.provider_id=u AND o.declined_at IS NULL)) ORDER BY a.created_at DESC LIMIT 200 LOOP r:=r||jsonb_build_array(private.hv_view(bid,u)); END LOOP; RETURN r;
END $function$
;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(p_appointment_id uuid, p_new_start timestamp with time zone, p_new_end timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a public.doctor_appointments; avail public.provider_availability; win jsonb; valid boolean:=false; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthenticated caller'; END IF;
 SELECT * INTO a FROM public.doctor_appointments WHERE id=p_appointment_id FOR UPDATE;
 IF a.id IS NULL OR (auth.uid() IS DISTINCT FROM a.patient_id AND auth.uid() IS DISTINCT FROM a.provider_id) THEN RAISE EXCEPTION 'Unauthorized to reschedule this appointment'; END IF;
 IF a.mode='home_visit' THEN RAISE EXCEPTION 'Use the home-visit rescheduling quote and approval actions'; END IF;
 IF a.status NOT IN ('confirmed','rescheduled') OR p_new_start<=now() OR p_new_end<=p_new_start THEN RAISE EXCEPTION 'Invalid future appointment interval'; END IF;
 SELECT * INTO avail FROM public.provider_availability WHERE user_id=a.provider_id;
 IF avail.user_id IS NULL OR NOT avail.is_online OR (p_new_start AT TIME ZONE avail.timezone)::date=ANY(avail.blocked_dates) OR (p_new_start AT TIME ZONE avail.timezone)::date<>(p_new_end AT TIME ZONE avail.timezone)::date THEN RAISE EXCEPTION 'Provider is not available for booking'; END IF;
 FOR win IN SELECT * FROM jsonb_array_elements(COALESCE(avail.working_hours->lower(to_char(p_new_start AT TIME ZONE avail.timezone,'dy')),'[]')) LOOP
  IF (p_new_start AT TIME ZONE avail.timezone)::time>=(win->>'start')::time AND (p_new_end AT TIME ZONE avail.timezone)::time<=(win->>'end')::time THEN valid:=true; END IF;
 END LOOP;
 IF NOT valid THEN RAISE EXCEPTION 'Requested slot is outside provider working hours'; END IF;
 UPDATE public.doctor_appointments SET start_time=p_new_start,end_time=p_new_end,status='rescheduled',updated_at=now() WHERE id=a.id;
END $function$
;

DROP FUNCTION
 private.cc_actor(),
 private.cc_consistency(),
 private.cc_doctor(u uuid),
 private.cc_enabled(u uuid),
 private.cc_event(bid uuid, u uuid, k text, v integer, r text),
 private.cc_final_draft_guard(),
 private.cc_immutable_record(),
 private.cc_occupied_end(a public.doctor_appointments),
 private.cc_occupied_start(a public.doctor_appointments),
 private.cc_offering_allowed(o public.clinic_offerings, u uuid),
 private.cc_offering_json(o public.clinic_offerings),
 private.cc_offering_revision(),
 private.cc_parent_guard(),
 private.cc_preserve_real_care(),
 private.cc_record_chain_guard(),
 private.cc_settings(o public.clinic_offerings),
 private.cc_status(l text),
 private.cc_time_valid(o public.clinic_offerings, s timestamp with time zone, e timestamp with time zone),
 private.cc_validate_content(c jsonb, s jsonb, finalising boolean),
 private.cc_validate_settings(s jsonb),
 private.cc_visit(bid uuid, u uuid),
 private.pc_chat_ack_read(p_input jsonb),
 private.pc_chat_ack_received(p_input jsonb),
 private.pc_chat_attachment_enabled(p_actor uuid),
 private.pc_chat_attachment_intent(p_input jsonb),
 private.pc_chat_attachment_member(p_actor uuid, p_conversation uuid),
 private.pc_chat_attachment_message(p_id uuid),
 private.pc_chat_authorize_notification_device(p_id uuid, p_lease_token uuid, p_device_id uuid),
 private.pc_chat_claim_notifications(p_limit integer),
 private.pc_chat_context(),
 private.pc_chat_doctor(p_uid uuid),
 private.pc_chat_enabled(p_uid uuid),
 private.pc_chat_finish_notification(p_id uuid, p_lease_token uuid),
 private.pc_chat_history(p_input jsonb),
 private.pc_chat_immutable(),
 private.pc_chat_inbox(),
 private.pc_chat_member(p_conversation uuid),
 private.pc_chat_notification_allowed(p_id uuid),
 private.pc_chat_notification_lease(p_id uuid, p_lease_token uuid),
 private.pc_chat_open(p_input jsonb),
 private.pc_chat_prepare_notification(p_id uuid, p_lease_token uuid),
 private.pc_chat_prescription(p_input jsonb),
 private.pc_chat_queue_notification(),
 private.pc_chat_received_from_read(),
 private.pc_chat_record_notification_device(p_id uuid, p_lease_token uuid, p_device_id uuid, p_outcome text, p_provider_id text),
 private.pc_chat_referral_declined(),
 private.pc_chat_referral_destination(p_tab text, p_key text, p_label text),
 private.pc_chat_referral_digest(r public.service_referrals),
 private.pc_chat_referral_immutable(),
 private.pc_chat_referrals(p_input jsonb),
 private.pc_chat_require(p_conversation uuid),
 private.pc_chat_send(p_input jsonb),
 private.pc_chat_summary(p_conversation uuid, p_episode uuid),
 private.pc_surgery_member(p_thread text, p_sender uuid, p_recipient uuid, p_write boolean),
 public.book_video_appointment(p_provider_id uuid, p_patient_id uuid, p_start_time timestamp with time zone, p_end_time timestamp with time zone, p_service text, p_fee numeric),
 public.clinic_consultation(p_input jsonb),
 public.pc_chat_ack_read(p_input jsonb),
 public.pc_chat_ack_received(p_input jsonb),
 public.pc_chat_attachment_claim(p_actor uuid, p_id uuid),
 public.pc_chat_attachment_cleanup_claim(),
 public.pc_chat_attachment_cleanup_finish(p_id uuid, p_lease uuid),
 public.pc_chat_attachment_download(p_actor uuid, p_id uuid),
 public.pc_chat_attachment_finalize(p_actor uuid, p_id uuid, p_lease uuid, p_sha256 text, p_size integer, p_mime text, p_scan_engine text),
 public.pc_chat_attachment_intent(p_input jsonb),
 public.pc_chat_attachment_reject(p_actor uuid, p_id uuid, p_lease uuid),
 public.pc_chat_authorize_notification_device(p_id uuid, p_lease_token uuid, p_device_id uuid),
 public.pc_chat_claim_notifications(p_limit integer),
 public.pc_chat_context(),
 public.pc_chat_finish_notification(p_id uuid, p_lease_token uuid),
 public.pc_chat_history(p_input jsonb),
 public.pc_chat_inbox(),
 public.pc_chat_open(p_input jsonb),
 public.pc_chat_prepare_notification(p_id uuid, p_lease_token uuid),
 public.pc_chat_prescription(p_input jsonb),
 public.pc_chat_record_notification_device(p_id uuid, p_lease_token uuid, p_device_id uuid, p_outcome text, p_provider_id text),
 public.pc_chat_referrals(p_input jsonb),
 public.pc_chat_send(p_input jsonb);

ALTER TABLE public.chat_messages DROP COLUMN "attachment_id";

ALTER TABLE public.chat_messages DROP COLUMN "conversation_id";

ALTER TABLE public.chat_messages DROP COLUMN "episode_id";

ALTER TABLE public.chat_messages DROP COLUMN "idempotency_key";

ALTER TABLE public.chat_messages DROP COLUMN "message_kind";

ALTER TABLE public.chat_messages DROP COLUMN "sender_role";

ALTER TABLE public.chat_messages DROP COLUMN "sequence_id";

DROP TABLE
 "public"."chat_attachments",
 "public"."chat_consultation_episodes",
 "public"."chat_conversations",
 "public"."chat_member_receipts",
 "public"."chat_message_debits",
 "public"."chat_notification_delivery_config",
 "public"."chat_notification_device_deliveries",
 "public"."chat_notification_outbox",
 "public"."chat_prescription_events",
 "public"."chat_prescription_requests",
 "public"."chat_service_referral_endorsements",
 "public"."clinic_action_replays",
 "public"."clinic_appointments",
 "public"."clinic_consultation_pilot_participants",
 "public"."clinic_consultation_pilot_policies",
 "public"."clinic_consultation_policy",
 "public"."clinic_encounters",
 "public"."clinic_events",
 "public"."clinic_notification_jobs",
 "public"."clinic_offerings",
 "public"."clinic_released_records",
 "public"."post_consultation_chat_pilot_participants",
 "public"."post_consultation_chat_policies";

ALTER TABLE public.doctor_appointments DROP CONSTRAINT doctor_appointments_identity_key;

CREATE POLICY "participants can read" ON "public"."chat_messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));

CREATE POLICY "sender can insert" ON "public"."chat_messages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid() = sender_id));

-- Restore the original transport table grants; existing RLS remains enabled.
GRANT ALL ON TABLE public.chat_messages TO anon,authenticated,service_role;
NOTIFY pgrst, 'reload schema';

COMMIT;

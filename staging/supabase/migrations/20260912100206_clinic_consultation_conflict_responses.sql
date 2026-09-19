-- Forward repair for deterministic clinic business conflicts only.
-- PostgREST can indefinitely retry a custom SQLSTATE 40001. PT409 returns
-- HTTP 409 without misrepresenting stale input as a serialization failure.
-- The applied lifecycle migration remains immutable. This explicit function
-- replacement changes only its nine intentional conflict codes; database
-- serialization failures are not caught or translated, and existing grants,
-- transaction boundaries, rollout gates and record state remain unchanged.
-- https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b

CREATE OR REPLACE FUNCTION public.clinic_consultation(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; act text:=p_input->>'action'; bid uuid; c public.clinic_appointments; a public.doctor_appointments; o public.clinic_offerings; e public.clinic_encounters;
 s jsonb; content jsonb; snap jsonb; items jsonb; cursor_out jsonb; replay public.clinic_action_replays; key text; hash text; reason text; dt timestamptz; de timestamptz;
 from_day date; to_day date; day date; av public.provider_availability; w jsonb; ending timestamptz; lim integer; scope text; prev public.clinic_released_records; record_id uuid; clinician jsonb; h jsonb; newstate text; nextversion integer;
BEGIN
 IF p_input IS NULL OR jsonb_typeof(p_input)<>'object' THEN RAISE EXCEPTION 'Clinic action input is required' USING ERRCODE='22023'; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to use clinic appointments' USING ERRCODE='42501'; END IF;
 IF act='context' THEN
  SELECT COALESCE((SELECT p.settings FROM public.clinic_consultation_pilot_participants x JOIN public.clinic_consultation_pilot_policies p ON p.id=x.policy_id WHERE x.user_id=auth.uid()),settings) INTO s FROM public.clinic_consultation_policy WHERE singleton;
  RETURN jsonb_build_object('enabled',private.cc_enabled(auth.uid()),'reason','Real-patient clinic consultations require owner-approved policies and release review','actor_id',auth.uid(),'is_doctor',private.cc_doctor(auth.uid()),'real_patients_enabled',(SELECT real_patients_enabled FROM public.clinic_consultation_policy WHERE singleton),'dependent_booking_enabled',false,'reception_enabled',false,'notifications_enabled',false,'policy',s);
 END IF;
 u:=private.cc_actor();
 IF act='offerings' THEN
  SELECT COALESCE(jsonb_agg(private.cc_offering_json(x) ORDER BY x.id),'[]') INTO items FROM public.clinic_offerings x
  WHERE private.cc_offering_allowed(x,u) AND (NULLIF(p_input->>'provider_id','') IS NULL OR x.provider_id=(p_input->>'provider_id')::uuid) AND (NULLIF(p_input->>'clinic_id','') IS NULL OR x.clinic_id=(p_input->>'clinic_id')::uuid);
  RETURN jsonb_build_object('items',items,'server_time',now());
 ELSIF act='slots' THEN
  SELECT * INTO o FROM public.clinic_offerings WHERE id=(p_input->>'offering_id')::uuid;
  IF o.id IS NULL OR NOT private.cc_offering_allowed(o,u) THEN RAISE EXCEPTION 'Approved clinic offering is unavailable' USING ERRCODE='42501'; END IF;
  PERFORM private.cc_validate_settings(private.cc_settings(o));
  from_day:=(p_input->>'start_date')::date; to_day:=(p_input->>'end_date')::date;
  IF from_day IS NULL OR to_day IS NULL OR to_day<from_day OR to_day-from_day>30 OR to_day>(now() AT TIME ZONE o.timezone)::date+180 THEN RAISE EXCEPTION 'Select a clinic date range of at most 31 days within 180 days' USING ERRCODE='22023'; END IF;
  SELECT * INTO av FROM public.provider_availability WHERE user_id=o.provider_id;
  day:=from_day; items:='[]';
  WHILE day<=to_day LOOP
   IF jsonb_typeof(av.working_hours->lower(to_char(day,'dy')))='array' THEN
    FOR w IN SELECT * FROM jsonb_array_elements(av.working_hours->lower(to_char(day,'dy'))) LOOP
     dt:=(day+(w->>'start')::time) AT TIME ZONE o.timezone; ending:=(day+(w->>'end')::time) AT TIME ZONE o.timezone;
     WHILE dt+make_interval(mins=>o.duration_minutes)<=ending LOOP
      de:=dt+make_interval(mins=>o.duration_minutes);
      IF dt>now() AND private.cc_time_valid(o,dt,de) AND NOT private.hv_busy(o.provider_id,dt,de) THEN items:=items||jsonb_build_array(jsonb_build_object('start_time',dt,'end_time',de)); END IF;
      dt:=de;
     END LOOP;
    END LOOP;
   END IF;
   day:=day+1;
  END LOOP;
  RETURN jsonb_build_object('offering',private.cc_offering_json(o),'items',items,'server_time',now());
 ELSIF act='list' THEN
  scope:=COALESCE(p_input->>'scope','patient'); lim:=COALESCE((p_input->>'limit')::integer,25);
  IF scope NOT IN ('patient','doctor','history','records') OR lim NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid clinic list scope or page size' USING ERRCODE='22023'; END IF;
  items:='[]'; cursor_out:=NULL;
  FOR c IN SELECT x.* FROM public.clinic_appointments x WHERE
   ((scope='doctor' AND x.provider_id=u) OR (scope<>'doctor' AND x.patient_id=u))
   AND (scope NOT IN ('history','records') OR x.lifecycle IN ('completed','interrupted'))
   AND private.cc_enabled(x.patient_id) AND private.cc_enabled(x.provider_id)
   AND (p_input->'cursor' IS NULL OR p_input->'cursor'='null'::jsonb OR (x.created_at,x.appointment_id)<((p_input->'cursor'->>'created_at')::timestamptz,(p_input->'cursor'->>'appointment_id')::uuid))
   ORDER BY x.created_at DESC,x.appointment_id DESC LIMIT lim+1 LOOP
   IF jsonb_array_length(items)=lim THEN EXIT; END IF;
   items:=items||jsonb_build_array(private.cc_visit(c.appointment_id,u));
   cursor_out:=jsonb_build_object('created_at',c.created_at,'appointment_id',c.appointment_id);
  END LOOP;
  IF jsonb_array_length(items)<lim THEN cursor_out:=NULL; END IF;
  RETURN jsonb_build_object('items',items,'next_cursor',cursor_out,'server_time',now());
 ELSIF act='reconcile' THEN
  SELECT * INTO c FROM public.clinic_appointments WHERE actor_id=u AND idempotency_key=p_input->>'idempotency_key';
  RETURN jsonb_build_object('visit',CASE WHEN c.appointment_id IS NULL THEN NULL ELSE private.cc_visit(c.appointment_id,u) END);
 ELSIF act='book' THEN
  IF NULLIF(p_input->>'dependent_id','') IS NOT NULL OR (NULLIF(p_input->>'patient_id','') IS NOT NULL AND (p_input->>'patient_id')::uuid<>u) THEN RAISE EXCEPTION 'Only self-booking is enabled; verified dependent authority is required' USING ERRCODE='42501'; END IF;
  key:=p_input->>'idempotency_key';
  IF key IS NULL OR length(key) NOT BETWEEN 16 AND 128 THEN RAISE EXCEPTION 'A stable booking idempotency key is required' USING ERRCODE='22023'; END IF;
  hash:=encode(sha256(convert_to((p_input-'idempotency_key')::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':'||key,621398));
  IF EXISTS(SELECT 1 FROM public.clinic_action_replays WHERE actor_id=u AND idempotency_key=key AND action<>'book') THEN RAISE EXCEPTION 'Idempotency key was already used for another action' USING ERRCODE='PT409'; END IF;
  SELECT * INTO c FROM public.clinic_appointments WHERE actor_id=u AND idempotency_key=key;
  IF c.appointment_id IS NOT NULL THEN
   IF c.payload_hash<>hash THEN RAISE EXCEPTION 'Idempotency key was already used for different booking details' USING ERRCODE='PT409'; END IF;
   RETURN private.cc_visit(c.appointment_id,u);
  END IF;
  SELECT * INTO o FROM public.clinic_offerings WHERE id=(p_input->>'offering_id')::uuid FOR SHARE;
  IF o.id IS NULL OR NOT private.cc_offering_allowed(o,u) THEN RAISE EXCEPTION 'Approved clinic offering is unavailable' USING ERRCODE='42501'; END IF;
  IF (p_input->>'offering_version')::integer IS DISTINCT FROM o.version THEN RAISE EXCEPTION 'Clinic offering changed; refresh its fee and availability' USING ERRCODE='PT409'; END IF;
  s:=private.cc_settings(o); PERFORM private.cc_validate_settings(s);
  dt:=(p_input->>'start_time')::timestamptz; de:=dt+make_interval(mins=>o.duration_minutes);
  PERFORM private.hv_lock(o.provider_id);
  IF dt IS NULL OR dt<=clock_timestamp() OR dt>clock_timestamp()+interval '180 days' OR NOT private.cc_time_valid(o,dt,de) THEN RAISE EXCEPTION 'The selected clinic interval is invalid or no longer in the future' USING ERRCODE='22023'; END IF;
  IF private.hv_busy(o.provider_id,dt,de) THEN RAISE EXCEPTION 'Provider capacity conflict; select another appointment' USING ERRCODE='PT409'; END IF;
  snap:=private.cc_offering_json(o);
  INSERT INTO public.doctor_appointments(provider_id,patient_id,service,mode,location,start_time,end_time,provider_timezone,fee,currency,status)
  VALUES(o.provider_id,u,'In-clinic consultation','in_clinic',snap->>'clinic_name',dt,de,o.timezone,o.fee,o.currency,'pending') RETURNING id INTO bid;
  INSERT INTO public.clinic_appointments(appointment_id,actor_id,patient_id,provider_id,clinic_id,offering_id,policy_snapshot,offering_snapshot,scheduled_start,scheduled_end,idempotency_key,payload_hash)
  VALUES(bid,u,u,o.provider_id,o.clinic_id,o.id,s,snap,dt,de,key,hash);
  PERFORM private.cc_event(bid,u,'book',1);
  INSERT INTO public.clinic_action_replays(actor_id,idempotency_key,appointment_id,action,payload_hash) VALUES(u,key,bid,'book',hash);
  RETURN private.cc_visit(bid,u);
 END IF;

 bid:=(p_input->>'appointment_id')::uuid;
 -- Authorise before locking or disclosing an idempotent result.
 PERFORM private.cc_visit(bid,u);
 IF act='open' THEN RETURN private.cc_visit(bid,u); END IF;
 key:=p_input->>'idempotency_key';
 IF key IS NULL OR length(key) NOT BETWEEN 16 AND 128 THEN RAISE EXCEPTION 'A stable action idempotency key is required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':'||key,621398));
 SELECT * INTO c FROM public.clinic_appointments WHERE appointment_id=bid;
 PERFORM private.hv_lock(c.provider_id);
 SELECT * INTO c FROM public.clinic_appointments WHERE appointment_id=bid FOR UPDATE;
 SELECT * INTO a FROM public.doctor_appointments WHERE id=bid FOR UPDATE;
 PERFORM private.cc_visit(bid,u);
 IF (NULLIF(p_input->>'patient_id','') IS NOT NULL AND (p_input->>'patient_id')::uuid<>c.patient_id) OR (NULLIF(p_input->>'provider_id','') IS NOT NULL AND (p_input->>'provider_id')::uuid<>c.provider_id) OR (NULLIF(p_input->>'clinic_id','') IS NOT NULL AND (p_input->>'clinic_id')::uuid<>c.clinic_id) OR (NULLIF(p_input->>'actor_id','') IS NOT NULL AND (p_input->>'actor_id')::uuid<>u) THEN RAISE EXCEPTION 'Clinic appointment identities cannot be substituted' USING ERRCODE='42501'; END IF;
 IF act NOT IN ('confirm','decline','cancel','check_in','start','save_draft','complete','amend','interrupt','no_show','reschedule') THEN RAISE EXCEPTION 'Unsupported clinic action' USING ERRCODE='22023'; END IF;
 IF act NOT IN ('cancel','reschedule') AND (u<>c.provider_id OR NOT private.cc_doctor(u)) THEN RAISE EXCEPTION 'Assigned verified clinician required' USING ERRCODE='42501'; END IF;
 key:=p_input->>'idempotency_key';
 IF key IS NULL OR length(key) NOT BETWEEN 16 AND 128 THEN RAISE EXCEPTION 'A stable action idempotency key is required' USING ERRCODE='22023'; END IF;
 hash:=encode(sha256(convert_to((p_input-'idempotency_key')::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':'||key,621398));
 SELECT * INTO replay FROM public.clinic_action_replays WHERE actor_id=u AND idempotency_key=key;
 IF replay.actor_id IS NOT NULL THEN
  IF replay.appointment_id<>bid OR replay.action<>act OR replay.payload_hash<>hash THEN RAISE EXCEPTION 'Idempotency key was already used for different action details' USING ERRCODE='PT409'; END IF;
  RETURN private.cc_visit(bid,u);
 END IF;
 IF (act='check_in' AND c.lifecycle='checked_in') OR (act='start' AND c.lifecycle='in_consultation') THEN
  IF act='check_in' AND ((p_input->>'clinic_id')::uuid IS DISTINCT FROM c.clinic_id OR p_input->'identity_confirmed' IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'Confirm identity at the booked clinic' USING ERRCODE='42501'; END IF;
  INSERT INTO public.clinic_action_replays(actor_id,idempotency_key,appointment_id,action,payload_hash) VALUES(u,key,bid,act,hash);
  RETURN private.cc_visit(bid,u);
 END IF;
 IF (p_input->>'expected_version')::integer IS DISTINCT FROM c.version THEN RAISE EXCEPTION 'Clinic appointment changed; refresh before retrying' USING ERRCODE='PT409'; END IF;
 reason:=NULLIF(trim(p_input->>'reason'),'');
 IF reason IS NOT NULL AND length(reason)>2000 THEN RAISE EXCEPTION 'Action reason is too long' USING ERRCODE='22023'; END IF;
 newstate:=c.lifecycle; nextversion:=c.version+1;
 IF act='confirm' THEN
  IF c.lifecycle<>'pending_confirmation' THEN RAISE EXCEPTION 'Only pending appointments can be confirmed' USING ERRCODE='55000'; END IF;
  newstate:='confirmed';
 ELSIF act='decline' THEN
  IF c.lifecycle<>'pending_confirmation' OR reason IS NULL THEN RAISE EXCEPTION 'Declining a pending appointment requires a reason' USING ERRCODE='55000'; END IF;
  newstate:='declined';
 ELSIF act='cancel' THEN
  IF c.lifecycle NOT IN ('pending_confirmation','confirmed') OR reason IS NULL OR NOT COALESCE((c.policy_snapshot->>'cancel_allowed')::boolean,false) THEN RAISE EXCEPTION 'Cancellation is not enabled for this clinic state; retain the appointment and contact the clinic' USING ERRCODE='55000'; END IF;
  newstate:='cancelled';
 ELSIF act='reschedule' THEN
  IF c.lifecycle NOT IN ('pending_confirmation','confirmed') OR reason IS NULL OR NOT COALESCE((c.policy_snapshot->>'reschedule_allowed')::boolean,false) THEN RAISE EXCEPTION 'Rescheduling is not enabled for this clinic state' USING ERRCODE='55000'; END IF;
  SELECT * INTO o FROM public.clinic_offerings WHERE id=c.offering_id FOR SHARE;
  IF NOT private.cc_offering_allowed(o,u) THEN RAISE EXCEPTION 'Clinic offering is unavailable' USING ERRCODE='42501'; END IF;
  dt:=(p_input->>'start_time')::timestamptz; de:=dt+(a.end_time-a.start_time);
  IF dt IS NULL OR dt<=clock_timestamp() OR dt>clock_timestamp()+interval '180 days' OR NOT private.cc_time_valid(o,dt,de) THEN RAISE EXCEPTION 'Invalid future clinic interval' USING ERRCODE='22023'; END IF;
  IF private.hv_busy(c.provider_id,dt,de,bid) THEN RAISE EXCEPTION 'Provider capacity conflict; original appointment retained' USING ERRCODE='PT409'; END IF;
  UPDATE public.clinic_appointments SET scheduled_start=dt,scheduled_end=de WHERE appointment_id=bid;
  newstate:='pending_confirmation';
 ELSIF act='check_in' THEN
  IF c.lifecycle<>'confirmed' THEN RAISE EXCEPTION 'The doctor must confirm the appointment before check-in' USING ERRCODE='55000'; END IF;
  IF (p_input->>'clinic_id')::uuid IS DISTINCT FROM c.clinic_id OR p_input->'identity_confirmed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Confirm identity at the booked clinic' USING ERRCODE='42501'; END IF;
  IF clock_timestamp()<a.start_time-make_interval(mins=>(c.policy_snapshot->>'check_in_before_minutes')::integer) OR clock_timestamp()>a.end_time+make_interval(mins=>(c.policy_snapshot->>'check_in_after_minutes')::integer) THEN RAISE EXCEPTION 'Outside the configured clinic check-in window' USING ERRCODE='55000'; END IF;
  UPDATE public.clinic_appointments SET checked_in_at=clock_timestamp(),checked_in_by=u WHERE appointment_id=bid;
  newstate:='checked_in';
 ELSIF act='start' THEN
  IF c.lifecycle<>'checked_in' THEN RAISE EXCEPTION 'Verified check-in is required before consultation starts' USING ERRCODE='55000'; END IF;
  dt:=clock_timestamp(); de:=greatest(a.end_time,dt+(a.end_time-a.start_time));
  IF EXISTS(SELECT 1 FROM public.clinic_appointments WHERE provider_id=c.provider_id AND appointment_id<>bid AND lifecycle='in_consultation') OR private.hv_busy(c.provider_id,dt,de,bid) THEN RAISE EXCEPTION 'Starting consultation conflicts with current or upcoming provider capacity' USING ERRCODE='PT409'; END IF;
  INSERT INTO public.clinic_encounters(appointment_id,patient_id,provider_id,clinic_id,started_at) VALUES(bid,c.patient_id,c.provider_id,c.clinic_id,dt) ON CONFLICT(appointment_id) DO NOTHING;
  UPDATE public.clinic_appointments SET started_at=dt WHERE appointment_id=bid;
  newstate:='in_consultation';
 ELSIF act='no_show' THEN
  IF c.lifecycle<>'confirmed' OR reason IS NULL OR NOT c.policy_snapshot ? 'no_show_after_minutes' OR (c.policy_snapshot->>'no_show_after_minutes') !~ '^[0-9]{1,5}$' OR clock_timestamp()<a.end_time+make_interval(mins=>(c.policy_snapshot->>'no_show_after_minutes')::integer) THEN RAISE EXCEPTION 'No-show requires an explicit approved clinic policy and elapsed attendance window' USING ERRCODE='55000'; END IF;
  newstate:='no_show';
 ELSE
  SELECT * INTO e FROM public.clinic_encounters WHERE appointment_id=bid FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Linked clinic encounter required' USING ERRCODE='55000'; END IF;
  IF act='amend' THEN
   IF c.lifecycle NOT IN ('completed','interrupted') OR reason IS NULL THEN RAISE EXCEPTION 'Amendment requires a finalised visit and reason' USING ERRCODE='55000'; END IF;
  ELSE
   IF c.lifecycle<>'in_consultation' THEN RAISE EXCEPTION 'An active clinic encounter is required' USING ERRCODE='55000'; END IF;
   IF (p_input->>'draft_version')::integer IS DISTINCT FROM e.draft_version THEN RAISE EXCEPTION 'Clinical draft changed; review the saved version before retrying' USING ERRCODE='PT409'; END IF;
  END IF;
  content:=p_input->'content'; PERFORM private.cc_validate_content(content,c.policy_snapshot,act<>'save_draft');
  IF act='save_draft' THEN
   UPDATE public.clinic_encounters SET draft=content,draft_version=draft_version+1 WHERE id=e.id;
  ELSE
   IF p_input->'release_confirmed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Review and confirm the clinical record release' USING ERRCODE='22023'; END IF;
   IF act='interrupt' AND (reason IS NULL OR NOT COALESCE((c.policy_snapshot->>'interrupt_allowed')::boolean,false)) THEN RAISE EXCEPTION 'Interrupted care requires approved policy and a clinician reason' USING ERRCODE='55000'; END IF;
   SELECT jsonb_build_object('id',p.id,'name',p.full_name,'qualification',cp.qualification,'registration_number',cp.council_registration_number,'council_name',cp.council_name) INTO clinician FROM public.profiles p JOIN public.care_physician_profiles cp ON cp.user_id=p.id WHERE p.id=u;
   h:=jsonb_build_object('id',c.clinic_id,'name',c.offering_snapshot->>'clinic_name','area',c.offering_snapshot->>'clinic_area','timezone',a.provider_timezone);
   SELECT * INTO prev FROM public.clinic_released_records WHERE encounter_id=e.id ORDER BY version DESC LIMIT 1;
   INSERT INTO public.clinic_released_records(encounter_id,appointment_id,finalised_by,version,status,content,clinician,clinic,amendment_reason,previous_version_id)
   VALUES(e.id,bid,u,COALESCE(prev.version,0)+1,CASE WHEN act='amend' THEN 'amended' WHEN act='interrupt' THEN 'interrupted' ELSE 'finalised' END,content,clinician,h,reason,prev.id) RETURNING id INTO record_id;
   IF act<>'amend' THEN
    UPDATE public.clinic_encounters SET draft=content,draft_version=draft_version+1,finalised_at=clock_timestamp() WHERE id=e.id;
    UPDATE public.clinic_appointments SET ended_at=clock_timestamp(),completed_at=CASE WHEN act='complete' THEN clock_timestamp() ELSE NULL END WHERE appointment_id=bid;
    newstate:=CASE WHEN act='interrupt' THEN 'interrupted' ELSE 'completed' END;
   END IF;
  END IF;
 END IF;
 UPDATE public.clinic_appointments SET lifecycle=newstate,version=nextversion WHERE appointment_id=bid RETURNING * INTO c;
 UPDATE public.doctor_appointments SET status=private.cc_status(c.lifecycle),start_time=c.scheduled_start,end_time=c.scheduled_end,completed_at=CASE WHEN c.lifecycle='completed' THEN c.completed_at ELSE NULL END,updated_at=clock_timestamp() WHERE id=bid AND (status IS DISTINCT FROM private.cc_status(c.lifecycle) OR start_time IS DISTINCT FROM c.scheduled_start OR end_time IS DISTINCT FROM c.scheduled_end OR completed_at IS DISTINCT FROM (CASE WHEN c.lifecycle='completed' THEN c.completed_at ELSE NULL END));
 PERFORM private.cc_event(bid,u,act,nextversion,reason);
 INSERT INTO public.clinic_action_replays(actor_id,idempotency_key,appointment_id,action,payload_hash) VALUES(u,key,bid,act,hash);
 RETURN private.cc_visit(bid,u);
END $$;

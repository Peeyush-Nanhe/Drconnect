-- Additive correction of the unverified home-visit implementation. Existing
-- migration history is retained. Real-patient booking remains disabled.
-- Scheduling keeps doctor_appointments as its sole canonical booking identity.
CREATE TABLE public.home_visit_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  real_patients_enabled boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT 'home-visit-v1-staging-proposal',
  pay_at_visit_enabled boolean NOT NULL DEFAULT false,
  notification_channel text NOT NULL DEFAULT 'disabled' CHECK(notification_channel IN ('disabled','push'))
);
INSERT INTO public.home_visit_policy(singleton) VALUES(true);
CREATE TABLE public.home_visit_pilot_participants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settlement_enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE public.home_visit_provider_settings (
  provider_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  coverage_pincodes text[] NOT NULL CHECK(cardinality(coverage_pincodes)>0),
  fee numeric(10,2) NOT NULL CHECK(fee>=0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 10 AND 240),
  buffer_before_minutes integer NOT NULL CHECK(buffer_before_minutes BETWEEN 1 AND 240),
  buffer_after_minutes integer NOT NULL CHECK(buffer_after_minutes BETWEEN 1 AND 240),
  lead_minutes integer NOT NULL CHECK(lead_minutes BETWEEN 0 AND 10080),
  horizon_days integer NOT NULL CHECK(horizon_days BETWEEN 1 AND 180),
  acceptance_minutes integer NOT NULL CHECK(acceptance_minutes BETWEEN 1 AND 1440),
  timezone text NOT NULL, version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_appointments
  ADD COLUMN doctor_arrived_at timestamptz,
  ADD COLUMN home_buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK(home_buffer_before_minutes>=0),
  ADD COLUMN home_buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK(home_buffer_after_minutes>=0);
CREATE TABLE public.home_visit_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES auth.users(id), routing text NOT NULL CHECK(routing IN ('named','pool')),
  is_now boolean NOT NULL, pincode text NOT NULL,
  start_time timestamptz NOT NULL, end_time timestamptz NOT NULL CHECK(end_time>start_time),
  fee numeric(10,2) NOT NULL CHECK(fee>=0), currency text NOT NULL,
  provider_timezone text NOT NULL, config jsonb NOT NULL, candidates jsonb NOT NULL,
  booking_id uuid REFERENCES public.doctor_appointments(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.home_visit_details (
  booking_id uuid PRIMARY KEY REFERENCES public.doctor_appointments(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.home_visit_quotes(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id), patient_id uuid NOT NULL REFERENCES auth.users(id),
  routing text NOT NULL CHECK(routing IN ('named','pool')), is_now boolean NOT NULL,
  accepted_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  pending_deadline timestamptz NOT NULL,
  idempotency_key text NOT NULL, payload_hash text NOT NULL,
  UNIQUE(actor_id,idempotency_key), UNIQUE(quote_id)
);
CREATE TABLE public.home_visit_consents (
  booking_id uuid PRIMARY KEY REFERENCES public.doctor_appointments(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id), patient_id uuid NOT NULL REFERENCES auth.users(id),
  version text NOT NULL, scope text NOT NULL CHECK(scope='home_visit_and_visit_record'),
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.home_visit_offers (
  booking_id uuid NOT NULL REFERENCES public.doctor_appointments(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES auth.users(id), declined_at timestamptz,
  decline_reason text, PRIMARY KEY(booking_id,provider_id)
);
CREATE TABLE public.home_visit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.doctor_appointments(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id), kind text NOT NULL, reason text,
  version integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.home_visit_arrival_secrets (
  booking_id uuid PRIMARY KEY REFERENCES public.doctor_appointments(id) ON DELETE CASCADE,
  salt uuid NOT NULL DEFAULT gen_random_uuid(), code_hash bytea,
  expires_at timestamptz, issued_at timestamptz, consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  issue_count integer NOT NULL DEFAULT 0 CHECK(issue_count BETWEEN 0 AND 10)
);
CREATE TABLE public.home_visit_encounters (
  booking_id uuid PRIMARY KEY REFERENCES public.doctor_appointments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id), summary text CHECK(summary IS NULL OR length(trim(summary))>0),
  follow_up text, started_at timestamptz NOT NULL DEFAULT now(), signed_at timestamptz,
  amendments jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE public.home_visit_settlements (
  booking_id uuid PRIMARY KEY REFERENCES public.doctor_appointments(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id), method text NOT NULL CHECK(method='cash'),
  amount numeric(10,2) NOT NULL CHECK(amount>=0), currency text NOT NULL,
  reference text, recorded_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'recorded_pay_at_visit' CHECK(status='recorded_pay_at_visit')
);
CREATE TABLE public.home_visit_reschedule_holds (
  booking_id uuid PRIMARY KEY REFERENCES public.doctor_appointments(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.home_visit_quotes(id),
  provider_id uuid NOT NULL REFERENCES auth.users(id), requested_by uuid NOT NULL REFERENCES auth.users(id),
  start_time timestamptz NOT NULL,end_time timestamptz NOT NULL CHECK(end_time>start_time),
  buffer_before_minutes integer NOT NULL, buffer_after_minutes integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE public.home_visit_operations_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE public.home_visit_notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.doctor_appointments(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.home_visit_events(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id), channel text NOT NULL,
  status text NOT NULL CHECK(status IN ('pending','processing','sent','failed','disabled')),
  attempts integer NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,lease_token uuid,sent_at timestamptz,last_error text,
  dedupe_key text NOT NULL UNIQUE
);
CREATE INDEX home_visit_details_pending_idx ON public.home_visit_details(pending_deadline);
CREATE INDEX home_visit_quotes_actor_idx ON public.home_visit_quotes(actor_id,created_at);
CREATE INDEX home_visit_offers_provider_idx ON public.home_visit_offers(provider_id,booking_id);
CREATE INDEX home_visit_events_booking_idx ON public.home_visit_events(booking_id,created_at);
CREATE INDEX home_visit_holds_provider_idx ON public.home_visit_reschedule_holds(provider_id,expires_at);
CREATE INDEX home_visit_jobs_due_idx ON public.home_visit_notification_jobs(status,available_at);
CREATE INDEX doctor_appointments_provider_time_idx ON public.doctor_appointments(provider_id,start_time,end_time);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['home_visit_policy','home_visit_pilot_participants','home_visit_provider_settings','home_visit_quotes','home_visit_details','home_visit_consents','home_visit_offers','home_visit_events','home_visit_arrival_secrets','home_visit_encounters','home_visit_settlements','home_visit_reschedule_holds','home_visit_operations_members','home_visit_notification_jobs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;
-- Remove broad disclosure. Named doctors see full details only after acceptance.
DROP POLICY IF EXISTS "Providers can read open pending home visits" ON public.doctor_appointments;
DROP POLICY IF EXISTS "Doctors can read assigned appointments" ON public.doctor_appointments;
CREATE POLICY "Doctors can read assigned appointments" ON public.doctor_appointments FOR SELECT TO authenticated
  USING(auth.uid()=provider_id AND (mode<>'home_visit' OR home_visit_status IN ('confirmed','en_route','arrived','in_consultation','completed')));
-- Legacy OTP fields are never used by the replacement flow.
UPDATE public.doctor_appointments SET arrival_otp=NULL WHERE mode='home_visit';
REVOKE ALL ON FUNCTION public.create_home_visit_booking(boolean,uuid,text,numeric,jsonb,text,timestamptz,timestamptz,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.accept_home_visit_booking(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.start_doctor_travel(uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.verify_home_visit_arrival(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_home_visit_encounter(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.hv_enabled(p_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_uid IS NOT NULL AND (EXISTS(SELECT 1 FROM public.home_visit_policy WHERE real_patients_enabled)
 OR EXISTS(SELECT 1 FROM public.home_visit_pilot_participants p JOIN auth.users u ON u.id=p.user_id
 WHERE p.user_id=p_uid AND (u.email LIKE '%@example.invalid' OR u.email LIKE '%@homevisit-test.invalid')))
$$;
CREATE FUNCTION private.hv_doctor(p_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.hv_enabled(p_uid) AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_uid AND role='provider')
 AND EXISTS(SELECT 1 FROM public.account_role_requests WHERE user_id=p_uid AND status='approved' AND requested_role='provider' AND requested_view IN ('doctor','medico','care_physician'))
 AND EXISTS(SELECT 1 FROM public.care_physician_profiles WHERE user_id=p_uid AND registration_verified)
$$;
CREATE FUNCTION private.hv_actor() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to use home visits'; END IF;
 IF NOT private.hv_enabled(auth.uid()) THEN RAISE EXCEPTION 'Home visits are disabled pending approved pilot policies'; END IF;
 RETURN auth.uid();
END $$;
CREATE FUNCTION private.hv_cash_allowed(p_actor uuid,p_provider uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.home_visit_policy WHERE pay_at_visit_enabled)
 OR (EXISTS(SELECT 1 FROM public.home_visit_pilot_participants WHERE user_id=p_actor AND settlement_enabled)
 AND EXISTS(SELECT 1 FROM public.home_visit_pilot_participants WHERE user_id=p_provider AND settlement_enabled)
 AND private.hv_enabled(p_actor) AND private.hv_enabled(p_provider))
$$;
CREATE FUNCTION public.hv_context() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('enabled',private.hv_enabled(auth.uid()),'participant',private.hv_enabled(auth.uid()),
 'consent_version',p.consent_version,'consent_text','Synthetic staging proposal: I request this test home visit and consent to its visit record being shared with me and the assigned doctor.',
 'terms','Synthetic staging only. Coverage, travel buffers, acceptance and cancellation settings require owner approval before real-patient use.',
 'pay_at_visit_enabled',p.pay_at_visit_enabled OR EXISTS(SELECT 1 FROM public.home_visit_pilot_participants WHERE user_id=auth.uid() AND settlement_enabled),
 'online_payment_enabled',false,'dependent_booking_enabled',false,'notification_channel',p.notification_channel,
 'reason','Real-patient use requires approved consent, operational policies and device acceptance testing.') FROM public.home_visit_policy p
$$;
CREATE FUNCTION public.hv_provider_settings() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=private.hv_actor(); r jsonb; BEGIN
 IF NOT private.hv_doctor(u) THEN RAISE EXCEPTION 'Approved and registration-verified doctor required'; END IF;
 SELECT to_jsonb(s) INTO r FROM public.home_visit_provider_settings s WHERE provider_id=u; RETURN r;
END $$;
CREATE FUNCTION public.hv_save_provider_settings(p_settings jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=private.hv_actor(); codes text[]; BEGIN
 IF NOT private.hv_doctor(u) THEN RAISE EXCEPTION 'Approved and registration-verified doctor required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_settings->>'timezone') THEN RAISE EXCEPTION 'Valid provider IANA timezone required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.provider_availability WHERE user_id=u AND timezone=p_settings->>'timezone' AND working_hours<>'{}'::jsonb) THEN RAISE EXCEPTION 'Publish matching timezone and working hours before home availability'; END IF;
 SELECT array_agg(value) INTO codes FROM jsonb_array_elements_text(p_settings->'coverage_pincodes');
 IF codes IS NULL OR EXISTS(SELECT 1 FROM unnest(codes) c WHERE c !~ '^[0-9]{6}$') THEN RAISE EXCEPTION 'Configured six-digit pincodes required'; END IF;
 INSERT INTO public.home_visit_provider_settings(provider_id,enabled,coverage_pincodes,fee,currency,duration_minutes,buffer_before_minutes,buffer_after_minutes,lead_minutes,horizon_days,acceptance_minutes,timezone)
 VALUES(u,(p_settings->>'enabled')::boolean,codes,(p_settings->>'fee')::numeric,p_settings->>'currency',(p_settings->>'duration_minutes')::integer,(p_settings->>'buffer_before_minutes')::integer,(p_settings->>'buffer_after_minutes')::integer,(p_settings->>'lead_minutes')::integer,(p_settings->>'horizon_days')::integer,(p_settings->>'acceptance_minutes')::integer,p_settings->>'timezone')
 ON CONFLICT(provider_id) DO UPDATE SET enabled=EXCLUDED.enabled,coverage_pincodes=EXCLUDED.coverage_pincodes,fee=EXCLUDED.fee,currency=EXCLUDED.currency,duration_minutes=EXCLUDED.duration_minutes,buffer_before_minutes=EXCLUDED.buffer_before_minutes,buffer_after_minutes=EXCLUDED.buffer_after_minutes,lead_minutes=EXCLUDED.lead_minutes,horizon_days=EXCLUDED.horizon_days,acceptance_minutes=EXCLUDED.acceptance_minutes,timezone=EXCLUDED.timezone,version=public.home_visit_provider_settings.version+1,updated_at=now();
 RETURN public.hv_provider_settings();
END $$;
-- Validate the complete occupied interval against configured local hours, leave,
-- DND and service toggles. Immediate online is deliberately separate from Later.
CREATE FUNCTION private.hv_time_valid(p_provider uuid,p_start timestamptz,p_end timestamptz,p_now boolean) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.home_visit_provider_settings; a public.provider_availability; t timestamptz; local_start timestamp; local_end timestamp; hours jsonb; win jsonb; inside boolean:=false; BEGIN
 SELECT * INTO s FROM public.home_visit_provider_settings WHERE provider_id=p_provider;
 SELECT * INTO a FROM public.provider_availability WHERE user_id=p_provider;
 IF s.provider_id IS NULL OR a.user_id IS NULL OR a.timezone<>s.timezone OR NOT s.enabled OR NOT private.hv_doctor(p_provider) OR p_start>=p_end THEN RETURN false; END IF;
 IF p_now AND NOT a.is_online THEN RETURN false; END IF;
 IF COALESCE(a.service_online->>'home_visit','true')='false' THEN RETURN false; END IF;
 local_start:=(p_start-make_interval(mins=>s.buffer_before_minutes)) AT TIME ZONE s.timezone;
 local_end:=(p_end+make_interval(mins=>s.buffer_after_minutes)) AT TIME ZONE s.timezone;
 IF local_start::date<>local_end::date OR local_start::date=ANY(a.blocked_dates) THEN RETURN false; END IF;
 hours:=a.working_hours->lower(to_char(local_start,'dy'));
 IF hours IS NULL OR jsonb_typeof(hours)<>'array' THEN RETURN false; END IF;
 FOR win IN SELECT * FROM jsonb_array_elements(hours) LOOP
  IF local_start::time>=(win->>'start')::time AND local_end::time<=(win->>'end')::time THEN inside:=true; EXIT; END IF;
 END LOOP;
 IF NOT inside THEN RETURN false; END IF;
 -- Minute sampling also covers DND windows in the middle, not only endpoints.
 FOR t IN SELECT generate_series(p_start-make_interval(mins=>s.buffer_before_minutes),p_end+make_interval(mins=>s.buffer_after_minutes),interval '1 minute') LOOP
  IF public.is_provider_in_dnd(p_provider,t) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
-- All appointment/assignment writers acquire this same per-provider transaction
-- lock before checking occupancy. No public occupancy helper is exposed as RPC.
CREATE FUNCTION private.hv_lock(p_provider uuid) RETURNS void LANGUAGE sql VOLATILE SET search_path='' AS $$
 SELECT pg_advisory_xact_lock(hashtextextended(p_provider::text,749183))
$$;
CREATE FUNCTION private.hv_busy(p_provider uuid,p_start timestamptz,p_end timestamptz,p_exclude uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
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
$$;
CREATE OR REPLACE FUNCTION public.check_appointment_overlap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.provider_id IS NULL OR NEW.status NOT IN ('pending','confirmed','rescheduled') THEN RETURN NEW; END IF;
 IF NEW.end_time<=NEW.start_time THEN RAISE EXCEPTION 'Appointment end must follow its start'; END IF;
 PERFORM private.hv_lock(NEW.provider_id);
 IF private.hv_busy(NEW.provider_id,NEW.start_time-make_interval(mins=>NEW.home_buffer_before_minutes),NEW.end_time+make_interval(mins=>NEW.home_buffer_after_minutes),NEW.id) THEN RAISE EXCEPTION 'Provider capacity conflict with an existing reservation or assignment'; END IF;
 RETURN NEW;
END $$;
-- Guard the reverse direction without changing unrelated service lifecycle rules.
CREATE FUNCTION private.hv_assignment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
CREATE TRIGGER home_visit_care_capacity BEFORE INSERT OR UPDATE ON public.care_requests FOR EACH ROW EXECUTE FUNCTION private.hv_assignment_guard();
CREATE TRIGGER home_visit_staffing_capacity BEFORE INSERT OR UPDATE ON public.staffing_assignments FOR EACH ROW EXECUTE FUNCTION private.hv_assignment_guard();
CREATE TRIGGER home_visit_surgery_capacity BEFORE INSERT OR UPDATE ON public.surgery_booking_roles FOR EACH ROW EXECUTE FUNCTION private.hv_assignment_guard();
CREATE TRIGGER home_visit_physio_capacity BEFORE INSERT OR UPDATE ON public.physio_visits FOR EACH ROW EXECUTE FUNCTION private.hv_assignment_guard();
CREATE FUNCTION public.hv_discover(p_query jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=private.hv_actor(); s public.home_visit_provider_settings; r jsonb:='[]'; slots jsonb; t timestamptz; e timestamptz; day date; immediate boolean:=COALESCE((p_query->>'is_now')::boolean,false); BEGIN
 IF COALESCE(p_query->>'pincode','') !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'A supported pincode is required'; END IF;
 FOR s IN SELECT * FROM public.home_visit_provider_settings WHERE enabled AND p_query->>'pincode'=ANY(coverage_pincodes) AND (NULLIF(p_query->>'provider_id','') IS NULL OR provider_id=(p_query->>'provider_id')::uuid) ORDER BY provider_id LOOP
  IF NOT private.hv_doctor(s.provider_id) THEN CONTINUE; END IF;
  slots:='[]';
  IF immediate THEN
   t:=now();e:=t+make_interval(mins=>s.duration_minutes);
   IF NOT private.hv_time_valid(s.provider_id,t,e,true) OR private.hv_busy(s.provider_id,t-make_interval(mins=>s.buffer_before_minutes),e+make_interval(mins=>s.buffer_after_minutes)) THEN CONTINUE; END IF;
  ELSE
   day:=COALESCE(NULLIF(p_query->>'date','')::date,(now() AT TIME ZONE s.timezone)::date+1);
   IF day>(now() AT TIME ZONE s.timezone)::date+s.horizon_days OR day<(now() AT TIME ZONE s.timezone)::date THEN CONTINUE; END IF;
   FOR t IN SELECT generate_series(day::timestamp AT TIME ZONE s.timezone,((day+1)::timestamp AT TIME ZONE s.timezone)-interval '1 minute',make_interval(mins=>s.duration_minutes)) LOOP
    e:=t+make_interval(mins=>s.duration_minutes);
    IF t>now()+make_interval(mins=>s.lead_minutes) AND private.hv_time_valid(s.provider_id,t,e,false) AND NOT private.hv_busy(s.provider_id,t-make_interval(mins=>s.buffer_before_minutes),e+make_interval(mins=>s.buffer_after_minutes)) THEN slots:=slots||jsonb_build_array(jsonb_build_object('start_time',t,'end_time',e)); END IF;
   END LOOP;
   IF jsonb_array_length(slots)=0 THEN CONTINUE; END IF;
  END IF;
  r:=r||jsonb_build_array((to_jsonb(s)-'coverage_pincodes')||jsonb_build_object('name',(SELECT full_name FROM public.profiles WHERE id=s.provider_id),'slots',slots));
 END LOOP; RETURN r;
END $$;
CREATE FUNCTION public.hv_quote(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=private.hv_actor(); s public.home_visit_provider_settings; first_s public.home_visit_provider_settings; q public.home_visit_quotes; candidates jsonb:='{}'; routing text:=COALESCE(p_input->>'routing','named'); immediate boolean:=COALESCE((p_input->>'is_now')::boolean,false); t timestamptz; e timestamptz; bid uuid:=NULLIF(p_input->>'booking_id','')::uuid; existing public.doctor_appointments; BEGIN
 IF routing NOT IN ('named','pool') OR (NOT immediate AND routing='pool') THEN RAISE EXCEPTION 'Later booking requires a named doctor'; END IF;
 IF COALESCE(p_input->>'pincode','') !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'A supported pincode is required'; END IF;
 IF routing='named' AND NULLIF(p_input->>'provider_id','') IS NULL THEN RAISE EXCEPTION 'Choose the named doctor'; END IF;
 IF bid IS NOT NULL THEN
  SELECT * INTO existing FROM public.doctor_appointments WHERE id=bid;
  IF existing.id IS NULL OR existing.patient_id<>u OR existing.mode<>'home_visit' OR existing.home_visit_status<>'confirmed' THEN RAISE EXCEPTION 'Only the booking patient can quote rescheduling of a confirmed home visit'; END IF;
  IF immediate OR routing<>'named' OR existing.provider_id IS DISTINCT FROM (p_input->>'provider_id')::uuid OR existing.address_snapshot->>'pincode' IS DISTINCT FROM p_input->>'pincode' THEN RAISE EXCEPTION 'Rescheduling must retain the accepted doctor and address'; END IF;
 END IF;
 FOR s IN SELECT * FROM public.home_visit_provider_settings WHERE enabled AND p_input->>'pincode'=ANY(coverage_pincodes) AND (routing='pool' OR provider_id=(p_input->>'provider_id')::uuid) ORDER BY provider_id LOOP
  IF NOT private.hv_doctor(s.provider_id) THEN CONTINUE; END IF;
  t:=CASE WHEN immediate THEN now() ELSE NULLIF(p_input->>'start_time','')::timestamptz END;
  e:=t+make_interval(mins=>s.duration_minutes);
  IF t IS NULL OR (NOT immediate AND (t<=now()+make_interval(mins=>s.lead_minutes) OR t>now()+make_interval(days=>s.horizon_days))) OR NOT private.hv_time_valid(s.provider_id,t,e,immediate) OR private.hv_busy(s.provider_id,t-make_interval(mins=>s.buffer_before_minutes),e+make_interval(mins=>s.buffer_after_minutes),bid) THEN CONTINUE; END IF;
  IF first_s.provider_id IS NULL THEN first_s:=s; END IF;
  -- A pool offer is restricted to the exact fee and service duration reviewed.
  IF s.fee=first_s.fee AND s.currency=first_s.currency AND s.duration_minutes=first_s.duration_minutes THEN candidates:=candidates||jsonb_build_object(s.provider_id::text,to_jsonb(s)); END IF;
 END LOOP;
 IF first_s.provider_id IS NULL THEN RAISE EXCEPTION 'No eligible doctor capacity for this address and time'; END IF;
 t:=CASE WHEN immediate THEN now() ELSE (p_input->>'start_time')::timestamptz END;e:=t+make_interval(mins=>first_s.duration_minutes);
 INSERT INTO public.home_visit_quotes(actor_id,provider_id,routing,is_now,pincode,start_time,end_time,fee,currency,provider_timezone,config,candidates,booking_id,expires_at)
 VALUES(u,CASE WHEN routing='named' THEN first_s.provider_id ELSE NULL END,routing,immediate,p_input->>'pincode',t,e,first_s.fee,first_s.currency,first_s.timezone,to_jsonb(first_s),candidates,bid,now()+interval '5 minutes') RETURNING * INTO q;
 RETURN (to_jsonb(q)-'actor_id'-'candidates'-'config')||jsonb_build_object('quote_id',q.id,'total',q.fee,'breakdown',jsonb_build_array(jsonb_build_object('label','Doctor consultation','amount',q.fee)),'payment_method',CASE WHEN private.hv_cash_allowed(u,first_s.provider_id) THEN 'recorded_cash_at_visit' ELSE 'settlement_not_enabled' END,'candidate_count',(SELECT count(*) FROM jsonb_object_keys(candidates)));
END $$;
CREATE FUNCTION private.hv_event(p_booking uuid,p_kind text,p_reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE eid uuid; v integer; recipient uuid; channel text; BEGIN
 SELECT version INTO v FROM public.home_visit_details WHERE booking_id=p_booking;
 INSERT INTO public.home_visit_events(booking_id,actor_id,kind,reason,version) VALUES(p_booking,auth.uid(),p_kind,left(p_reason,500),v) RETURNING id INTO eid;
 SELECT notification_channel INTO channel FROM public.home_visit_policy;
 FOR recipient IN SELECT actor_id FROM public.home_visit_details WHERE booking_id=p_booking UNION SELECT provider_id FROM public.doctor_appointments WHERE id=p_booking AND provider_id IS NOT NULL UNION SELECT provider_id FROM public.home_visit_offers WHERE booking_id=p_booking AND p_kind IN ('requested','accept','expired','cancel','decline') AND NOT EXISTS(SELECT 1 FROM public.home_visit_details WHERE booking_id=p_booking AND accepted_at IS NOT NULL AND p_kind<>'accept') LOOP
  INSERT INTO public.home_visit_notification_jobs(booking_id,event_id,recipient_id,channel,status,dedupe_key)
  VALUES(p_booking,eid,recipient,channel,CASE WHEN channel='disabled' THEN 'disabled' ELSE 'pending' END,eid::text||':'||recipient::text) ON CONFLICT(dedupe_key) DO NOTHING;
 END LOOP;
END $$;
CREATE FUNCTION private.hv_view(p_booking uuid,p_uid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.doctor_appointments; d public.home_visit_details; result jsonb; actions jsonb:='[]'; owner boolean; assigned boolean; offer boolean; BEGIN
 SELECT * INTO a FROM public.doctor_appointments WHERE id=p_booking AND mode='home_visit';
 SELECT * INTO d FROM public.home_visit_details WHERE booking_id=p_booking;
 IF a.id IS NULL OR d.booking_id IS NULL THEN RAISE EXCEPTION 'Home visit not found'; END IF;
 owner:=p_uid=d.actor_id OR p_uid=d.patient_id; assigned:=p_uid=a.provider_id AND d.accepted_at IS NOT NULL;
 offer:=a.home_visit_status='pending' AND d.pending_deadline>now() AND private.hv_doctor(p_uid) AND EXISTS(SELECT 1 FROM public.home_visit_offers WHERE booking_id=a.id AND provider_id=p_uid AND declined_at IS NULL);
 IF NOT COALESCE(owner,false) AND NOT COALESCE(assigned,false) AND NOT COALESCE(offer,false) THEN RAISE EXCEPTION 'Home visit access denied'; END IF;
 result:=jsonb_build_object('id',a.id,'booking_id',a.id,'status',a.status,'home_visit_status',a.home_visit_status,'version',d.version,'provider_id',a.provider_id,'provider_name',(SELECT full_name FROM public.profiles WHERE id=a.provider_id),'is_now',d.is_now,'routing',d.routing,'fee',a.fee,'total',a.fee,'currency',a.currency,'provider_timezone',a.provider_timezone,'start_time',a.start_time,'end_time',a.end_time,'pending_deadline',d.pending_deadline);
 IF owner OR assigned THEN
  result:=result||jsonb_build_object('patient_id',d.patient_id,'actor_id',d.actor_id,'address_snapshot',a.address_snapshot,'consent_version',a.consent_version,'eta_minutes',a.eta_minutes,'eta_updated_at',a.en_route_at,'en_route_at',a.en_route_at,'doctor_arrived_at',a.doctor_arrived_at,'arrived_at',a.arrived_at,'completed_at',a.completed_at,'clinical_notes',(SELECT to_jsonb(e)-'booking_id' FROM public.home_visit_encounters e WHERE booking_id=a.id),'payment_settlement',(SELECT to_jsonb(s)-'booking_id' FROM public.home_visit_settlements s WHERE booking_id=a.id),'reschedule',(SELECT to_jsonb(h)-'requested_by' FROM public.home_visit_reschedule_holds h WHERE booking_id=a.id AND expires_at>now()),'quote',jsonb_build_object('total',a.fee,'currency',a.currency),'events',COALESCE((SELECT jsonb_agg(jsonb_build_object('kind',kind,'reason',reason,'created_at',created_at,'version',version) ORDER BY created_at) FROM public.home_visit_events WHERE booking_id=a.id),'[]'::jsonb));
 ELSE result:=result||jsonb_build_object('address_snapshot',jsonb_build_object('pincode',a.address_snapshot->>'pincode','locality',a.address_snapshot->>'locality')); END IF;
 IF owner AND a.home_visit_status IN ('pending','confirmed','en_route') THEN actions:=actions||'["cancel"]'::jsonb; END IF;
 IF owner AND a.home_visit_status='confirmed' THEN actions:=actions||'["request_reschedule"]'::jsonb; END IF;
 IF owner AND a.home_visit_status IN ('en_route','arrived') THEN actions:=actions||'["arrival_code"]'::jsonb; END IF;
 IF offer THEN actions:=actions||'["accept","decline"]'::jsonb; END IF;
 IF assigned AND a.home_visit_status='confirmed' THEN actions:=actions||'["start_travel","cancel"]'::jsonb; END IF;
 IF assigned AND a.home_visit_status='en_route' THEN actions:=actions||'["report_arrival","verify_arrival","cancel"]'::jsonb; END IF;
 IF assigned AND a.home_visit_status='arrived' THEN
  IF EXISTS(SELECT 1 FROM public.home_visit_arrival_secrets WHERE booking_id=a.id AND consumed_at IS NOT NULL) THEN actions:=actions||'["start_consultation"]'::jsonb; ELSE actions:=actions||'["verify_arrival"]'::jsonb; END IF;
 END IF;
 IF assigned AND a.home_visit_status='in_consultation' THEN actions:=actions||'["save_encounter","complete"]'::jsonb; END IF;
 IF assigned AND EXISTS(SELECT 1 FROM public.home_visit_encounters WHERE booking_id=a.id AND signed_at IS NOT NULL) THEN actions:=actions||'["amend_encounter"]'::jsonb; END IF;
 IF assigned AND a.home_visit_status='completed' AND private.hv_cash_allowed(d.actor_id,a.provider_id) AND NOT EXISTS(SELECT 1 FROM public.home_visit_settlements WHERE booking_id=a.id) THEN actions:=actions||'["record_settlement"]'::jsonb; END IF;
 IF assigned AND a.home_visit_status='confirmed' AND EXISTS(SELECT 1 FROM public.home_visit_reschedule_holds WHERE booking_id=a.id AND expires_at>now()) THEN actions:=actions||'["accept_reschedule","decline_reschedule"]'::jsonb; END IF;
 IF (owner OR assigned) AND a.home_visit_status IN ('confirmed','en_route','arrived','in_consultation','completed','cancelled') THEN actions:=actions||'["dispute"]'::jsonb; END IF;
 IF owner OR assigned THEN result:=result||jsonb_build_object('disputes',COALESCE((SELECT jsonb_agg(to_jsonb(dis)-'booking_id') FROM public.home_visit_disputes dis WHERE booking_id=a.id),'[]'::jsonb),'disputed',EXISTS(SELECT 1 FROM public.home_visit_disputes WHERE booking_id=a.id AND status='open')); END IF;
 RETURN result||jsonb_build_object('allowed_actions',actions);
END $$;
CREATE FUNCTION public.hv_create(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=private.hv_actor(); q public.home_visit_quotes; s public.home_visit_provider_settings; a jsonb:=p_input->'address'; idem_key text:=p_input->>'idempotency_key'; hash text; prior public.home_visit_details; bid uuid; deadline timestamptz; c record; BEGIN
 IF NOT public.has_role(u,'patient') THEN RAISE EXCEPTION 'Patient account required'; END IF;
 IF p_input ?| ARRAY['fee','currency','amount','provider_id','status','home_visit_status','paid_at'] THEN RAISE EXCEPTION 'Client fee, provider and status overrides are unsupported; review the server quote'; END IF;
 IF idem_key IS NULL OR length(idem_key)<16 OR length(idem_key)>128 THEN RAISE EXCEPTION 'Opaque idempotency key required'; END IF;
 hash:=encode(sha256(convert_to((p_input-'idempotency_key')::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':'||idem_key,749184));
 SELECT * INTO prior FROM public.home_visit_details WHERE actor_id=u AND idempotency_key=idem_key;
 IF prior.booking_id IS NOT NULL THEN IF prior.payload_hash<>hash THEN RAISE EXCEPTION 'Idempotency key was already used with a different payload'; END IF; RETURN private.hv_view(prior.booking_id,u); END IF;
 IF NULLIF(p_input->>'patient_id','') IS NOT NULL AND (p_input->>'patient_id')::uuid<>u THEN RAISE EXCEPTION 'Patient identity must be the authenticated booking actor'; END IF;
 IF p_input ? 'document_ids' OR p_input ? 'documents' OR p_input ? 'document_references' OR a ? 'document_ids' THEN RAISE EXCEPTION 'Document references are disabled until authorised private access is approved'; END IF;
 IF NULLIF(p_input->>'dependent_id','') IS NOT NULL THEN RAISE EXCEPTION 'Dependent booking is disabled until backend delegation is approved'; END IF;
 IF COALESCE((p_input->>'consent')::boolean,false) IS NOT TRUE OR p_input->>'consent_version' IS DISTINCT FROM (SELECT consent_version FROM public.home_visit_policy) THEN RAISE EXCEPTION 'Current home-visit consent is required'; END IF;
 IF length(trim(COALESCE(a->>'full_address','')))<10 OR length(a->>'full_address')>1000 OR length(trim(COALESCE(a->>'locality','')))<2 OR COALESCE(a->>'pincode','') !~ '^[0-9]{6}$' OR COALESCE(a->>'phone','') !~ '^\+?[0-9 ()-]{7,20}$' OR length(trim(COALESCE(a->>'reason','')))<3 OR length(a->>'reason')>2000 THEN RAISE EXCEPTION 'Complete address, locality, pincode, contact and visit reason required'; END IF;
 SELECT * INTO q FROM public.home_visit_quotes WHERE id=(p_input->>'quote_id')::uuid AND actor_id=u FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.home_visit_details WHERE quote_id=q.id) THEN RAISE EXCEPTION 'Quote already saved; recover the original booking'; END IF;
 IF q.id IS NULL OR q.booking_id IS NOT NULL OR q.expires_at<=now() OR a->>'pincode' IS DISTINCT FROM q.pincode THEN RAISE EXCEPTION 'Quote expired or address changed; review availability and quote again'; END IF;
 IF NOT q.is_now AND q.start_time<=now()+make_interval(mins=>(q.config->>'lead_minutes')::integer) THEN RAISE EXCEPTION 'Appointment must respect the configured future lead time'; END IF;
 FOR c IN SELECT key,value FROM jsonb_each(q.candidates) LOOP
  SELECT * INTO s FROM public.home_visit_provider_settings WHERE provider_id=c.key::uuid;
  IF s.version IS DISTINCT FROM (c.value->>'version')::integer OR NOT private.hv_doctor(s.provider_id) OR NOT(q.pincode=ANY(s.coverage_pincodes)) OR NOT private.hv_time_valid(s.provider_id,q.start_time,q.end_time,q.is_now) THEN RAISE EXCEPTION 'Doctor availability or quote changed; review again'; END IF;
 END LOOP;
 IF q.provider_id IS NOT NULL THEN PERFORM private.hv_lock(q.provider_id); END IF;
 deadline:=now()+make_interval(mins=>(q.config->>'acceptance_minutes')::integer);
 IF NOT q.is_now THEN deadline:=least(deadline,q.start_time-make_interval(mins=>(q.config->>'buffer_before_minutes')::integer)); END IF;
 IF deadline<=now() THEN RAISE EXCEPTION 'Acceptance interval is no longer available'; END IF;
 INSERT INTO public.doctor_appointments(patient_id,provider_id,service,mode,location,start_time,end_time,fee,currency,status,home_visit_status,address_snapshot,consent_version,consent_timestamp,provider_timezone,home_buffer_before_minutes,home_buffer_after_minutes)
 VALUES(u,q.provider_id,'Doctor Home Visit','home_visit',a->>'full_address',q.start_time,q.end_time,q.fee,q.currency,'pending','pending',jsonb_build_object('full_address',a->>'full_address','locality',a->>'locality','pincode',a->>'pincode','phone',a->>'phone','landmark',a->>'landmark','reason',a->>'reason'),p_input->>'consent_version',now(),q.provider_timezone,(q.config->>'buffer_before_minutes')::integer,(q.config->>'buffer_after_minutes')::integer) RETURNING id INTO bid;
 INSERT INTO public.home_visit_details(booking_id,quote_id,actor_id,patient_id,routing,is_now,pending_deadline,idempotency_key,payload_hash) VALUES(bid,q.id,u,u,q.routing,q.is_now,deadline,idem_key,hash);
 INSERT INTO public.home_visit_consents(booking_id,actor_id,patient_id,version,scope) VALUES(bid,u,u,p_input->>'consent_version','home_visit_and_visit_record');
 INSERT INTO public.home_visit_offers(booking_id,provider_id) SELECT bid,key::uuid FROM jsonb_each(q.candidates);
 PERFORM private.hv_event(bid,'requested'); RETURN private.hv_view(bid,u);
END $$;
CREATE FUNCTION public.hv_recover(p_key text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=private.hv_actor(); bid uuid; BEGIN SELECT booking_id INTO bid FROM public.home_visit_details WHERE actor_id=u AND idempotency_key=p_key; IF bid IS NULL THEN RETURN NULL; END IF; RETURN private.hv_view(bid,u); END $$;
CREATE FUNCTION public.hv_list() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=private.hv_actor(); bid uuid; r jsonb:='[]'; BEGIN
 FOR bid IN SELECT a.id FROM public.doctor_appointments a JOIN public.home_visit_details d ON d.booking_id=a.id WHERE d.actor_id=u OR d.patient_id=u OR (a.provider_id=u AND d.accepted_at IS NOT NULL) OR (a.home_visit_status='pending' AND d.pending_deadline>now() AND private.hv_doctor(u) AND EXISTS(SELECT 1 FROM public.home_visit_offers o WHERE o.booking_id=a.id AND o.provider_id=u AND o.declined_at IS NULL)) ORDER BY a.created_at DESC LIMIT 200 LOOP r:=r||jsonb_build_array(private.hv_view(bid,u)); END LOOP; RETURN r;
END $$;
CREATE FUNCTION public.hv_action(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=private.hv_actor(); bid uuid:=(p_input->>'booking_id')::uuid; action text:=p_input->>'action'; a public.doctor_appointments; d public.home_visit_details; q public.home_visit_quotes; s public.home_visit_provider_settings; h public.home_visit_reschedule_holds; reason text:=NULLIF(trim(p_input->>'reason'),''); t timestamptz; e timestamptz; v integer; BEGIN
 SELECT * INTO a FROM public.doctor_appointments WHERE id=bid AND mode='home_visit' FOR UPDATE;
 SELECT * INTO d FROM public.home_visit_details WHERE booking_id=bid FOR UPDATE;
 IF a.id IS NULL OR d.booking_id IS NULL THEN RAISE EXCEPTION 'Home visit not found'; END IF;
 PERFORM private.hv_view(bid,u);
 IF NULLIF(p_input->>'expected_version','') IS NULL OR (p_input->>'expected_version')::integer<>d.version THEN RAISE EXCEPTION 'Visit changed; refresh before acting'; END IF;
 IF action IS NULL THEN RAISE EXCEPTION 'Visit action required'; END IF;
 SELECT * INTO q FROM public.home_visit_quotes WHERE id=d.quote_id;
 IF action='accept' THEN
  IF a.home_visit_status<>'pending' OR a.status<>'pending' OR d.pending_deadline<=now() THEN RAISE EXCEPTION 'Visit is no longer pending or acceptance deadline expired'; END IF;
  IF NOT private.hv_doctor(u) OR u=d.patient_id OR NOT EXISTS(SELECT 1 FROM public.home_visit_offers WHERE booking_id=bid AND provider_id=u AND declined_at IS NULL) OR (d.routing='named' AND a.provider_id IS DISTINCT FROM u) THEN RAISE EXCEPTION 'Only an eligible invited doctor may accept this visit'; END IF;
  SELECT * INTO s FROM public.home_visit_provider_settings WHERE provider_id=u;
  IF s.version IS DISTINCT FROM (q.candidates->u::text->>'version')::integer OR s.fee<>a.fee OR s.currency<>a.currency OR NOT(a.address_snapshot->>'pincode'=ANY(s.coverage_pincodes)) THEN RAISE EXCEPTION 'Doctor quote changed; patient review is required'; END IF;
  t:=CASE WHEN d.is_now THEN now() ELSE a.start_time END;e:=t+make_interval(mins=>s.duration_minutes);
  IF NOT private.hv_time_valid(u,t,e,d.is_now) OR (NOT d.is_now AND t<=now()) THEN RAISE EXCEPTION 'Doctor is unavailable at the requested time'; END IF;
  PERFORM private.hv_lock(u);
  UPDATE public.home_visit_details SET accepted_at=now() WHERE booking_id=bid;
  UPDATE public.doctor_appointments SET provider_id=u,status='confirmed',home_visit_status='confirmed',start_time=t,end_time=e,provider_timezone=s.timezone,home_buffer_before_minutes=s.buffer_before_minutes,home_buffer_after_minutes=s.buffer_after_minutes,updated_at=now() WHERE id=bid;
 ELSIF action='decline' THEN
  IF a.home_visit_status<>'pending' OR reason IS NULL OR NOT private.hv_doctor(u) OR NOT EXISTS(SELECT 1 FROM public.home_visit_offers WHERE booking_id=bid AND provider_id=u AND declined_at IS NULL) THEN RAISE EXCEPTION 'Pending invited offer and decline reason required'; END IF;
  UPDATE public.home_visit_offers SET declined_at=now(),decline_reason=left(reason,500) WHERE booking_id=bid AND provider_id=u;
  IF d.routing='named' OR NOT EXISTS(SELECT 1 FROM public.home_visit_offers WHERE booking_id=bid AND declined_at IS NULL) THEN UPDATE public.doctor_appointments SET status='cancelled',home_visit_status='declined',updated_at=now() WHERE id=bid; END IF;
 ELSIF action='cancel' THEN
  IF (u<>d.actor_id AND u IS DISTINCT FROM a.provider_id) OR a.home_visit_status NOT IN ('pending','confirmed','en_route') OR reason IS NULL THEN RAISE EXCEPTION 'Participant cancellation with a reason is allowed only before arrival'; END IF;
  UPDATE public.doctor_appointments SET status='cancelled',home_visit_status='cancelled',arrival_otp=NULL,updated_at=now() WHERE id=bid;
  DELETE FROM public.home_visit_reschedule_holds WHERE booking_id=bid;
  UPDATE public.home_visit_arrival_secrets SET code_hash=NULL,consumed_at=now() WHERE booking_id=bid;
 ELSIF action='start_travel' THEN
  IF u IS DISTINCT FROM a.provider_id OR a.home_visit_status<>'confirmed' OR NOT private.hv_doctor(u) THEN RAISE EXCEPTION 'Only the confirmed assigned doctor may start travel'; END IF;
  IF now()<a.start_time-make_interval(mins=>a.home_buffer_before_minutes) THEN RAISE EXCEPTION 'It is too early to start travel for this appointment'; END IF;
  IF NULLIF(p_input->>'eta_minutes','') IS NOT NULL AND (p_input->>'eta_minutes')::integer NOT BETWEEN 1 AND 1440 THEN RAISE EXCEPTION 'Doctor-reported ETA must be positive or omitted'; END IF;
  IF EXISTS(SELECT 1 FROM public.home_visit_reschedule_holds WHERE booking_id=bid AND expires_at>now()) THEN RAISE EXCEPTION 'Resolve the reschedule proposal before starting travel'; END IF;
  UPDATE public.doctor_appointments SET home_visit_status='en_route',en_route_at=now(),eta_minutes=NULLIF(p_input->>'eta_minutes','')::integer,updated_at=now() WHERE id=bid;
 ELSIF action='report_arrival' THEN
  IF u IS DISTINCT FROM a.provider_id OR a.home_visit_status<>'en_route' THEN RAISE EXCEPTION 'Only the travelling assigned doctor may report arrival'; END IF;
  UPDATE public.doctor_appointments SET home_visit_status='arrived',doctor_arrived_at=now(),updated_at=now() WHERE id=bid;
 ELSIF action='start_consultation' THEN
  IF u IS DISTINCT FROM a.provider_id OR a.home_visit_status<>'arrived' OR NOT EXISTS(SELECT 1 FROM public.home_visit_arrival_secrets WHERE booking_id=bid AND consumed_at IS NOT NULL) THEN RAISE EXCEPTION 'Assigned doctor and patient arrival acknowledgement required'; END IF;
  UPDATE public.doctor_appointments SET home_visit_status='in_consultation',consultation_started_at=now(),updated_at=now() WHERE id=bid;
  INSERT INTO public.home_visit_encounters(booking_id,author_id) VALUES(bid,u);
 ELSIF action='save_encounter' THEN
  IF u IS DISTINCT FROM a.provider_id OR a.home_visit_status<>'in_consultation' OR length(trim(COALESCE(p_input->>'summary','')))=0 OR length(p_input->>'summary')>20000 THEN RAISE EXCEPTION 'Only the consulting doctor can sign a nonempty encounter summary'; END IF;
  IF EXISTS(SELECT 1 FROM public.home_visit_encounters WHERE booking_id=bid AND signed_at IS NOT NULL) THEN RAISE EXCEPTION 'Signed record is immutable; use a reasoned amendment'; END IF;
  UPDATE public.home_visit_encounters SET summary=trim(p_input->>'summary'),follow_up=NULLIF(trim(p_input->>'follow_up'),''),signed_at=now() WHERE booking_id=bid AND author_id=u AND signed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open clinical encounter required before signing'; END IF;
 ELSIF action='amend_encounter' THEN
  IF u IS DISTINCT FROM a.provider_id OR a.home_visit_status NOT IN ('in_consultation','completed') OR reason IS NULL OR length(trim(COALESCE(p_input->>'summary','')))=0 OR length(p_input->>'summary')>20000 THEN RAISE EXCEPTION 'Assigned clinician, amendment text and reason required'; END IF;
  UPDATE public.home_visit_encounters SET amendments=amendments||jsonb_build_array(jsonb_build_object('summary',trim(p_input->>'summary'),'follow_up',NULLIF(trim(p_input->>'follow_up'),''),'reason',left(reason,500),'author_id',u,'signed_at',now())) WHERE booking_id=bid AND signed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'No signed encounter to amend'; END IF;
 ELSIF action='complete' THEN
  IF u IS DISTINCT FROM a.provider_id OR a.home_visit_status<>'in_consultation' OR NOT EXISTS(SELECT 1 FROM public.home_visit_encounters WHERE booking_id=bid AND length(trim(summary))>0) THEN RAISE EXCEPTION 'Assigned doctor must save the encounter before completing consultation'; END IF;
  UPDATE public.doctor_appointments SET status='completed',home_visit_status='completed',completed_at=now(),updated_at=now() WHERE id=bid;
  UPDATE public.home_visit_arrival_secrets SET code_hash=NULL WHERE booking_id=bid;
 ELSIF action='record_settlement' THEN
  IF u IS DISTINCT FROM a.provider_id OR a.home_visit_status<>'completed' OR NOT private.hv_cash_allowed(d.actor_id,u) THEN RAISE EXCEPTION 'Authorised clinician cash collection is not enabled for this visit'; END IF;
  IF p_input->>'method' IS DISTINCT FROM 'cash' OR NULLIF(p_input->>'amount','') IS NULL OR (p_input->>'amount')::numeric<>a.fee OR p_input->>'currency' IS DISTINCT FROM a.currency THEN RAISE EXCEPTION 'Recorded cash collection must match the agreed amount and currency'; END IF;
  INSERT INTO public.home_visit_settlements(booking_id,actor_id,method,amount,currency,reference) VALUES(bid,u,'cash',a.fee,a.currency,left(p_input->>'reference',200));
 ELSIF action='request_reschedule' THEN
  IF u<>d.actor_id OR a.home_visit_status<>'confirmed' OR a.start_time<=now() OR a.consent_version IS DISTINCT FROM (SELECT consent_version FROM public.home_visit_policy) THEN RAISE EXCEPTION 'Only the patient may propose a replacement before the confirmed visit'; END IF;
  SELECT * INTO q FROM public.home_visit_quotes WHERE id=(p_input->>'quote_id')::uuid AND actor_id=u AND booking_id=bid FOR UPDATE;
  IF q.id IS NULL OR q.expires_at<=now() OR q.provider_id IS DISTINCT FROM a.provider_id OR q.pincode IS DISTINCT FROM a.address_snapshot->>'pincode' OR q.start_time<=now() THEN RAISE EXCEPTION 'Review a valid reschedule quote retaining doctor and address'; END IF;
  SELECT * INTO s FROM public.home_visit_provider_settings WHERE provider_id=a.provider_id;
  IF s.version IS DISTINCT FROM (q.config->>'version')::integer OR NOT private.hv_time_valid(a.provider_id,q.start_time,q.end_time,false) THEN RAISE EXCEPTION 'Replacement availability or quote changed'; END IF;
  IF least(q.start_time-make_interval(mins=>s.buffer_before_minutes),a.start_time-make_interval(mins=>a.home_buffer_before_minutes))<=now() THEN RAISE EXCEPTION 'Too late to hold a replacement; original visit retained'; END IF;
  PERFORM private.hv_lock(a.provider_id);
  IF private.hv_busy(a.provider_id,q.start_time-make_interval(mins=>s.buffer_before_minutes),q.end_time+make_interval(mins=>s.buffer_after_minutes),bid) THEN RAISE EXCEPTION 'Replacement capacity conflict; original visit retained'; END IF;
  INSERT INTO public.home_visit_reschedule_holds(booking_id,quote_id,provider_id,requested_by,start_time,end_time,buffer_before_minutes,buffer_after_minutes,expires_at)
  VALUES(bid,q.id,a.provider_id,u,q.start_time,q.end_time,s.buffer_before_minutes,s.buffer_after_minutes,least(now()+make_interval(mins=>s.acceptance_minutes),q.start_time-make_interval(mins=>s.buffer_before_minutes),a.start_time-make_interval(mins=>a.home_buffer_before_minutes)))
  ON CONFLICT(booking_id) DO UPDATE SET quote_id=EXCLUDED.quote_id,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,buffer_before_minutes=EXCLUDED.buffer_before_minutes,buffer_after_minutes=EXCLUDED.buffer_after_minutes,expires_at=EXCLUDED.expires_at;
 ELSIF action IN ('accept_reschedule','decline_reschedule') THEN
  IF u IS DISTINCT FROM a.provider_id OR a.home_visit_status<>'confirmed' THEN RAISE EXCEPTION 'Only the assigned doctor can answer a replacement proposal'; END IF;
  SELECT * INTO h FROM public.home_visit_reschedule_holds WHERE booking_id=bid FOR UPDATE;
  IF h.booking_id IS NULL OR h.expires_at<=now() THEN RAISE EXCEPTION 'Replacement hold expired; original appointment retained'; END IF;
  IF action='accept_reschedule' THEN
   SELECT * INTO q FROM public.home_visit_quotes WHERE id=h.quote_id;
   SELECT * INTO s FROM public.home_visit_provider_settings WHERE provider_id=u;
   IF NOT private.hv_doctor(u) OR a.consent_version IS DISTINCT FROM (SELECT consent_version FROM public.home_visit_policy) OR s.version IS DISTINCT FROM (q.config->>'version')::integer OR NOT private.hv_time_valid(u,h.start_time,h.end_time,false) OR h.start_time<=now() THEN RAISE EXCEPTION 'Replacement is no longer valid; original appointment retained'; END IF;
   PERFORM private.hv_lock(u);
   UPDATE public.doctor_appointments SET start_time=h.start_time,end_time=h.end_time,fee=q.fee,currency=q.currency,provider_timezone=q.provider_timezone,home_buffer_before_minutes=h.buffer_before_minutes,home_buffer_after_minutes=h.buffer_after_minutes,updated_at=now() WHERE id=bid;
   UPDATE public.home_visit_details SET quote_id=q.id WHERE booking_id=bid;
  ELSE IF reason IS NULL THEN RAISE EXCEPTION 'Decline reason required'; END IF; END IF;
  DELETE FROM public.home_visit_reschedule_holds WHERE booking_id=bid;
 ELSIF action='dispute' THEN
  IF (u<>d.actor_id AND u IS DISTINCT FROM a.provider_id) OR a.home_visit_status NOT IN ('confirmed','en_route','arrived','in_consultation','completed','cancelled') OR reason IS NULL THEN RAISE EXCEPTION 'Participant dispute requires a reason'; END IF;
  INSERT INTO public.home_visit_disputes(booking_id,actor_id,reason) VALUES(bid,u,left(reason,2000));
 ELSE RAISE EXCEPTION 'Unsupported home-visit action'; END IF;
 UPDATE public.home_visit_details SET version=version+1 WHERE booking_id=bid RETURNING version INTO v;
 PERFORM private.hv_event(bid,action,reason);
 IF action='decline' THEN RETURN jsonb_build_object('id',bid,'booking_id',bid,'version',v,'home_visit_status',(SELECT home_visit_status FROM public.doctor_appointments WHERE id=bid),'allowed_actions','[]'::jsonb); END IF;
 RETURN private.hv_view(bid,u);
END $$;
CREATE FUNCTION public.hv_arrival_code(p_booking_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=private.hv_actor(); a public.doctor_appointments; secret public.home_visit_arrival_secrets; code text; v_salt uuid:=gen_random_uuid(); BEGIN
 SELECT * INTO a FROM public.doctor_appointments WHERE id=p_booking_id AND mode='home_visit' FOR UPDATE;
 IF a.id IS NULL OR a.patient_id<>u OR a.home_visit_status NOT IN ('en_route','arrived') OR NOT EXISTS(SELECT 1 FROM public.home_visit_details WHERE booking_id=a.id AND actor_id=u) THEN RAISE EXCEPTION 'Only the booking patient can request their active visit code'; END IF;
 INSERT INTO public.home_visit_arrival_secrets(booking_id) VALUES(a.id) ON CONFLICT DO NOTHING;
 SELECT * INTO secret FROM public.home_visit_arrival_secrets WHERE booking_id=a.id FOR UPDATE;
 IF secret.consumed_at IS NOT NULL OR secret.attempts>=5 OR secret.issue_count>=10 THEN RAISE EXCEPTION 'Arrival code unavailable; contact configured support'; END IF;
 IF secret.issued_at>now()-interval '60 seconds' THEN RAISE EXCEPTION 'A code was recently issued; wait one minute before replacing it'; END IF;
 -- UUID v4 randomness is supplied by PostgreSQL, never Math.random/client data.
 code:=lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint)%1000000)::text,6,'0');
 UPDATE public.home_visit_arrival_secrets SET salt=v_salt,code_hash=sha256(convert_to(a.id::text||v_salt::text||code,'UTF8')),expires_at=now()+interval '10 minutes',issued_at=now(),issue_count=issue_count+1 WHERE booking_id=a.id;
 -- Do not include code in events, appointment fields, provider responses or logs.
 RETURN jsonb_build_object('code',code,'expires_at',now()+interval '10 minutes');
END $$;
CREATE FUNCTION public.hv_verify_arrival(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=private.hv_actor(); a public.doctor_appointments; d public.home_visit_details; secret public.home_visit_arrival_secrets; code text:=COALESCE(p_input->>'code',''); BEGIN
 SELECT * INTO a FROM public.doctor_appointments WHERE id=(p_input->>'booking_id')::uuid AND mode='home_visit' FOR UPDATE;
 SELECT * INTO d FROM public.home_visit_details WHERE booking_id=a.id FOR UPDATE;
 IF a.id IS NULL OR u IS DISTINCT FROM a.provider_id OR a.home_visit_status NOT IN ('en_route','arrived') THEN RAISE EXCEPTION 'Only the assigned doctor may verify this active visit'; END IF;
 IF NULLIF(p_input->>'expected_version','') IS NULL OR (p_input->>'expected_version')::integer<>d.version THEN RAISE EXCEPTION 'Visit changed; refresh before acting'; END IF;
 SELECT * INTO secret FROM public.home_visit_arrival_secrets WHERE booking_id=a.id FOR UPDATE;
 IF secret.booking_id IS NULL OR secret.consumed_at IS NOT NULL OR secret.expires_at<=now() OR secret.attempts>=5 THEN RETURN jsonb_build_object('ok',false,'error','Arrival code expired, locked or unavailable','attempts_remaining',greatest(0,5-COALESCE(secret.attempts,0))); END IF;
 IF code !~ '^[0-9]{6}$' OR secret.code_hash IS DISTINCT FROM sha256(convert_to(a.id::text||secret.salt::text||code,'UTF8')) THEN
  UPDATE public.home_visit_arrival_secrets SET attempts=attempts+1 WHERE booking_id=a.id;
  -- Returning (not raising) commits the failed-attempt counter transaction.
  RETURN jsonb_build_object('ok',false,'error','Invalid arrival verification code','attempts_remaining',4-secret.attempts);
 END IF;
 UPDATE public.home_visit_arrival_secrets SET consumed_at=now(),code_hash=NULL WHERE booking_id=a.id;
 UPDATE public.doctor_appointments SET home_visit_status='arrived',arrived_at=now(),updated_at=now() WHERE id=a.id;
 UPDATE public.home_visit_details SET version=version+1 WHERE booking_id=a.id;
 PERFORM private.hv_event(a.id,'patient_arrival_acknowledged'); RETURN private.hv_view(a.id,u);
END $$;
CREATE FUNCTION public.hv_expire_pending(p_limit integer DEFAULT 100,p_booking_ids uuid[] DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; n integer:=0; BEGIN
 FOR a IN SELECT ap.id FROM public.doctor_appointments ap JOIN public.home_visit_details d ON d.booking_id=ap.id WHERE ap.mode='home_visit' AND ap.home_visit_status='pending' AND ap.status='pending' AND d.pending_deadline<=now() AND (p_booking_ids IS NULL OR ap.id=ANY(p_booking_ids)) ORDER BY d.pending_deadline FOR UPDATE OF ap SKIP LOCKED LIMIT least(greatest(p_limit,1),500) LOOP
  UPDATE public.doctor_appointments SET status='cancelled',home_visit_status='expired',updated_at=now() WHERE id=a.id AND status='pending' AND home_visit_status='pending';
  IF FOUND THEN UPDATE public.home_visit_details SET version=version+1 WHERE booking_id=a.id; PERFORM private.hv_event(a.id,'expired'); n:=n+1; END IF;
 END LOOP;
 DELETE FROM public.home_visit_reschedule_holds WHERE expires_at<=now() AND (p_booking_ids IS NULL OR booking_id=ANY(p_booking_ids));
 RETURN n;
END $$;
CREATE FUNCTION public.hv_operations() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.home_visit_operations_members WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Explicit home-visit operations permission required'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('booking_id',a.id,'status',a.home_visit_status,'provider_id',a.provider_id,'start_time',a.start_time,'pending_deadline',d.pending_deadline,'delayed',a.home_visit_status IN ('confirmed','en_route','arrived') AND a.start_time<now(),'failed_notifications',(SELECT count(*) FROM public.home_visit_notification_jobs j WHERE booking_id=a.id AND status='failed'),'dispute_count',(SELECT count(*) FROM public.home_visit_disputes WHERE booking_id=a.id AND status='open'),'unaccepted',a.home_visit_status='pending','updated_at',a.updated_at) ORDER BY a.updated_at DESC) FROM public.doctor_appointments a JOIN public.home_visit_details d ON d.booking_id=a.id),'[]'::jsonb);
END $$;
CREATE FUNCTION public.hv_claim_notifications(p_limit integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j record; r jsonb:='[]'; token uuid; BEGIN
 UPDATE public.home_visit_notification_jobs SET status='failed',last_error='Notification worker lease exhausted',lease_token=NULL WHERE status='processing' AND attempts>=5 AND locked_at<now()-interval '5 minutes';
 FOR j IN SELECT * FROM public.home_visit_notification_jobs WHERE attempts<5 AND ((status IN ('pending','failed') AND available_at<=now()) OR (status='processing' AND locked_at<now()-interval '5 minutes')) ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(p_limit,1),100) LOOP
  token:=gen_random_uuid();
  UPDATE public.home_visit_notification_jobs SET status='processing',attempts=attempts+1,locked_at=now(),lease_token=token WHERE id=j.id;
  r:=r||jsonb_build_array(jsonb_build_object('id',j.id,'booking_id',j.booking_id,'recipient_id',j.recipient_id,'channel',j.channel,'attempts',j.attempts+1,'lease_token',token));
 END LOOP; RETURN r;
END $$;
CREATE FUNCTION public.hv_finish_notification(p_id uuid,p_lease_token uuid,p_delivered boolean,p_error text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.home_visit_notification_jobs SET status=CASE WHEN p_delivered THEN 'sent' ELSE 'failed' END,sent_at=CASE WHEN p_delivered THEN now() ELSE NULL END,last_error=CASE WHEN p_delivered THEN NULL ELSE left(COALESCE(p_error,'Delivery attempt failed'),200) END,available_at=now()+make_interval(secs=>(30*power(2,least(attempts,5)))::integer),lease_token=NULL
 WHERE id=p_id AND lease_token=p_lease_token AND status='processing';
 IF NOT FOUND THEN RAISE EXCEPTION 'Notification lease is stale'; END IF;
END $$;
-- Generic clinic appointments retain their APIs, with actor ownership and
-- home-visit routing protected. Home lifecycle mutations go only through hv_*.
CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.doctor_appointments; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthenticated caller'; END IF;
 SELECT * INTO a FROM public.doctor_appointments WHERE id=p_appointment_id FOR UPDATE;
 IF a.id IS NULL OR (auth.uid() IS DISTINCT FROM a.patient_id AND auth.uid() IS DISTINCT FROM a.provider_id) THEN RAISE EXCEPTION 'Unauthorized to cancel this appointment'; END IF;
 IF a.mode='home_visit' THEN RAISE EXCEPTION 'Use the home-visit cancellation action with version and reason'; END IF;
 IF a.status NOT IN ('confirmed','rescheduled') THEN RAISE EXCEPTION 'Only confirmed or rescheduled appointments can be cancelled'; END IF;
 UPDATE public.doctor_appointments SET status='cancelled',updated_at=now() WHERE id=a.id;
END $$;
CREATE OR REPLACE FUNCTION public.reschedule_appointment(p_appointment_id uuid,p_new_start timestamptz,p_new_end timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
CREATE OR REPLACE FUNCTION public.atomic_book_appointment(p_provider_id uuid,p_patient_id uuid,p_start_time timestamptz,p_end_time timestamptz,p_service text,p_fee numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
-- Narrow grants, including previously public trigger helpers. Internal routines
-- are callable by owners only, even when used from privileged API wrappers.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure sig,p.proname,p.prorettype FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='private' AND p.proname LIKE 'hv_%') OR (n.nspname='public' AND (p.proname LIKE 'hv_%' OR p.proname='check_appointment_overlap')) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
  IF f.proname IN ('hv_expire_pending','hv_claim_notifications','hv_finish_notification') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig);
  ELSIF f.proname IN ('hv_context','hv_provider_settings','hv_save_provider_settings','hv_discover','hv_quote','hv_create','hv_recover','hv_list','hv_action','hv_arrival_code','hv_verify_arrival','hv_operations') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig); END IF;
 END LOOP;
END $$;
-- A facility cannot move an already accepted duty around the assignment guard.
-- Jobs without a bounded interval conservatively occupy the provider until closed.
CREATE FUNCTION private.hv_parent_assignment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
CREATE TRIGGER home_visit_staffing_parent_capacity BEFORE UPDATE OF starts_at,ends_at,status ON public.staffing_jobs FOR EACH ROW EXECUTE FUNCTION private.hv_parent_assignment_guard();
CREATE TRIGGER home_visit_surgery_parent_capacity BEFORE UPDATE OF status,scheduled_at ON public.surgery_bookings FOR EACH ROW EXECUTE FUNCTION private.hv_parent_assignment_guard();
CREATE TRIGGER home_visit_therapist_capacity BEFORE UPDATE OF user_id ON public.physio_therapists FOR EACH ROW EXECUTE FUNCTION private.hv_parent_assignment_guard();
REVOKE ALL ON FUNCTION private.hv_parent_assignment_guard() FROM PUBLIC,anon,authenticated;
CREATE TABLE public.home_visit_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.doctor_appointments(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id), reason text NOT NULL CHECK(length(trim(reason))>0),
  opened_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  resolved_at timestamptz, resolution text
);
CREATE INDEX home_visit_disputes_booking_idx ON public.home_visit_disputes(booking_id,status);
ALTER TABLE public.home_visit_disputes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.home_visit_disputes FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.home_visit_disputes TO service_role;

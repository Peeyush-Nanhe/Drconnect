-- Scheduled clinic lifecycle. This is additive; existing appointment IDs,
-- home/chat gates and immutable historical migrations are preserved.
CREATE TABLE public.clinic_consultation_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 real_patients_enabled boolean NOT NULL DEFAULT false,
 settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(settings)='object')
);
INSERT INTO public.clinic_consultation_policy(singleton) VALUES(true);
CREATE TABLE public.clinic_consultation_pilot_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 settings jsonb NOT NULL CHECK(jsonb_typeof(settings)='object'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.clinic_consultation_pilot_participants (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 policy_id uuid NOT NULL REFERENCES public.clinic_consultation_pilot_policies(id)
);
CREATE TABLE public.clinic_offerings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider_id uuid NOT NULL REFERENCES auth.users(id),
 clinic_id uuid NOT NULL REFERENCES public.hubs(id),
 pilot_policy_id uuid REFERENCES public.clinic_consultation_pilot_policies(id),
 enabled boolean NOT NULL DEFAULT false,
 fee numeric(10,2) NOT NULL CHECK(fee>=0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 5 AND 240),
 timezone text NOT NULL, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,provider_id,clinic_id)
);
ALTER TABLE public.doctor_appointments ADD CONSTRAINT doctor_appointments_identity_key UNIQUE(id,patient_id,provider_id);
CREATE TABLE public.clinic_appointments (
 appointment_id uuid PRIMARY KEY REFERENCES public.doctor_appointments(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id), patient_id uuid NOT NULL REFERENCES auth.users(id),
 provider_id uuid NOT NULL REFERENCES auth.users(id), clinic_id uuid NOT NULL REFERENCES public.hubs(id),
 offering_id uuid NOT NULL,
 lifecycle text NOT NULL DEFAULT 'pending_confirmation' CHECK(lifecycle IN ('pending_confirmation','confirmed','checked_in','in_consultation','completed','declined','cancelled','no_show','interrupted')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 policy_snapshot jsonb NOT NULL, offering_snapshot jsonb NOT NULL,
 scheduled_start timestamptz NOT NULL, scheduled_end timestamptz NOT NULL CHECK(scheduled_end>scheduled_start),
 checked_in_at timestamptz, checked_in_by uuid REFERENCES auth.users(id),
 started_at timestamptz, completed_at timestamptz, ended_at timestamptz,
 idempotency_key text NOT NULL, payload_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(actor_id=patient_id),
 UNIQUE(actor_id,idempotency_key), UNIQUE(appointment_id,patient_id,provider_id,clinic_id),
 FOREIGN KEY(appointment_id,patient_id,provider_id) REFERENCES public.doctor_appointments(id,patient_id,provider_id),
 FOREIGN KEY(offering_id,provider_id,clinic_id) REFERENCES public.clinic_offerings(id,provider_id,clinic_id)
);
CREATE TABLE public.clinic_encounters (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 appointment_id uuid NOT NULL UNIQUE, patient_id uuid NOT NULL, provider_id uuid NOT NULL, clinic_id uuid NOT NULL,
 draft jsonb NOT NULL DEFAULT '{}'::jsonb, draft_version integer NOT NULL DEFAULT 1 CHECK(draft_version>0),
 started_at timestamptz NOT NULL DEFAULT now(), finalised_at timestamptz,
 FOREIGN KEY(appointment_id,patient_id,provider_id,clinic_id) REFERENCES public.clinic_appointments(appointment_id,patient_id,provider_id,clinic_id) ON DELETE CASCADE,
 UNIQUE(id,appointment_id,provider_id)
);
CREATE TABLE public.clinic_released_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 encounter_id uuid NOT NULL, appointment_id uuid NOT NULL, finalised_by uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), status text NOT NULL CHECK(status IN ('finalised','amended','interrupted')),
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),
 clinician jsonb NOT NULL, clinic jsonb NOT NULL,
 finalised_at timestamptz NOT NULL DEFAULT now(),
 amendment_reason text, previous_version_id uuid REFERENCES public.clinic_released_records(id),
 UNIQUE(encounter_id,version),
 FOREIGN KEY(encounter_id,appointment_id,finalised_by) REFERENCES public.clinic_encounters(id,appointment_id,provider_id) ON DELETE CASCADE,
 CHECK((version=1 AND previous_version_id IS NULL AND status IN ('finalised','interrupted')) OR (version>1 AND previous_version_id IS NOT NULL AND status='amended' AND length(trim(amendment_reason))>0))
);
CREATE TABLE public.clinic_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), appointment_id uuid NOT NULL REFERENCES public.clinic_appointments(appointment_id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id), kind text NOT NULL, version integer NOT NULL,
 reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.clinic_action_replays (
 actor_id uuid NOT NULL REFERENCES auth.users(id), idempotency_key text NOT NULL,
 appointment_id uuid NOT NULL REFERENCES public.clinic_appointments(appointment_id) ON DELETE CASCADE,
 action text NOT NULL, payload_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,idempotency_key)
);
CREATE TABLE public.clinic_notification_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.clinic_events(id) ON DELETE CASCADE,
 appointment_id uuid NOT NULL REFERENCES public.clinic_appointments(appointment_id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id), status text NOT NULL DEFAULT 'disabled' CHECK(status='disabled'),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(event_id,recipient_id)
);
CREATE INDEX clinic_offerings_provider_idx ON public.clinic_offerings(provider_id,clinic_id);
CREATE INDEX clinic_offerings_clinic_idx ON public.clinic_offerings(clinic_id);
CREATE INDEX clinic_offerings_policy_idx ON public.clinic_offerings(pilot_policy_id);
CREATE INDEX clinic_participants_policy_idx ON public.clinic_consultation_pilot_participants(policy_id);
CREATE INDEX clinic_appointments_patient_idx ON public.clinic_appointments(patient_id,created_at DESC,appointment_id);
CREATE INDEX clinic_appointments_provider_idx ON public.clinic_appointments(provider_id,created_at DESC,appointment_id);
CREATE INDEX clinic_appointments_clinic_idx ON public.clinic_appointments(clinic_id);
CREATE INDEX clinic_appointments_offering_idx ON public.clinic_appointments(offering_id);
CREATE INDEX clinic_appointments_checkin_actor_idx ON public.clinic_appointments(checked_in_by);
CREATE INDEX clinic_encounters_identity_idx ON public.clinic_encounters(patient_id,provider_id,clinic_id);
CREATE INDEX clinic_records_appointment_idx ON public.clinic_released_records(appointment_id,version);
CREATE INDEX clinic_records_author_idx ON public.clinic_released_records(finalised_by);
CREATE INDEX clinic_records_previous_idx ON public.clinic_released_records(previous_version_id);
CREATE INDEX clinic_events_appointment_idx ON public.clinic_events(appointment_id,created_at);
CREATE INDEX clinic_events_actor_idx ON public.clinic_events(actor_id);
CREATE INDEX clinic_replays_appointment_idx ON public.clinic_action_replays(appointment_id);
CREATE INDEX clinic_jobs_appointment_idx ON public.clinic_notification_jobs(appointment_id);
CREATE INDEX clinic_jobs_recipient_idx ON public.clinic_notification_jobs(recipient_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['clinic_consultation_policy','clinic_consultation_pilot_policies','clinic_consultation_pilot_participants','clinic_offerings','clinic_appointments','clinic_encounters','clinic_released_records','clinic_events','clinic_action_replays','clinic_notification_jobs'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;

CREATE FUNCTION private.cc_enabled(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id=u) AND (
 EXISTS(SELECT 1 FROM public.clinic_consultation_policy WHERE real_patients_enabled)
 OR EXISTS(SELECT 1 FROM public.clinic_consultation_pilot_participants p JOIN auth.users a ON a.id=p.user_id WHERE p.user_id=u AND a.email LIKE 'clinic-test-%@example.invalid'))
$$;
CREATE FUNCTION private.cc_doctor(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.cc_enabled(u) AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role='provider')
 AND EXISTS(SELECT 1 FROM public.account_role_requests WHERE user_id=u AND status='approved' AND requested_role='provider' AND requested_view IN ('doctor','medico','care_physician'))
 AND EXISTS(SELECT 1 FROM public.care_physician_profiles WHERE user_id=u AND registration_verified AND length(trim(COALESCE(council_registration_number,'')))>0 AND length(trim(COALESCE(council_name,'')))>0)
$$;
CREATE FUNCTION private.cc_actor() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to use clinic appointments' USING ERRCODE='42501'; END IF;
 IF NOT private.cc_enabled(auth.uid()) THEN RAISE EXCEPTION 'Clinic consultations are disabled pending owner-approved policies and release review' USING ERRCODE='42501'; END IF;
 RETURN auth.uid();
END $$;
CREATE FUNCTION private.cc_offering_allowed(o public.clinic_offerings,u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT o.enabled AND private.cc_enabled(u) AND private.cc_doctor(o.provider_id) AND (
 (o.pilot_policy_id IS NULL AND EXISTS(SELECT 1 FROM public.clinic_consultation_policy WHERE real_patients_enabled))
 OR (o.pilot_policy_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.clinic_consultation_pilot_participants WHERE user_id=u AND policy_id=o.pilot_policy_id)
 AND EXISTS(SELECT 1 FROM public.clinic_consultation_pilot_participants WHERE user_id=o.provider_id AND policy_id=o.pilot_policy_id)))
$$;
CREATE FUNCTION private.cc_offering_json(o public.clinic_offerings) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',o.id,'version',o.version,'provider_id',o.provider_id,'provider_name',p.full_name,'clinic_id',o.clinic_id,'clinic_name',h.name,'clinic_area',h.area,'timezone',o.timezone,'duration_minutes',o.duration_minutes,'fee',o.fee,'currency',o.currency)
 FROM public.hubs h JOIN public.profiles p ON p.id=o.provider_id WHERE h.id=o.clinic_id
$$;
CREATE FUNCTION private.cc_settings(o public.clinic_offerings) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN o.pilot_policy_id IS NOT NULL THEN (SELECT settings FROM public.clinic_consultation_pilot_policies WHERE id=o.pilot_policy_id) ELSE (SELECT settings FROM public.clinic_consultation_policy WHERE singleton) END
$$;
CREATE FUNCTION private.cc_validate_settings(s jsonb) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text; BEGIN
 IF s IS NULL OR jsonb_typeof(s)<>'object' OR jsonb_typeof(s->'required_fields') IS DISTINCT FROM 'array'
 OR jsonb_array_length(s->'required_fields')<1
 OR (s->>'check_in_before_minutes') IS NULL OR (s->>'check_in_after_minutes') IS NULL
 OR (s->>'check_in_before_minutes') !~ '^[0-9]{1,5}$' OR (s->>'check_in_after_minutes') !~ '^[0-9]{1,5}$'
 THEN RAISE EXCEPTION 'Clinic check-in and documentation policy has not been configured' USING ERRCODE='55000'; END IF;
 FOR k IN SELECT jsonb_array_elements_text(s->'required_fields') LOOP
  IF k NOT IN ('complaint','history','findings','assessment','plan','follow_up') THEN RAISE EXCEPTION 'Unsupported required clinical field policy' USING ERRCODE='55000'; END IF;
 END LOOP;
END $$;
CREATE FUNCTION private.cc_time_valid(o public.clinic_offerings,s timestamptz,e timestamptz) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.provider_availability; ls timestamp; le timestamp; w jsonb; inside boolean:=false; ds time; de time; daykey text; BEGIN
 SELECT * INTO a FROM public.provider_availability WHERE user_id=o.provider_id;
 IF a.user_id IS NULL OR a.timezone<>o.timezone OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=o.timezone)
 OR s IS NULL OR e IS NULL OR s>=e OR e-s<>make_interval(mins=>o.duration_minutes) THEN RETURN false; END IF;
 -- Immediate dispatch online/offline is independent from published clinic slots.
 IF COALESCE(a.service_online->>'in_clinic','true')='false' THEN RETURN false; END IF;
 ls:=s AT TIME ZONE o.timezone; le:=e AT TIME ZONE o.timezone;
 IF ls::date<>le::date OR ls::date=ANY(a.blocked_dates) THEN RETURN false; END IF;
 IF jsonb_typeof(a.working_hours->lower(to_char(ls,'dy'))) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 FOR w IN SELECT * FROM jsonb_array_elements(a.working_hours->lower(to_char(ls,'dy'))) LOOP
  IF ls::time>=(w->>'start')::time AND le::time<=(w->>'end')::time
  AND mod(extract(epoch FROM (ls::time-(w->>'start')::time))::numeric,(o.duration_minutes*60)::numeric)=0 THEN inside:=true; END IF;
 END LOOP;
 IF NOT inside THEN RETURN false; END IF;
 daykey:=lower(to_char(ls,'dy'));
 FOR w IN SELECT * FROM jsonb_array_elements(a.dnd_windows) LOOP
  IF w->'days' IS NOT NULL AND jsonb_array_length(w->'days')>0 AND NOT (w->'days' ? daykey) THEN CONTINUE; END IF;
  ds:=(w->>'start')::time; de:=(w->>'end')::time;
  IF ds IS NULL OR de IS NULL THEN RETURN false; END IF;
  IF ds<de AND tsrange(ls,le,'[)') && tsrange(ls::date+ds,ls::date+de,'[)') THEN RETURN false; END IF;
  IF ds>de AND (tsrange(ls,le,'[)') && tsrange(ls::date+ds,ls::date+interval '1 day','[)') OR tsrange(ls,le,'[)') && tsrange(ls::date::timestamp,ls::date+de,'[)')) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;

CREATE FUNCTION private.cc_status(l text) RETURNS public.appointment_status LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN l='pending_confirmation' THEN 'pending' WHEN l IN ('confirmed','checked_in','in_consultation') THEN 'confirmed' WHEN l='completed' THEN 'completed' WHEN l='no_show' THEN 'no_show' ELSE 'cancelled' END::public.appointment_status
$$;
CREATE FUNCTION private.cc_parent_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.clinic_appointments; BEGIN
 IF OLD.mode IS DISTINCT FROM 'in_clinic' THEN RETURN NEW; END IF;
 SELECT * INTO c FROM public.clinic_appointments WHERE appointment_id=OLD.id;
 IF NEW.mode IS DISTINCT FROM OLD.mode OR NEW.patient_id IS DISTINCT FROM OLD.patient_id OR NEW.provider_id IS DISTINCT FROM OLD.provider_id OR NEW.dependent_id IS DISTINCT FROM OLD.dependent_id
 OR NEW.fee IS DISTINCT FROM OLD.fee OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.provider_timezone IS DISTINCT FROM OLD.provider_timezone THEN
 RAISE EXCEPTION 'Clinic booking identity and agreed fee cannot be replaced' USING ERRCODE='42501'; END IF;
 IF NEW.status IS DISTINCT FROM private.cc_status(c.lifecycle) OR NEW.start_time IS DISTINCT FROM c.scheduled_start OR NEW.end_time IS DISTINCT FROM c.scheduled_end
 OR NEW.completed_at IS DISTINCT FROM (CASE WHEN c.lifecycle='completed' THEN c.completed_at ELSE NULL END) THEN
 RAISE EXCEPTION 'Use the versioned clinic lifecycle operation' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clinic_parent_guard BEFORE UPDATE ON public.doctor_appointments FOR EACH ROW EXECUTE FUNCTION private.cc_parent_guard();
CREATE FUNCTION private.cc_consistency() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE bid uuid; a public.doctor_appointments; c public.clinic_appointments; e public.clinic_encounters; BEGIN
 IF TG_TABLE_NAME='doctor_appointments' THEN bid:=NEW.id; ELSE bid:=NEW.appointment_id; END IF;
 SELECT * INTO a FROM public.doctor_appointments WHERE id=bid;
 SELECT * INTO c FROM public.clinic_appointments WHERE appointment_id=bid;
 IF a.id IS NULL THEN RETURN NEW; END IF;
 IF a.mode='in_clinic' OR c.appointment_id IS NOT NULL THEN
  IF c.appointment_id IS NULL OR a.mode<>'in_clinic' OR a.dependent_id IS NOT NULL OR a.status<>private.cc_status(c.lifecycle)
  OR a.patient_id<>c.patient_id OR a.provider_id<>c.provider_id OR a.start_time<>c.scheduled_start OR a.end_time<>c.scheduled_end
  OR a.completed_at IS DISTINCT FROM (CASE WHEN c.lifecycle='completed' THEN c.completed_at ELSE NULL END) THEN
   RAISE EXCEPTION 'Clinic appointment identity or lifecycle invariant failed' USING ERRCODE='23514'; END IF;
  IF c.lifecycle IN ('checked_in','in_consultation','completed','interrupted') AND (c.checked_in_at IS NULL OR c.checked_in_by IS DISTINCT FROM c.provider_id) THEN RAISE EXCEPTION 'Verified clinic check-in required' USING ERRCODE='23514'; END IF;
  IF c.lifecycle IN ('in_consultation','completed','interrupted') THEN
   SELECT * INTO e FROM public.clinic_encounters WHERE appointment_id=bid;
   IF e.id IS NULL OR c.started_at IS NULL THEN RAISE EXCEPTION 'Linked clinic encounter required' USING ERRCODE='23514'; END IF;
   IF c.lifecycle IN ('completed','interrupted') AND (e.finalised_at IS NULL OR c.ended_at IS NULL OR (c.lifecycle='completed' AND c.completed_at IS NULL) OR (c.lifecycle='interrupted' AND c.completed_at IS NOT NULL) OR NOT EXISTS(SELECT 1 FROM public.clinic_released_records WHERE encounter_id=e.id)) THEN RAISE EXCEPTION 'Released clinical record required before completion' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER clinic_parent_consistency AFTER INSERT OR UPDATE ON public.doctor_appointments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.cc_consistency();
CREATE CONSTRAINT TRIGGER clinic_lifecycle_consistency AFTER INSERT OR UPDATE ON public.clinic_appointments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.cc_consistency();
CREATE CONSTRAINT TRIGGER clinic_encounter_consistency AFTER INSERT OR UPDATE ON public.clinic_encounters DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.cc_consistency();
CREATE FUNCTION private.cc_immutable_record() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' OR EXISTS(SELECT 1 FROM public.clinic_appointments WHERE appointment_id=OLD.appointment_id) THEN
 RAISE EXCEPTION 'Finalised clinical records and audit events are immutable; append an authorised amendment' USING ERRCODE='42501'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER clinic_records_immutable BEFORE UPDATE OR DELETE ON public.clinic_released_records FOR EACH ROW EXECUTE FUNCTION private.cc_immutable_record();
CREATE TRIGGER clinic_events_immutable BEFORE UPDATE OR DELETE ON public.clinic_events FOR EACH ROW EXECUTE FUNCTION private.cc_immutable_record();
-- The synthetic test runner may delete its parent appointment; child cascades
-- remove only that run's fixtures. No client has DELETE privileges or policies.

-- Keep existing parent RLS, adding a restrictive gate only for clinic rows.
CREATE POLICY clinic_appointment_rollout ON public.doctor_appointments AS RESTRICTIVE FOR SELECT TO authenticated
 USING(mode<>'in_clinic' OR private.cc_enabled(auth.uid()));
CREATE FUNCTION private.cc_occupied_start(a public.doctor_appointments) RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN a.mode='in_clinic' THEN least(a.start_time,COALESCE((SELECT c.started_at FROM public.clinic_appointments c WHERE c.appointment_id=a.id AND c.lifecycle='in_consultation'),a.start_time)) ELSE a.start_time END-make_interval(mins=>a.home_buffer_before_minutes)
$$;
CREATE FUNCTION private.cc_occupied_end(a public.doctor_appointments) RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN (a.mode='home_visit' AND a.home_visit_status IN ('en_route','arrived','in_consultation'))
 OR (a.mode='in_clinic' AND EXISTS(SELECT 1 FROM public.clinic_appointments c WHERE c.appointment_id=a.id AND c.lifecycle IN ('checked_in','in_consultation')))
 THEN 'infinity'::timestamptz ELSE a.end_time+make_interval(mins=>a.home_buffer_after_minutes) END
$$;

CREATE OR REPLACE FUNCTION private.hv_busy(p_provider uuid,p_start timestamptz,p_end timestamptz,p_exclude uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.doctor_appointments a WHERE a.provider_id=p_provider AND a.id IS DISTINCT FROM p_exclude
 AND a.status IN ('pending','confirmed','rescheduled') AND
 (a.mode<>'home_visit' OR a.status<>'pending' OR NOT EXISTS(SELECT 1 FROM public.home_visit_details d WHERE d.booking_id=a.id AND d.pending_deadline<=now()))
 AND tstzrange(private.cc_occupied_start(a),
 private.cc_occupied_end(a),'[)') && tstzrange(p_start,p_end,'[)'))
 OR EXISTS(SELECT 1 FROM public.home_visit_reschedule_holds h WHERE h.provider_id=p_provider AND h.booking_id IS DISTINCT FROM p_exclude AND expires_at>now() AND tstzrange(h.start_time-make_interval(mins=>h.buffer_before_minutes),h.end_time+make_interval(mins=>h.buffer_after_minutes),'[)') && tstzrange(p_start,p_end,'[)'))
 OR EXISTS(SELECT 1 FROM public.care_requests r WHERE accepted_by=p_provider AND status='accepted')
 OR EXISTS(SELECT 1 FROM public.staffing_assignments a JOIN public.staffing_jobs j ON j.id=a.job_id WHERE a.provider_id=p_provider AND a.status='accepted' AND j.status NOT IN ('cancelled','closed') AND (j.starts_at IS NULL OR j.ends_at IS NULL OR tstzrange(j.starts_at,j.ends_at,'[)') && tstzrange(p_start,p_end,'[)')))
 OR EXISTS(SELECT 1 FROM public.surgery_booking_roles r JOIN public.surgery_bookings b ON b.id=r.booking_id WHERE r.assigned_to=p_provider AND r.status='accepted' AND b.status NOT IN ('completed','cancelled'))
 OR EXISTS(SELECT 1 FROM public.physio_visits v JOIN public.physio_therapists t ON t.id=v.therapist_id WHERE t.user_id=p_provider AND v.status IN ('assigned','en_route','in_progress') AND (v.scheduled_at IS NULL OR tstzrange(v.scheduled_at,v.scheduled_at+make_interval(mins=>v.duration_min),'[)') && tstzrange(p_start,p_end,'[)')))
$$;

CREATE OR REPLACE FUNCTION private.hv_assignment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 AND tstzrange(private.cc_occupied_start(a),private.cc_occupied_end(a),'[)') && tstzrange(COALESCE(s,'-infinity'::timestamptz),COALESCE(e,'infinity'::timestamptz),'[)'))
 OR EXISTS(SELECT 1 FROM public.home_visit_reschedule_holds h WHERE provider_id=u AND expires_at>now() AND tstzrange(h.start_time-make_interval(mins=>h.buffer_before_minutes),h.end_time+make_interval(mins=>h.buffer_after_minutes),'[)') && tstzrange(COALESCE(s,'-infinity'::timestamptz),COALESCE(e,'infinity'::timestamptz),'[)'))
 THEN RAISE EXCEPTION 'Provider capacity conflict with a doctor appointment'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.hv_parent_assignment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; s timestamptz; e timestamptz; BEGIN
 IF TG_TABLE_NAME='staffing_jobs' THEN
  IF NEW.status IN ('cancelled','closed') THEN RETURN NEW; END IF;
  s:=COALESCE(NEW.starts_at,'-infinity'::timestamptz); e:=COALESCE(NEW.ends_at,'infinity'::timestamptz);
  FOR r IN SELECT provider_id FROM public.staffing_assignments WHERE job_id=NEW.id AND status='accepted' ORDER BY provider_id LOOP
   PERFORM private.hv_lock(r.provider_id);
   IF EXISTS(SELECT 1 FROM public.doctor_appointments a WHERE a.provider_id=r.provider_id AND a.status IN ('pending','confirmed','rescheduled') AND tstzrange(private.cc_occupied_start(a),private.cc_occupied_end(a),'[)') && tstzrange(s,e,'[)'))
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
CREATE FUNCTION private.cc_validate_content(c jsonb,s jsonb,finalising boolean) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text; v jsonb; m jsonb; required text; BEGIN
 IF c IS NULL OR jsonb_typeof(c)<>'object' OR octet_length(c::text)>100000 THEN RAISE EXCEPTION 'Clinical content must be an object within the document size limit' USING ERRCODE='22023'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(c) LOOP
  IF k NOT IN ('complaint','history','findings','assessment','plan','investigations','referrals','follow_up','allergy_status','allergies','medication_status','medication_history','prescription') THEN RAISE EXCEPTION 'Unsupported clinical field' USING ERRCODE='22023'; END IF;
  IF k<>'prescription' AND (jsonb_typeof(v)<>'string' OR length(c->>k)>20000) THEN RAISE EXCEPTION 'Clinical fields require bounded text' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF c ? 'allergy_status' AND c->>'allergy_status' NOT IN ('not_recorded','reviewed') THEN RAISE EXCEPTION 'Allergy review state is invalid' USING ERRCODE='22023'; END IF;
 IF c ? 'medication_status' AND c->>'medication_status' NOT IN ('not_recorded','reviewed') THEN RAISE EXCEPTION 'Medication review state is invalid' USING ERRCODE='22023'; END IF;
 IF c->'prescription' IS NOT NULL AND c->'prescription'<>'null'::jsonb THEN
  IF jsonb_typeof(c->'prescription')<>'object' OR jsonb_typeof(c->'prescription'->'medicines') IS DISTINCT FROM 'array'
  OR jsonb_array_length(c->'prescription'->'medicines') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'A prescription requires reviewed medicine entries; omit it for advice only' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(c->'prescription') x WHERE x NOT IN ('medicines','notes')) THEN RAISE EXCEPTION 'Unsupported prescription field' USING ERRCODE='22023'; END IF;
  IF c->'prescription' ? 'notes' AND (jsonb_typeof(c->'prescription'->'notes')<>'string' OR length(c->'prescription'->>'notes')>5000) THEN RAISE EXCEPTION 'Prescription notes require bounded text' USING ERRCODE='22023'; END IF;
  FOR m IN SELECT * FROM jsonb_array_elements(c->'prescription'->'medicines') LOOP
   IF jsonb_typeof(m)<>'object' THEN RAISE EXCEPTION 'Invalid medicine entry' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(m) x WHERE x NOT IN ('name','strength','dose','route','frequency','duration','instructions')) THEN RAISE EXCEPTION 'Unsupported medicine field' USING ERRCODE='22023'; END IF;
   FOREACH required IN ARRAY ARRAY['name','strength','dose','route','frequency','duration','instructions'] LOOP
    IF jsonb_typeof(m->required) IS DISTINCT FROM 'string' OR length(m->>required)>2000 OR (required='name' AND length(trim(m->>required))=0) THEN RAISE EXCEPTION 'Clinician-reviewed medicine fields are required' USING ERRCODE='22023'; END IF;
   END LOOP;
  END LOOP;
 END IF;
 IF finalising THEN
  PERFORM private.cc_validate_settings(s);
  FOR required IN SELECT jsonb_array_elements_text(s->'required_fields') LOOP
   IF length(trim(COALESCE(c->>required,'')))=0 THEN RAISE EXCEPTION 'Complete the configured required clinical fields before release' USING ERRCODE='22023'; END IF;
  END LOOP;
 END IF;
END $$;
CREATE FUNCTION private.cc_visit(bid uuid,u uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.clinic_appointments; a public.doctor_appointments; e public.clinic_encounters; actions jsonb:='["open"]'; records jsonb; physician boolean; BEGIN
 SELECT * INTO c FROM public.clinic_appointments WHERE appointment_id=bid;
 IF NOT private.cc_enabled(u) OR c.appointment_id IS NULL OR (u<>c.patient_id AND u<>c.provider_id)
 OR NOT private.cc_enabled(c.patient_id) OR NOT private.cc_enabled(c.provider_id) THEN RAISE EXCEPTION 'Clinic appointment is unavailable or access is not authorised' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.doctor_appointments WHERE id=bid;
 SELECT * INTO e FROM public.clinic_encounters WHERE appointment_id=bid;
 physician:=u=c.provider_id AND private.cc_doctor(u);
 IF c.lifecycle IN ('pending_confirmation','confirmed') THEN
  IF COALESCE((c.policy_snapshot->>'cancel_allowed')::boolean,false) THEN actions:=actions||'["cancel"]'; END IF;
  IF COALESCE((c.policy_snapshot->>'reschedule_allowed')::boolean,false) THEN actions:=actions||'["reschedule"]'; END IF;
 END IF;
 IF physician THEN
  IF c.lifecycle='pending_confirmation' THEN actions:=actions||'["confirm","decline"]'; END IF;
  IF c.lifecycle='confirmed' THEN
   actions:=actions||'["check_in"]';
   IF c.policy_snapshot ? 'no_show_after_minutes' THEN actions:=actions||'["no_show"]'; END IF;
  END IF;
  IF c.lifecycle='checked_in' THEN actions:=actions||'["start"]'; END IF;
  IF c.lifecycle='in_consultation' THEN
   actions:=actions||'["save_draft","complete"]';
   IF COALESCE((c.policy_snapshot->>'interrupt_allowed')::boolean,false) THEN actions:=actions||'["interrupt"]'; END IF;
  END IF;
  IF c.lifecycle IN ('completed','interrupted') THEN actions:=actions||'["amend"]'; END IF;
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'status',r.status,'content',r.content,'finalised_at',r.finalised_at,'finalised_by',r.finalised_by,'clinician',r.clinician,'clinic',r.clinic,'amendment_reason',r.amendment_reason,'previous_version_id',r.previous_version_id) ORDER BY r.version),'[]') INTO records FROM public.clinic_released_records r WHERE r.appointment_id=bid;
 RETURN jsonb_build_object('appointment_id',bid,'source','doctor_appointments','mode','in_clinic','actor_id',c.actor_id,'patient_id',c.patient_id,'patient_name',(SELECT full_name FROM public.profiles WHERE id=c.patient_id),
 'provider_id',c.provider_id,'provider_name',c.offering_snapshot->>'provider_name','clinic_id',c.clinic_id,'clinic_name',c.offering_snapshot->>'clinic_name','clinic_area',c.offering_snapshot->>'clinic_area','provider_timezone',a.provider_timezone,'offering_id',c.offering_id,
 'lifecycle',c.lifecycle,'status',a.status,'version',c.version,'fee',a.fee,'currency',a.currency,'payment_status','not_recorded','created_at',c.created_at,'start_time',a.start_time,'end_time',a.end_time,
 'checked_in_at',c.checked_in_at,'checked_in_by',c.checked_in_by,'started_at',c.started_at,'completed_at',c.completed_at,'ended_at',c.ended_at,'encounter_id',e.id,
 'draft_version',CASE WHEN physician THEN e.draft_version ELSE NULL END,'draft',CASE WHEN physician THEN e.draft ELSE NULL END,'records',records,'allowed_actions',actions,'notification_status','disabled','server_time',now(),'policy',c.policy_snapshot);
END $$;
CREATE FUNCTION private.cc_event(bid uuid,u uuid,k text,v integer,r text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE eid uuid; BEGIN
 INSERT INTO public.clinic_events(appointment_id,actor_id,kind,version,reason) VALUES(bid,u,k,v,r) RETURNING id INTO eid;
 INSERT INTO public.clinic_notification_jobs(event_id,appointment_id,recipient_id)
 SELECT eid,bid,patient_id FROM public.clinic_appointments WHERE appointment_id=bid
 UNION SELECT eid,bid,provider_id FROM public.clinic_appointments WHERE appointment_id=bid;
END $$;

CREATE FUNCTION public.clinic_consultation(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  IF EXISTS(SELECT 1 FROM public.clinic_action_replays WHERE actor_id=u AND idempotency_key=key AND action<>'book') THEN RAISE EXCEPTION 'Idempotency key was already used for another action' USING ERRCODE='40001'; END IF;
  SELECT * INTO c FROM public.clinic_appointments WHERE actor_id=u AND idempotency_key=key;
  IF c.appointment_id IS NOT NULL THEN
   IF c.payload_hash<>hash THEN RAISE EXCEPTION 'Idempotency key was already used for different booking details' USING ERRCODE='40001'; END IF;
   RETURN private.cc_visit(c.appointment_id,u);
  END IF;
  SELECT * INTO o FROM public.clinic_offerings WHERE id=(p_input->>'offering_id')::uuid FOR SHARE;
  IF o.id IS NULL OR NOT private.cc_offering_allowed(o,u) THEN RAISE EXCEPTION 'Approved clinic offering is unavailable' USING ERRCODE='42501'; END IF;
  IF (p_input->>'offering_version')::integer IS DISTINCT FROM o.version THEN RAISE EXCEPTION 'Clinic offering changed; refresh its fee and availability' USING ERRCODE='40001'; END IF;
  s:=private.cc_settings(o); PERFORM private.cc_validate_settings(s);
  dt:=(p_input->>'start_time')::timestamptz; de:=dt+make_interval(mins=>o.duration_minutes);
  PERFORM private.hv_lock(o.provider_id);
  IF dt IS NULL OR dt<=clock_timestamp() OR dt>clock_timestamp()+interval '180 days' OR NOT private.cc_time_valid(o,dt,de) THEN RAISE EXCEPTION 'The selected clinic interval is invalid or no longer in the future' USING ERRCODE='22023'; END IF;
  IF private.hv_busy(o.provider_id,dt,de) THEN RAISE EXCEPTION 'Provider capacity conflict; select another appointment' USING ERRCODE='40001'; END IF;
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
  IF replay.appointment_id<>bid OR replay.action<>act OR replay.payload_hash<>hash THEN RAISE EXCEPTION 'Idempotency key was already used for different action details' USING ERRCODE='40001'; END IF;
  RETURN private.cc_visit(bid,u);
 END IF;
 IF (act='check_in' AND c.lifecycle='checked_in') OR (act='start' AND c.lifecycle='in_consultation') THEN
  IF act='check_in' AND ((p_input->>'clinic_id')::uuid IS DISTINCT FROM c.clinic_id OR p_input->'identity_confirmed' IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'Confirm identity at the booked clinic' USING ERRCODE='42501'; END IF;
  INSERT INTO public.clinic_action_replays(actor_id,idempotency_key,appointment_id,action,payload_hash) VALUES(u,key,bid,act,hash);
  RETURN private.cc_visit(bid,u);
 END IF;
 IF (p_input->>'expected_version')::integer IS DISTINCT FROM c.version THEN RAISE EXCEPTION 'Clinic appointment changed; refresh before retrying' USING ERRCODE='40001'; END IF;
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
  IF private.hv_busy(c.provider_id,dt,de,bid) THEN RAISE EXCEPTION 'Provider capacity conflict; original appointment retained' USING ERRCODE='40001'; END IF;
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
  IF EXISTS(SELECT 1 FROM public.clinic_appointments WHERE provider_id=c.provider_id AND appointment_id<>bid AND lifecycle='in_consultation') OR private.hv_busy(c.provider_id,dt,de,bid) THEN RAISE EXCEPTION 'Starting consultation conflicts with current or upcoming provider capacity' USING ERRCODE='40001'; END IF;
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
   IF (p_input->>'draft_version')::integer IS DISTINCT FROM e.draft_version THEN RAISE EXCEPTION 'Clinical draft changed; review the saved version before retrying' USING ERRCODE='40001'; END IF;
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

-- Explicit video mode preserves the existing video booking contract. Clinic
-- lifecycle access cannot be obtained by changing a display service string.
CREATE OR REPLACE FUNCTION public.book_video_appointment(p_provider_id uuid,p_patient_id uuid,p_start_time timestamptz,p_end_time timestamptz,p_service text,p_fee numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 INSERT INTO public.doctor_appointments(provider_id,patient_id,start_time,end_time,service,fee,provider_timezone,mode) VALUES(p_provider_id,p_patient_id,p_start_time,p_end_time,p_service,p_fee,a.timezone,'video') RETURNING id INTO bid;
 RETURN bid;
END $$;
-- Ambiguous stale doctor clients fail closed; approved non-doctor services
-- retain their existing booking semantics under a distinct mode.
CREATE OR REPLACE FUNCTION public.atomic_book_appointment(p_provider_id uuid,p_patient_id uuid,p_start_time timestamptz,p_end_time timestamptz,p_service text,p_fee numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.provider_availability; win jsonb; valid boolean:=false; bid uuid; BEGIN
 IF auth.uid() IS NULL OR p_patient_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Authenticated patient ownership required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_provider_id AND role='provider') OR NOT EXISTS(SELECT 1 FROM public.account_role_requests WHERE user_id=p_provider_id AND requested_role='provider' AND status='approved' AND requested_view NOT IN ('doctor','medico','care_physician')) OR EXISTS(SELECT 1 FROM public.account_role_requests WHERE user_id=p_provider_id AND requested_role='provider' AND status='approved' AND requested_view IN ('doctor','medico','care_physician')) THEN RAISE EXCEPTION 'Doctor booking setup changed; use the explicit clinic or video booking operation' USING ERRCODE='55000'; END IF;
 IF lower(COALESCE(p_service,'')) LIKE '%home%' THEN RAISE EXCEPTION 'Use home-visit quote and booking APIs'; END IF;
 IF p_start_time IS NULL OR p_end_time IS NULL OR p_start_time<=now() OR p_end_time<=p_start_time OR p_fee IS NULL OR p_fee<0 THEN RAISE EXCEPTION 'Valid future appointment interval and fee required'; END IF;
 SELECT * INTO a FROM public.provider_availability WHERE user_id=p_provider_id;
 IF a.user_id IS NULL OR NOT a.is_online OR (p_start_time AT TIME ZONE a.timezone)::date=ANY(a.blocked_dates) OR (p_start_time AT TIME ZONE a.timezone)::date<>(p_end_time AT TIME ZONE a.timezone)::date THEN RAISE EXCEPTION 'Provider is not available for booking'; END IF;
 FOR win IN SELECT * FROM jsonb_array_elements(COALESCE(a.working_hours->lower(to_char(p_start_time AT TIME ZONE a.timezone,'dy')),'[]')) LOOP
  IF (p_start_time AT TIME ZONE a.timezone)::time>=(win->>'start')::time AND (p_end_time AT TIME ZONE a.timezone)::time<=(win->>'end')::time THEN valid:=true; END IF;
 END LOOP;
 IF NOT valid THEN RAISE EXCEPTION 'Requested slot is outside provider working hours'; END IF;
 INSERT INTO public.doctor_appointments(provider_id,patient_id,start_time,end_time,service,fee,provider_timezone,mode) VALUES(p_provider_id,p_patient_id,p_start_time,p_end_time,p_service,p_fee,a.timezone,'scheduled_service') RETURNING id INTO bid;
 RETURN bid;
END $$;
CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.doctor_appointments; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthenticated caller'; END IF;
 SELECT * INTO a FROM public.doctor_appointments WHERE id=p_appointment_id FOR UPDATE;
 IF a.id IS NULL OR (auth.uid() IS DISTINCT FROM a.patient_id AND auth.uid() IS DISTINCT FROM a.provider_id) THEN RAISE EXCEPTION 'Unauthorized to cancel this appointment'; END IF;
 IF a.mode='in_clinic' THEN RAISE EXCEPTION 'Use the versioned clinic lifecycle operation' USING ERRCODE='42501'; END IF;
 IF a.mode='home_visit' THEN RAISE EXCEPTION 'Use the home-visit cancellation action with version and reason'; END IF;
 IF a.status NOT IN ('confirmed','rescheduled') THEN RAISE EXCEPTION 'Only confirmed or rescheduled appointments can be cancelled'; END IF;
 UPDATE public.doctor_appointments SET status='cancelled',updated_at=now() WHERE id=a.id;
END $$;
CREATE OR REPLACE FUNCTION public.reschedule_appointment(p_appointment_id uuid,p_new_start timestamptz,p_new_end timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.doctor_appointments; avail public.provider_availability; win jsonb; valid boolean:=false; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthenticated caller'; END IF;
 SELECT * INTO a FROM public.doctor_appointments WHERE id=p_appointment_id FOR UPDATE;
 IF a.id IS NULL OR (auth.uid() IS DISTINCT FROM a.patient_id AND auth.uid() IS DISTINCT FROM a.provider_id) THEN RAISE EXCEPTION 'Unauthorized to reschedule this appointment'; END IF;
 IF a.mode='in_clinic' THEN RAISE EXCEPTION 'Use the versioned clinic lifecycle operation' USING ERRCODE='42501'; END IF;
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
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname LIKE 'cc_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.clinic_consultation(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinic_consultation(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.book_video_appointment(uuid,uuid,timestamptz,timestamptz,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.book_video_appointment(uuid,uuid,timestamptz,timestamptz,text,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.atomic_book_appointment(uuid,uuid,timestamptz,timestamptz,text,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.cancel_appointment(uuid),public.reschedule_appointment(uuid,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.cc_enabled(uuid) TO authenticated;
ALTER POLICY clinic_appointment_rollout ON public.doctor_appointments USING(mode<>'in_clinic' OR (private.cc_enabled(auth.uid()) AND private.cc_enabled(patient_id) AND private.cc_enabled(provider_id)));
CREATE FUNCTION private.cc_offering_revision() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.provider_id IS DISTINCT FROM OLD.provider_id OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.pilot_policy_id IS DISTINCT FROM OLD.pilot_policy_id) THEN
  RAISE EXCEPTION 'Create a new offering for a different doctor, clinic or policy identity' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'Valid clinic IANA timezone required' USING ERRCODE='22023'; END IF;
 NEW.version:=CASE WHEN TG_OP='INSERT' THEN 1 ELSE OLD.version+1 END; NEW.updated_at:=clock_timestamp(); RETURN NEW;
END $$;
CREATE TRIGGER clinic_offering_revision BEFORE INSERT OR UPDATE ON public.clinic_offerings FOR EACH ROW EXECUTE FUNCTION private.cc_offering_revision();
CREATE FUNCTION private.cc_preserve_real_care() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.mode='in_clinic' AND EXISTS(SELECT 1 FROM public.clinic_encounters WHERE appointment_id=OLD.id) AND NOT EXISTS(
  SELECT 1 FROM public.clinic_appointments c JOIN public.clinic_offerings o ON o.id=c.offering_id
  JOIN auth.users p ON p.id=c.patient_id JOIN auth.users d ON d.id=c.provider_id
  WHERE c.appointment_id=OLD.id AND o.pilot_policy_id IS NOT NULL AND p.email LIKE 'clinic-test-%@example.invalid' AND d.email LIKE 'clinic-test-%@example.invalid') THEN
  RAISE EXCEPTION 'Clinical care records cannot be deleted; retain final versions and append an amendment' USING ERRCODE='42501';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER clinic_preserve_real_care BEFORE DELETE ON public.doctor_appointments FOR EACH ROW EXECUTE FUNCTION private.cc_preserve_real_care();
REVOKE ALL ON FUNCTION private.cc_offering_revision(),private.cc_preserve_real_care() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.cc_final_draft_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.finalised_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Finalised encounter drafts are immutable; append an authorised released amendment' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clinic_final_draft_guard BEFORE UPDATE ON public.clinic_encounters FOR EACH ROW EXECUTE FUNCTION private.cc_final_draft_guard();
CREATE FUNCTION private.cc_record_chain_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior public.clinic_released_records; BEGIN
 SELECT * INTO prior FROM public.clinic_released_records WHERE encounter_id=NEW.encounter_id ORDER BY version DESC LIMIT 1;
 IF NEW.version<>COALESCE(prior.version,0)+1 OR NEW.previous_version_id IS DISTINCT FROM prior.id THEN RAISE EXCEPTION 'Released record versions must form one immutable encounter chain' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clinic_record_chain_guard BEFORE INSERT ON public.clinic_released_records FOR EACH ROW EXECUTE FUNCTION private.cc_record_chain_guard();
REVOKE ALL ON FUNCTION private.cc_final_draft_guard(),private.cc_record_chain_guard() FROM PUBLIC,anon,authenticated;

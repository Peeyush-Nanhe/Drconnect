-- MyDox coordinated emergency dispatch V2 — staging candidate.
-- Reconstructed from the owner's pasted Transfer Pack; NOT that pack's missing SQL.
-- Additive, ONE-TIME install on the existing MyDox schema. Do not replay old migrations.
-- No patient/provider/administrator accounts are created or approved by this script.
-- All case mutations use authenticated commands; no client may update assignment columns.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.profiles') IS NULL OR to_regclass('public.user_roles') IS NULL
    OR to_regclass('public.account_role_requests') IS NULL OR to_regclass('public.hospitals') IS NULL THEN
  RAISE EXCEPTION 'Existing MyDox profiles/roles/approvals/hospitals schema is required';
 END IF;
 IF to_regclass('public.emergency_cases') IS NOT NULL THEN
  RAISE EXCEPTION 'Emergency V2 already exists. Review migration history; do not reset existing data.';
 END IF;
END $$;
CREATE SCHEMA emergency_private;
REVOKE ALL ON SCHEMA emergency_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA emergency_private TO authenticated, service_role;

-- Operational configuration, not another account approval system.
CREATE TABLE emergency_private.settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), enabled boolean NOT NULL DEFAULT false,
 preferred_seconds integer NOT NULL DEFAULT 60 CHECK(preferred_seconds BETWEEN 15 AND 180),
 initial_radius_km integer NOT NULL DEFAULT 4 CHECK(initial_radius_km=4),
 max_radius_km integer NOT NULL DEFAULT 15 CHECK(max_radius_km=15),
 worker_checked_at timestamptz
);
INSERT INTO emergency_private.settings(singleton) VALUES(true);
CREATE TABLE emergency_private.resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.profiles(id),
 kind text NOT NULL CHECK(kind IN ('hospital','doctor','ambulance')),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 160),
 hospital_ref uuid REFERENCES public.hospitals(id),
 categories text[] NOT NULL DEFAULT '{}',
 enabled boolean NOT NULL DEFAULT false,
 lat double precision CHECK(lat BETWEEN -90 AND 90), lng double precision CHECK(lng BETWEEN -180 AND 180),
 location_at timestamptz, heartbeat_at timestamptz,
 CHECK((lat IS NULL)=(lng IS NULL)),
 CHECK(categories <@ ARRAY['cardiac','stroke','trauma','breath','pregnancy','other']),
 CHECK((kind='hospital')=(hospital_ref IS NOT NULL)), UNIQUE(owner_id,kind), UNIQUE(hospital_ref)
);
-- Verified facility privileges and preferred panel. Account approval is still checked separately.
CREATE TABLE emergency_private.roster (
 hospital_id uuid NOT NULL REFERENCES emergency_private.resources(id),
 doctor_id uuid NOT NULL REFERENCES emergency_private.resources(id),
 category text NOT NULL CHECK(category IN ('cardiac','stroke','trauma','breath','pregnancy','other')),
 preferred boolean NOT NULL DEFAULT false, enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(hospital_id,doctor_id,category)
);
CREATE UNIQUE INDEX emergency_one_preferred ON emergency_private.roster(hospital_id,category) WHERE preferred AND enabled;

CREATE TABLE public.emergency_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES public.profiles(id),
 request_key uuid NOT NULL, category text NOT NULL CHECK(category IN ('cardiac','stroke','trauma','breath','pregnancy','other')),
 triage jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(triage)='array' AND jsonb_array_length(triage)<=4 AND octet_length(triage::text)<=4000),
 transport text NOT NULL CHECK(transport IN ('ambulance','self')), patient_name text NOT NULL,
 phone text, pickup_text text NOT NULL DEFAULT '' CHECK(length(pickup_text)<=500),
 pickup_lat double precision CHECK(pickup_lat BETWEEN -90 AND 90),
 pickup_lng double precision CHECK(pickup_lng BETWEEN -180 AND 180),
 pickup_accuracy_m double precision CHECK(pickup_accuracy_m BETWEEN 0 AND 100000),
 pickup_captured_at timestamptz,
 location_status text NOT NULL CHECK(location_status IN ('gps','verified','needs_location')),
 state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','admitted','cancelled')),
 hospital_id uuid REFERENCES emergency_private.resources(id), hospital_accepted_at timestamptz,
 bed_label text, bed_assigned_at timestamptz,
 doctor_id uuid REFERENCES emergency_private.resources(id), doctor_accepted_at timestamptz,
 doctor_stage text NOT NULL DEFAULT 'wait_hospital' CHECK(doctor_stage IN ('wait_hospital','preferred','broadcast','assigned','stopped')),
 preferred_deadline timestamptz,
 ambulance_id uuid REFERENCES emergency_private.resources(id), ambulance_accepted_at timestamptz,
 ambulance_status text NOT NULL CHECK(ambulance_status IN ('not_requested','searching','accepted','en_route','arrived','transporting','handed_over')),
 en_route_at timestamptz, pickup_arrived_at timestamptz, transporting_at timestamptz, handed_over_at timestamptz,
 admitted_at timestamptz, cancelled_at timestamptz, cancellation_reason text,
 radius_km integer NOT NULL DEFAULT 4 CHECK(radius_km BETWEEN 4 AND 15),
 search_started_at timestamptz NOT NULL DEFAULT clock_timestamp(), needs_attention boolean NOT NULL DEFAULT false,
 dispatch_checked_at timestamptz, version bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(patient_id,request_key),
 CHECK((hospital_id IS NULL)=(hospital_accepted_at IS NULL)),
 CHECK((doctor_id IS NULL)=(doctor_accepted_at IS NULL)),
 CHECK((ambulance_id IS NULL)=(ambulance_accepted_at IS NULL)),
 CHECK((pickup_lat IS NULL)=(pickup_lng IS NULL)),
 CHECK(location_status<>'gps' OR(pickup_accuracy_m IS NOT NULL AND pickup_captured_at IS NOT NULL AND isfinite(pickup_captured_at))),
 CHECK((location_status='needs_location')=(pickup_lat IS NULL)),
 CHECK(transport='ambulance' OR (ambulance_id IS NULL AND ambulance_status='not_requested'))
);
CREATE UNIQUE INDEX emergency_patient_one_open ON public.emergency_cases(patient_id) WHERE state='open';
CREATE UNIQUE INDEX emergency_crew_one_open ON public.emergency_cases(ambulance_id) WHERE state='open' AND ambulance_id IS NOT NULL;
CREATE UNIQUE INDEX emergency_doctor_one_open ON public.emergency_cases(doctor_id) WHERE state='open' AND doctor_id IS NOT NULL;
CREATE INDEX emergency_open_cases ON public.emergency_cases(created_at) WHERE state='open';
CREATE TABLE emergency_private.bays (
 hospital_id uuid NOT NULL REFERENCES emergency_private.resources(id),
 label_key text NOT NULL, label text NOT NULL,
 case_id uuid REFERENCES public.emergency_cases(id),
 state text NOT NULL CHECK(state IN ('available','reserved','occupied','cleaning')),
 PRIMARY KEY(hospital_id,label_key)
);
CREATE UNIQUE INDEX emergency_one_bay_per_case ON emergency_private.bays(case_id) WHERE case_id IS NOT NULL;
CREATE TABLE public.emergency_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES public.emergency_cases(id),
 resource_id uuid NOT NULL REFERENCES emergency_private.resources(id),
 recipient_id uuid NOT NULL REFERENCES public.profiles(id),
 kind text NOT NULL CHECK(kind IN ('hospital','doctor','ambulance')),
 category text NOT NULL, stage text NOT NULL CHECK(stage IN ('area','preferred','broadcast')),
 distance_km double precision, expires_at timestamptz,
 status text NOT NULL DEFAULT 'offered' CHECK(status IN ('offered','accepted','declined','withdrawn','expired')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), responded_at timestamptz,
 UNIQUE(case_id,resource_id)
);
CREATE INDEX emergency_offer_inbox ON public.emergency_offers(recipient_id,status);
CREATE TABLE public.emergency_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES public.emergency_cases(id),
 version bigint NOT NULL, event text NOT NULL, actor_id uuid REFERENCES public.profiles(id),
 detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(case_id,version)
);
CREATE TABLE public.emergency_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id),
 case_id uuid NOT NULL REFERENCES public.emergency_cases(id), event_id uuid REFERENCES public.emergency_events(id),
 dedupe_key text NOT NULL, title text NOT NULL, read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(user_id,dedupe_key)
);
CREATE INDEX emergency_notification_inbox ON public.emergency_notifications(user_id,created_at DESC);
CREATE TABLE public.emergency_positions (
 case_id uuid PRIMARY KEY REFERENCES public.emergency_cases(id), resource_id uuid NOT NULL REFERENCES emergency_private.resources(id),
 lat double precision NOT NULL CHECK(lat BETWEEN -90 AND 90), lng double precision NOT NULL CHECK(lng BETWEEN -180 AND 180),
 accuracy_m double precision NOT NULL CHECK(accuracy_m BETWEEN 0 AND 100000),
 captured_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Private functions are deliberately not exposed by PostgREST. Public wrappers are invokers.
-- Each callable definer below checks the caller; unauthenticated invocation is revoked.
CREATE FUNCTION emergency_private.admin_ok() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=(SELECT auth.uid()) AND role::text IN ('admin','super_admin'));
$$;
CREATE FUNCTION emergency_private.approved(u uuid,k text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.user_roles ur JOIN public.account_role_requests ar ON ar.user_id=ur.user_id
  WHERE ur.user_id=u AND ar.status='approved' AND ar.requested_role=ur.role AND
   ((k='ambulance' AND ur.role::text='provider' AND ar.requested_view='ambulance') OR
    (k='doctor' AND ur.role::text='provider' AND ar.requested_view='medico') OR
    (k='hospital' AND ur.role::text='facility' AND ar.requested_view IN ('hub','hospital'))));
$$;
CREATE FUNCTION emergency_private.can_read(c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND (emergency_private.admin_ok() OR EXISTS(
  SELECT 1 FROM public.emergency_cases ec WHERE ec.id=c AND (ec.patient_id=(SELECT auth.uid()) OR EXISTS(
    SELECT 1 FROM emergency_private.resources r WHERE r.id IN (ec.hospital_id,ec.doctor_id,ec.ambulance_id)
      AND r.owner_id=(SELECT auth.uid()) AND emergency_private.approved(r.owner_id,r.kind)))));
$$;
CREATE FUNCTION emergency_private.distance_km(a double precision,b double precision,c double precision,d double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT 6371.0088 * 2 * asin(sqrt(least(1.0,greatest(0.0,
  power(sin(radians(c-a)/2),2)+cos(radians(a))*cos(radians(c))*power(sin(radians(d-b)/2),2)))));
$$;
CREATE FUNCTION emergency_private.eligible(r emergency_private.resources, cat text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT r.enabled AND cat=ANY(r.categories) AND emergency_private.approved(r.owner_id,r.kind)
  AND r.heartbeat_at>=clock_timestamp()-interval '90 seconds'
  AND (r.kind<>'ambulance' OR (r.lat IS NOT NULL AND r.location_at>=clock_timestamp()-interval '60 seconds'))
  AND (r.kind<>'hospital' OR EXISTS(SELECT 1 FROM public.hospitals h WHERE h.id=r.hospital_ref AND h.emergency));
$$;
CREATE FUNCTION emergency_private.event(c uuid, label text, details jsonb DEFAULT '{}') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ec public.emergency_cases; eid uuid; v bigint;
BEGIN
 UPDATE public.emergency_cases SET version=version+1,updated_at=clock_timestamp() WHERE id=c RETURNING * INTO ec;
 IF NOT FOUND THEN RAISE EXCEPTION 'Case missing'; END IF;
 INSERT INTO public.emergency_events(case_id,version,event,actor_id,detail)
 VALUES(c,ec.version,label,(SELECT auth.uid()),details) RETURNING id INTO eid;
 INSERT INTO public.emergency_notifications(user_id,case_id,event_id,dedupe_key,title)
 SELECT uid,c,eid,eid::text,label FROM (
   SELECT ec.patient_id AS uid UNION SELECT r.owner_id FROM emergency_private.resources r
   WHERE r.id IN(ec.hospital_id,ec.doctor_id,ec.ambulance_id)
   UNION SELECT ur.user_id FROM public.user_roles ur WHERE ec.needs_attention AND ur.role::text IN('admin','super_admin')
 ) recipients ON CONFLICT(user_id,dedupe_key) DO NOTHING;
END $$;
CREATE FUNCTION emergency_private.offer(c public.emergency_cases,r emergency_private.resources,s text,expiry timestamptz DEFAULT NULL,dist double precision DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE oid uuid;
BEGIN
 IF r.owner_id=c.patient_id THEN RETURN; END IF;
 INSERT INTO public.emergency_offers(case_id,resource_id,recipient_id,kind,category,stage,expires_at,distance_km)
 VALUES(c.id,r.id,r.owner_id,r.kind,c.category,s,expiry,dist)
 ON CONFLICT(case_id,resource_id) DO NOTHING RETURNING id INTO oid;
 IF oid IS NOT NULL THEN
  PERFORM emergency_private.event(c.id,'offer_created',jsonb_build_object('kind',r.kind,'offer_id',oid));
  INSERT INTO public.emergency_notifications(user_id,case_id,dedupe_key,title)
   VALUES(r.owner_id,c.id,'offer:'||oid::text,'New emergency request') ON CONFLICT DO NOTHING;
 END IF;
END $$;
CREATE FUNCTION emergency_private.dispatch(c_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.emergency_cases; r emergency_private.resources; km double precision; nr integer;
BEGIN
 SELECT * INTO c FROM public.emergency_cases WHERE id=c_id FOR UPDATE;
 IF NOT FOUND OR c.state<>'open' THEN RETURN; END IF;
 UPDATE public.emergency_cases SET dispatch_checked_at=clock_timestamp() WHERE id=c.id;
 IF c.pickup_lat IS NULL THEN RETURN; END IF;
 nr:=least(15,4+greatest(0,floor(extract(epoch FROM(clock_timestamp()-c.search_started_at))/60)::integer));
 IF nr>c.radius_km AND (c.hospital_id IS NULL OR (c.transport='ambulance' AND c.ambulance_id IS NULL)) THEN
  UPDATE public.emergency_cases SET radius_km=nr WHERE id=c.id; c.radius_km:=nr;
  PERFORM emergency_private.event(c.id,'search_expanded',jsonb_build_object('radius_km',nr));
 END IF;
 FOR r IN SELECT * FROM emergency_private.resources re WHERE
  ((re.kind='hospital' AND c.hospital_id IS NULL) OR (re.kind='ambulance' AND c.transport='ambulance' AND c.ambulance_id IS NULL))
  AND emergency_private.eligible(re,c.category)
 LOOP
  IF r.kind='ambulance' AND EXISTS(SELECT 1 FROM public.emergency_cases ec WHERE ec.ambulance_id=r.id AND ec.state='open') THEN CONTINUE; END IF;
  km:=emergency_private.distance_km(c.pickup_lat,c.pickup_lng,r.lat,r.lng);
  IF km<=c.radius_km THEN PERFORM emergency_private.offer(c,r,'area',NULL,km); END IF;
 END LOOP;
 IF c.hospital_id IS NOT NULL AND c.doctor_id IS NULL THEN
  IF c.doctor_stage='wait_hospital' THEN
   SELECT re.* INTO r FROM emergency_private.resources re JOIN emergency_private.roster ro ON ro.doctor_id=re.id
    WHERE ro.hospital_id=c.hospital_id AND ro.category=c.category AND ro.preferred AND ro.enabled
     AND emergency_private.eligible(re,c.category)
     AND NOT EXISTS(SELECT 1 FROM public.emergency_cases busy WHERE busy.doctor_id=re.id AND busy.state='open') LIMIT 1;
   IF FOUND THEN
    c.doctor_stage:='preferred';
    c.preferred_deadline:=clock_timestamp()+make_interval(secs=>(SELECT preferred_seconds FROM emergency_private.settings));
    UPDATE public.emergency_cases SET doctor_stage=c.doctor_stage,preferred_deadline=c.preferred_deadline WHERE id=c.id;
    PERFORM emergency_private.offer(c,r,'preferred',c.preferred_deadline);
   ELSE
    c.doctor_stage:='broadcast'; UPDATE public.emergency_cases SET doctor_stage='broadcast',preferred_deadline=NULL WHERE id=c.id;
    PERFORM emergency_private.event(c.id,'specialist_broadcast_started');
   END IF;
  END IF;
  IF c.doctor_stage='preferred' AND (c.preferred_deadline<=clock_timestamp() OR NOT EXISTS(
    SELECT 1 FROM public.emergency_offers o JOIN emergency_private.resources re ON re.id=o.resource_id
     WHERE o.case_id=c.id AND o.kind='doctor' AND o.stage='preferred' AND o.status='offered' AND emergency_private.eligible(re,c.category))) THEN
   UPDATE public.emergency_offers SET status='expired',responded_at=clock_timestamp() WHERE case_id=c.id AND kind='doctor' AND stage='preferred' AND status='offered';
   UPDATE public.emergency_cases SET doctor_stage='broadcast',preferred_deadline=NULL WHERE id=c.id;
   c.doctor_stage:='broadcast';
   PERFORM emergency_private.event(c.id,'specialist_broadcast_started');
  END IF;
  IF c.doctor_stage='broadcast' THEN
   FOR r IN SELECT re.* FROM emergency_private.resources re JOIN emergency_private.roster ro ON ro.doctor_id=re.id
    WHERE ro.hospital_id=c.hospital_id AND ro.category=c.category AND ro.enabled AND emergency_private.eligible(re,c.category)
      AND NOT EXISTS(SELECT 1 FROM public.emergency_cases busy WHERE busy.doctor_id=re.id AND busy.state='open')
   LOOP PERFORM emergency_private.offer(c,r,'broadcast'); END LOOP;
  END IF;
 END IF;
 IF c.radius_km=15 AND NOT c.needs_attention AND (c.hospital_id IS NULL OR (c.transport='ambulance' AND c.ambulance_id IS NULL)) THEN
  UPDATE public.emergency_cases SET needs_attention=true WHERE id=c.id;
  PERFORM emergency_private.event(c.id,'operator_attention_required',jsonb_build_object('reason','No assignment at maximum search radius'));
 END IF;
END $$;

CREATE FUNCTION emergency_private.snapshot(c_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.emergency_cases; result jsonb;
BEGIN
 IF NOT emergency_private.can_read(c_id) THEN RAISE EXCEPTION 'Case access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.emergency_cases WHERE id=c_id;
 SELECT to_jsonb(c)||jsonb_build_object(
 'hospital',(SELECT jsonb_build_object('id',r.id,'label',r.label,'lat',r.lat,'lng',r.lng) FROM emergency_private.resources r WHERE r.id=c.hospital_id),
 'doctor',(SELECT jsonb_build_object('id',r.id,'label',r.label) FROM emergency_private.resources r WHERE r.id=c.doctor_id),
 'ambulance',(SELECT jsonb_build_object('id',r.id,'label',r.label) FROM emergency_private.resources r WHERE r.id=c.ambulance_id),
 'position',CASE WHEN c.state='open' AND c.ambulance_status<>'handed_over' THEN (SELECT to_jsonb(p) FROM public.emergency_positions p WHERE p.case_id=c.id) ELSE NULL END,
 'events',COALESCE((SELECT jsonb_agg(e ORDER BY e.version) FROM (SELECT event,version,created_at,detail FROM public.emergency_events WHERE case_id=c.id ORDER BY version DESC LIMIT 100)e),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;

-- Single authenticated command boundary: identity is ALWAYS auth.uid(), never p.user_id.
CREATE FUNCTION emergency_private.command(action text,p jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<cmd>>
DECLARE u uuid:=(SELECT auth.uid()); c public.emergency_cases; r emergency_private.resources;
 o public.emergency_offers; h public.hospitals; existing uuid; other emergency_private.resources;
 lat double precision; lng double precision; phone text; dest text; k text; label text; key text;
 target uuid; stamp timestamptz; before_status text; updated_count integer; legacy_open boolean;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p->>'expected_actor' IS NOT NULL AND p->>'expected_actor'<>u::text THEN RAISE EXCEPTION 'Account changed; reopen the case' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p)<>'object' OR octet_length(p::text)>16000 THEN RAISE EXCEPTION 'Invalid command payload'; END IF;
 IF action='mark_read' THEN
  UPDATE public.emergency_notifications SET read_at=clock_timestamp() WHERE id=(p->>'id')::uuid AND user_id=u;
  RETURN '{}'::jsonb;
 END IF;
 IF action='configure_resource' THEN
  IF NOT emergency_private.admin_ok() THEN RAISE EXCEPTION 'Only an existing administrator can configure operational resources' USING ERRCODE='42501'; END IF;
  k:=p->>'kind'; target:=(p->>'owner_id')::uuid;
  IF NOT emergency_private.approved(target,k) THEN RAISE EXCEPTION 'Use existing account approval first; no role is granted here' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM emergency_private.resources WHERE owner_id=target AND kind=k FOR UPDATE;
  IF FOUND AND EXISTS(SELECT 1 FROM public.emergency_cases ec WHERE ec.state='open' AND r.id IN(ec.hospital_id,ec.doctor_id,ec.ambulance_id)) THEN
   RAISE EXCEPTION 'Resolve active assignments before changing resource identity or capabilities';
  END IF;
  IF k='hospital' THEN
   SELECT * INTO h FROM public.hospitals WHERE id=(p->>'hospital_ref')::uuid;
   IF NOT FOUND OR h.lat IS NULL OR h.lng IS NULL THEN RAISE EXCEPTION 'Select a real hospital with saved coordinates'; END IF;
  END IF;
  INSERT INTO emergency_private.resources(owner_id,kind,label,hospital_ref,categories,lat,lng,location_at)
   VALUES(target,k,CASE WHEN k='hospital' THEN h.name ELSE btrim(p->>'label') END,h.id,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'categories','[]'::jsonb))),h.lat,h.lng,CASE WHEN h.id IS NOT NULL THEN clock_timestamp() ELSE NULL END)
   ON CONFLICT(owner_id,kind) DO UPDATE SET label=EXCLUDED.label,categories=EXCLUDED.categories,
     hospital_ref=EXCLUDED.hospital_ref,lat=CASE WHEN EXCLUDED.kind='hospital' THEN EXCLUDED.lat ELSE emergency_private.resources.lat END,
     lng=CASE WHEN EXCLUDED.kind='hospital' THEN EXCLUDED.lng ELSE emergency_private.resources.lng END
   RETURNING * INTO r;
  RETURN to_jsonb(r);
 END IF;
 IF action='roster' THEN
  SELECT * INTO r FROM emergency_private.resources WHERE id=(p->>'hospital_id')::uuid AND kind='hospital' FOR UPDATE;
  IF NOT FOUND OR NOT(emergency_private.admin_ok() OR (r.owner_id=u AND emergency_private.approved(u,'hospital'))) THEN RAISE EXCEPTION 'Hospital access denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO other FROM emergency_private.resources WHERE id=(p->>'doctor_id')::uuid AND kind='doctor';
  IF NOT FOUND OR NOT emergency_private.approved(other.owner_id,'doctor') OR NOT(p->>'category'=ANY(other.categories)) THEN RAISE EXCEPTION 'Choose an approved doctor with this category capability'; END IF;
  -- The hospital attests facility privileges. This is not a new account approval.
  IF COALESCE((p->>'preferred')::boolean,false) THEN
   UPDATE emergency_private.roster SET preferred=false WHERE hospital_id=r.id AND category=p->>'category';
  END IF;
  INSERT INTO emergency_private.roster(hospital_id,doctor_id,category,preferred,enabled)
   VALUES(r.id,other.id,p->>'category',COALESCE((p->>'preferred')::boolean,false),COALESCE((p->>'enabled')::boolean,true))
   ON CONFLICT(hospital_id,doctor_id,category) DO UPDATE SET preferred=EXCLUDED.preferred,enabled=EXCLUDED.enabled;
  RETURN '{}'::jsonb;
 END IF;
 IF action='enable' THEN
  PERFORM 1 FROM emergency_private.settings FOR UPDATE;
  IF NOT emergency_private.admin_ok() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
  IF COALESCE((p->>'enabled')::boolean,false) THEN
   IF to_regclass('public.ambulance_requests') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.ambulance_requests WHERE status IN (''requested'',''accepted'',''en_route'',''arrived''))' INTO legacy_open;
    IF legacy_open THEN RAISE EXCEPTION 'Resolve active legacy ambulance requests before V2 cutover'; END IF;
   END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM public.emergency_cases WHERE state='open') THEN RAISE EXCEPTION 'Resolve active V2 cases before disabling'; END IF;
  END IF;
  UPDATE emergency_private.settings SET enabled=(p->>'enabled')::boolean;
  RETURN jsonb_build_object('enabled',(p->>'enabled')::boolean);
 END IF;
 IF action='heartbeat' THEN
  SELECT * INTO r FROM emergency_private.resources WHERE owner_id=u AND kind=p->>'kind' FOR UPDATE;
  IF NOT FOUND OR NOT emergency_private.approved(u,r.kind) THEN RAISE EXCEPTION 'Resource not configured or account approval unavailable' USING ERRCODE='42501'; END IF;
  IF r.kind='ambulance' AND p->'lat' IS NOT NULL AND p->'lat'<>'null'::jsonb THEN
   lat:=(p->>'lat')::double precision; lng:=(p->>'lng')::double precision; stamp:=(p->>'captured_at')::timestamptz;
   IF lat IS NULL OR lng IS NULL OR stamp IS NULL OR stamp<clock_timestamp()-interval '60 seconds' OR stamp>clock_timestamp()+interval '5 seconds' THEN RAISE EXCEPTION 'Fresh valid ambulance GPS required'; END IF;
   UPDATE emergency_private.resources SET lat=cmd.lat,lng=cmd.lng,location_at=stamp WHERE id=r.id;
  END IF;
  UPDATE emergency_private.resources SET enabled=COALESCE((p->>'enabled')::boolean,enabled),heartbeat_at=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
  IF r.kind='hospital' THEN UPDATE public.hospitals SET emergency=r.enabled WHERE id=r.hospital_ref; END IF;
  RETURN to_jsonb(r);
 END IF;
 IF action='create' THEN
  PERFORM 1 FROM emergency_private.settings FOR SHARE;
  IF NOT(SELECT enabled FROM emergency_private.settings) THEN RAISE EXCEPTION 'Emergency V2 is not enabled. Call for help instead of waiting.'; END IF;
  IF jsonb_typeof(COALESCE(p->'triage','[]'))<>'array' THEN RAISE EXCEPTION 'Triage must be a list of question/answer pairs'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p->'triage','[]')) t
    WHERE jsonb_typeof(t)<>'object' OR jsonb_typeof(t->'question') IS DISTINCT FROM 'string'
      OR jsonb_typeof(t->'answer') IS DISTINCT FROM 'string' OR length(t->>'question')>500 OR length(t->>'answer')>1000) THEN
    RAISE EXCEPTION 'Invalid triage question or answer';
  END IF;
  -- Serialize duplicate taps from this patient; request_key survives a retry.
  PERFORM pg_advisory_xact_lock(hashtextextended('emergency-patient:'||u::text,0));
  SELECT * INTO c FROM public.emergency_cases WHERE patient_id=u AND (request_key=(p->>'request_key')::uuid OR state='open') ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN emergency_private.snapshot(c.id); END IF;
  lat:=(p->>'lat')::double precision; lng:=(p->>'lng')::double precision;
  IF (lat IS NULL)<>(lng IS NULL) THEN RAISE EXCEPTION 'Both pickup coordinates are required together'; END IF;
  IF lat IS NOT NULL THEN
   stamp:=(p->>'captured_at')::timestamptz;
   IF stamp IS NULL OR NOT isfinite(stamp) OR stamp<clock_timestamp()-interval '60 seconds' OR stamp>clock_timestamp()+interval '5 seconds' THEN RAISE EXCEPTION 'Pickup GPS expired. Retry or submit without a pin for operator confirmation.'; END IF;
  END IF;
  SELECT COALESCE(NULLIF(btrim(p->>'phone'),''),NULLIF(btrim(pr.phone),'')) INTO phone FROM public.profiles pr WHERE pr.id=u;
  IF phone IS NOT NULL AND phone !~ '^\+?[0-9 ()-]{7,24}$' THEN RAISE EXCEPTION 'Please check the contact phone number'; END IF;
  INSERT INTO public.emergency_cases(patient_id,request_key,category,triage,transport,patient_name,phone,pickup_text,
    pickup_lat,pickup_lng,pickup_accuracy_m,pickup_captured_at,location_status,ambulance_status,needs_attention)
  SELECT u,(p->>'request_key')::uuid,p->>'category',COALESCE(p->'triage','[]'),p->>'transport',
    COALESCE(NULLIF(btrim(pr.full_name),''),'Patient'),cmd.phone,COALESCE(btrim(p->>'pickup_text'),''),
    cmd.lat,cmd.lng,CASE WHEN cmd.lat IS NULL THEN NULL ELSE (p->>'accuracy_m')::double precision END,stamp,CASE WHEN cmd.lat IS NULL THEN 'needs_location' ELSE 'gps' END,
    CASE WHEN p->>'transport'='ambulance' THEN 'searching' ELSE 'not_requested' END,cmd.lat IS NULL OR cmd.phone IS NULL
  FROM public.profiles pr WHERE pr.id=u RETURNING * INTO c;
  PERFORM emergency_private.event(c.id,'sent',jsonb_build_object('location_missing',lat IS NULL,'contact_missing',phone IS NULL));
  PERFORM emergency_private.dispatch(c.id);
  RETURN emergency_private.snapshot(c.id);
 END IF;
 IF action='release_bay' THEN
  SELECT * INTO r FROM emergency_private.resources WHERE id=(p->>'hospital_id')::uuid AND kind='hospital' FOR UPDATE;
  IF NOT FOUND OR NOT(emergency_private.admin_ok() OR (r.owner_id=u AND emergency_private.approved(u,'hospital'))) THEN RAISE EXCEPTION 'Hospital access denied' USING ERRCODE='42501'; END IF;
  key:=lower(regexp_replace(btrim(p->>'label'),'\s+',' ','g'));
  IF EXISTS(SELECT 1 FROM emergency_private.bays b JOIN public.emergency_cases ec ON ec.id=b.case_id WHERE b.hospital_id=r.id AND b.label_key=key AND ec.state='open') THEN RAISE EXCEPTION 'Cannot release a bay reserved for an active case'; END IF;
  SELECT b.case_id INTO existing FROM emergency_private.bays b WHERE b.hospital_id=r.id AND b.label_key=key;
  UPDATE emergency_private.bays SET state='available',case_id=NULL WHERE hospital_id=r.id AND label_key=key;
  IF existing IS NOT NULL THEN PERFORM emergency_private.event(existing,'bay_released',jsonb_build_object('label',p->>'label')); END IF;
  RETURN '{}'::jsonb;
 END IF;
 -- All remaining case operations serialize on the same case row.
 SELECT * INTO c FROM public.emergency_cases WHERE id=(p->>'case_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Case not found or unavailable'; END IF;
 IF action='accept' OR action='decline' THEN
  SELECT * INTO o FROM public.emergency_offers WHERE id=(p->>'offer_id')::uuid AND case_id=c.id AND recipient_id=u;
  IF NOT FOUND THEN RAISE EXCEPTION 'No offer for this account' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM emergency_private.resources WHERE id=o.resource_id FOR UPDATE;
  IF NOT emergency_private.approved(u,r.kind) THEN RAISE EXCEPTION 'Existing approval required' USING ERRCODE='42501'; END IF;
  IF action='accept' AND ((r.kind='hospital' AND c.hospital_id=r.id) OR(r.kind='doctor' AND c.doctor_id=r.id) OR(r.kind='ambulance' AND c.ambulance_id=r.id)) THEN RETURN emergency_private.snapshot(c.id); END IF;
  IF c.state<>'open' OR o.status<>'offered' OR (o.expires_at IS NOT NULL AND o.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'Offer expired, declined or already assigned' USING ERRCODE='P0001'; END IF;
  IF action='decline' THEN
   UPDATE public.emergency_offers SET status='declined',responded_at=clock_timestamp() WHERE id=o.id;
   PERFORM emergency_private.event(c.id,'offer_declined',jsonb_build_object('kind',r.kind));
   PERFORM emergency_private.dispatch(c.id); RETURN '{}'::jsonb;
  END IF;
  IF emergency_private.eligible(r,c.category) IS NOT TRUE OR r.owner_id=c.patient_id THEN RAISE EXCEPTION 'Resource is off duty, stale, ineligible or the patient account' USING ERRCODE='42501'; END IF;
  IF r.kind='hospital' THEN
   IF c.hospital_id IS NOT NULL THEN RAISE EXCEPTION 'Another hospital already accepted'; END IF;
   UPDATE public.emergency_cases SET hospital_id=r.id,hospital_accepted_at=clock_timestamp() WHERE id=c.id;
  ELSIF r.kind='doctor' THEN
   IF c.doctor_id IS NOT NULL THEN RAISE EXCEPTION 'Another doctor already accepted'; END IF;
   IF NOT EXISTS(SELECT 1 FROM emergency_private.roster ro WHERE ro.hospital_id=c.hospital_id AND ro.doctor_id=r.id AND ro.category=c.category AND ro.enabled) OR
     NOT ((c.doctor_stage='preferred' AND o.stage='preferred' AND c.preferred_deadline>clock_timestamp()) OR(c.doctor_stage='broadcast' AND o.stage='broadcast')) THEN RAISE EXCEPTION 'Specialist offer is no longer valid for the receiving hospital'; END IF;
   UPDATE public.emergency_cases SET doctor_id=r.id,doctor_accepted_at=clock_timestamp(),doctor_stage='assigned',preferred_deadline=NULL WHERE id=c.id;
  ELSE
   IF c.transport<>'ambulance' OR c.ambulance_id IS NOT NULL OR c.pickup_lat IS NULL THEN RAISE EXCEPTION 'Ambulance already assigned, not requested, or pickup unconfirmed'; END IF;
   IF emergency_private.distance_km(c.pickup_lat,c.pickup_lng,r.lat,r.lng)>c.radius_km THEN RAISE EXCEPTION 'Ambulance moved outside the service radius'; END IF;
   UPDATE public.emergency_cases SET ambulance_id=r.id,ambulance_accepted_at=clock_timestamp(),ambulance_status='accepted' WHERE id=c.id;
  END IF;
  UPDATE public.emergency_offers SET status=CASE WHEN id=o.id THEN 'accepted' ELSE 'withdrawn' END,responded_at=clock_timestamp() WHERE case_id=c.id AND kind=r.kind AND status='offered';
  PERFORM emergency_private.event(c.id,r.kind||'_accepted');
  PERFORM emergency_private.dispatch(c.id);
  RETURN emergency_private.snapshot(c.id);
 END IF;
 IF NOT emergency_private.can_read(c.id) THEN RAISE EXCEPTION 'Case access denied' USING ERRCODE='42501'; END IF;
 IF c.state<>'open' AND action NOT IN('snapshot') THEN RAISE EXCEPTION 'Case already ended'; END IF;
 IF action='snapshot' THEN RETURN emergency_private.snapshot(c.id); END IF;
 IF action='confirm_pickup' THEN
  IF (emergency_private.admin_ok() OR c.patient_id=u) IS NOT TRUE OR c.ambulance_id IS NOT NULL THEN RAISE EXCEPTION 'Pickup can be resolved only before a crew has accepted' USING ERRCODE='42501'; END IF;
  IF NULLIF(p->>'phone','') IS NOT NULL AND p->>'phone' !~ '^\+?[0-9 ()-]{7,24}$' THEN RAISE EXCEPTION 'Please check the contact phone number'; END IF;
  lat:=(p->>'lat')::double precision;lng:=(p->>'lng')::double precision;
  IF lat IS NULL OR lng IS NULL OR length(btrim(COALESCE(p->>'reason','')))<3 THEN RAISE EXCEPTION 'Coordinates and confirmation note required'; END IF;
  -- This action resolves a missing location, not silent rerouting of an existing pin.
  IF c.pickup_lat IS NOT NULL THEN RAISE EXCEPTION 'Existing pickup cannot be silently rewritten; contact dispatch'; END IF;
  UPDATE public.emergency_cases SET pickup_lat=cmd.lat,pickup_lng=cmd.lng,pickup_accuracy_m=COALESCE((p->>'accuracy_m')::double precision,0),
    pickup_captured_at=clock_timestamp(),location_status='verified',pickup_text=COALESCE(p->>'pickup_text',pickup_text),
    phone=COALESCE(NULLIF(p->>'phone',''),emergency_cases.phone),needs_attention=(COALESCE(NULLIF(p->>'phone',''),emergency_cases.phone) IS NULL),search_started_at=clock_timestamp(),radius_km=4 WHERE id=c.id;
  PERFORM emergency_private.event(c.id,'pickup_confirmed',jsonb_build_object('note',p->>'reason'));
  PERFORM emergency_private.dispatch(c.id); RETURN emergency_private.snapshot(c.id);
 END IF;
 SELECT * INTO r FROM emergency_private.resources WHERE id=c.hospital_id;
 IF action='assign_bay' THEN
  IF (r.owner_id=u AND emergency_private.approved(u,'hospital')) IS NOT TRUE THEN RAISE EXCEPTION 'Only receiving hospital assigns its bed/bay' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM emergency_private.resources WHERE id=r.id FOR UPDATE;
  label:=btrim(p->>'label');key:=lower(regexp_replace(label,'\s+',' ','g'));
  IF label IS NULL OR length(label) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Bed/bay label required'; END IF;
  IF c.bed_label=label THEN RETURN emergency_private.snapshot(c.id); END IF;
  IF c.bed_label IS NOT NULL THEN RAISE EXCEPTION 'A bay is already reserved; do not overwrite it'; END IF;
  INSERT INTO emergency_private.bays(hospital_id,label_key,label,state) VALUES(r.id,key,label,'available') ON CONFLICT DO NOTHING;
  UPDATE emergency_private.bays SET case_id=c.id,state='reserved' WHERE hospital_id=r.id AND label_key=key AND state='available' AND case_id IS NULL;
  GET DIAGNOSTICS updated_count=ROW_COUNT;
  IF updated_count<>1 THEN RAISE EXCEPTION 'This bed/bay is already reserved, occupied or being cleaned'; END IF;
  UPDATE public.emergency_cases SET bed_label=label,bed_assigned_at=clock_timestamp() WHERE id=c.id;
  PERFORM emergency_private.event(c.id,'bed_assigned',jsonb_build_object('label',label));
 ELSIF action='ambulance_status' THEN
  SELECT * INTO r FROM emergency_private.resources WHERE id=c.ambulance_id;
  IF (r.owner_id=u AND emergency_private.approved(u,'ambulance')) IS NOT TRUE THEN RAISE EXCEPTION 'Assigned ambulance only' USING ERRCODE='42501'; END IF;
  dest:=p->>'status';
  IF c.ambulance_status=dest THEN RETURN emergency_private.snapshot(c.id); END IF;
  IF NOT((c.ambulance_status='accepted' AND dest='en_route') OR(c.ambulance_status='en_route' AND dest='arrived') OR
   (c.ambulance_status='arrived' AND dest='transporting' AND c.hospital_id IS NOT NULL) OR(c.ambulance_status='transporting' AND dest='handed_over')) THEN RAISE EXCEPTION 'Invalid trip progression or receiving hospital still unassigned'; END IF;
  UPDATE public.emergency_cases SET ambulance_status=dest,
   en_route_at=CASE WHEN dest='en_route' THEN clock_timestamp() ELSE en_route_at END,
   pickup_arrived_at=CASE WHEN dest='arrived' THEN clock_timestamp() ELSE pickup_arrived_at END,
   transporting_at=CASE WHEN dest='transporting' THEN clock_timestamp() ELSE transporting_at END,
   handed_over_at=CASE WHEN dest='handed_over' THEN clock_timestamp() ELSE handed_over_at END WHERE id=c.id;
  PERFORM emergency_private.event(c.id,CASE WHEN dest='en_route' THEN 'ambulance_en_route' WHEN dest='arrived' THEN 'ambulance_arrived' ELSE dest END);
 ELSIF action='admit' THEN
  IF (r.owner_id=u AND emergency_private.approved(u,'hospital')) IS NOT TRUE THEN RAISE EXCEPTION 'Only the receiving hospital confirms admission' USING ERRCODE='42501'; END IF;
  IF c.transport='ambulance' AND c.ambulance_status<>'handed_over' THEN RAISE EXCEPTION 'Record ambulance handover before confirming admission'; END IF;
  IF length(btrim(COALESCE(p->>'note','')))<3 THEN RAISE EXCEPTION 'Admission/handover confirmation note required'; END IF;
  UPDATE public.emergency_cases SET state='admitted',admitted_at=clock_timestamp(),doctor_stage=CASE WHEN doctor_id IS NULL THEN 'stopped' ELSE doctor_stage END WHERE id=c.id;
  UPDATE emergency_private.bays SET state='occupied' WHERE case_id=c.id;
  UPDATE public.emergency_offers SET status='withdrawn',responded_at=clock_timestamp() WHERE case_id=c.id AND status='offered';
  PERFORM emergency_private.event(c.id,'admitted',jsonb_build_object('note',p->>'note'));
 ELSIF action='cancel' THEN
  IF NOT(emergency_private.admin_ok() OR c.patient_id=u) THEN RAISE EXCEPTION 'Patient or administrator cancellation required' USING ERRCODE='42501'; END IF;
  IF c.ambulance_status IN('transporting','handed_over') AND NOT emergency_private.admin_ok() THEN RAISE EXCEPTION 'Patient onboard: contact crew/dispatch; only an operator can close this case'; END IF;
  IF length(btrim(COALESCE(p->>'reason','')))<3 THEN RAISE EXCEPTION 'Cancellation reason required'; END IF;
  UPDATE public.emergency_cases SET state='cancelled',cancelled_at=clock_timestamp(),cancellation_reason=left(p->>'reason',500) WHERE id=c.id;
  UPDATE public.emergency_offers SET status='withdrawn',responded_at=clock_timestamp() WHERE case_id=c.id AND status='offered';
  UPDATE emergency_private.bays SET state='cleaning' WHERE case_id=c.id;
  PERFORM emergency_private.event(c.id,'cancelled',jsonb_build_object('reason',p->>'reason'));
 ELSIF action='position' THEN
  SELECT * INTO r FROM emergency_private.resources WHERE id=c.ambulance_id;
  IF (r.owner_id=u AND emergency_private.approved(u,'ambulance')) IS NOT TRUE OR c.ambulance_status='handed_over' THEN RAISE EXCEPTION 'Active assigned ambulance only' USING ERRCODE='42501'; END IF;
  stamp:=(p->>'captured_at')::timestamptz;
  IF stamp IS NULL OR NOT isfinite(stamp) OR stamp<clock_timestamp()-interval '60 seconds' OR stamp>clock_timestamp()+interval '5 seconds' THEN RAISE EXCEPTION 'Stale/future location rejected'; END IF;
  INSERT INTO public.emergency_positions(case_id,resource_id,lat,lng,accuracy_m,captured_at)
   VALUES(c.id,r.id,(p->>'lat')::double precision,(p->>'lng')::double precision,(p->>'accuracy_m')::double precision,stamp)
   ON CONFLICT(case_id) DO UPDATE SET lat=EXCLUDED.lat,lng=EXCLUDED.lng,accuracy_m=EXCLUDED.accuracy_m,captured_at=EXCLUDED.captured_at,received_at=clock_timestamp()
   WHERE emergency_positions.resource_id=EXCLUDED.resource_id AND emergency_positions.captured_at<EXCLUDED.captured_at;
  RETURN jsonb_build_object('received_at',(SELECT received_at FROM public.emergency_positions WHERE case_id=c.id));
 ELSE RAISE EXCEPTION 'Unknown emergency command'; END IF;
 RETURN emergency_private.snapshot(c.id);
END $$;

CREATE FUNCTION emergency_private.dashboard(p_kind text DEFAULT 'patient') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=(SELECT auth.uid()); is_admin boolean:=emergency_private.admin_ok(); result jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_kind NOT IN('patient','hospital','doctor','ambulance','admin') THEN RAISE EXCEPTION 'Unknown portal'; END IF;
 IF p_kind='admin' AND NOT is_admin THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF p_kind NOT IN('patient','admin') AND NOT emergency_private.approved(u,p_kind) THEN RAISE EXCEPTION 'This account has no approved access to this responder portal' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'user_id',u,'admin',is_admin,
  'enabled',(SELECT enabled FROM emergency_private.settings),
  'worker_checked_at',(SELECT worker_checked_at FROM emergency_private.settings),
  'profile',(SELECT jsonb_build_object('name',full_name,'phone',phone) FROM public.profiles WHERE id=u),
  'resources',COALESCE((SELECT jsonb_agg(r ORDER BY r.kind,r.label) FROM emergency_private.resources r WHERE (p_kind='admin' AND is_admin) OR (r.owner_id=u AND r.kind=p_kind)),'[]'),
  'offers',COALESCE((SELECT jsonb_agg(t ORDER BY t.created_at) FROM (
    SELECT o.*,h.label AS hospital_label FROM public.emergency_offers o JOIN public.emergency_cases c ON c.id=o.case_id
     LEFT JOIN emergency_private.resources h ON h.id=c.hospital_id
    WHERE o.recipient_id=u AND o.kind=p_kind AND o.status='offered' AND c.state='open'
      AND (o.expires_at IS NULL OR o.expires_at>clock_timestamp()) ORDER BY o.created_at LIMIT 100)t),'[]'),
  'cases',COALESCE((SELECT jsonb_agg(emergency_private.snapshot(q.id) ORDER BY q.created_at DESC) FROM (
    SELECT c.id,c.created_at FROM public.emergency_cases c WHERE
     (p_kind='admin' AND is_admin) OR(p_kind='patient' AND c.patient_id=u) OR EXISTS(
      SELECT 1 FROM emergency_private.resources r WHERE r.owner_id=u AND r.kind=p_kind AND r.id IN(c.hospital_id,c.doctor_id,c.ambulance_id))
    ORDER BY (c.state='open') DESC,c.created_at DESC LIMIT 50)q),'[]'),
  'notifications',COALESCE((SELECT jsonb_agg(t ORDER BY t.created_at DESC) FROM (
    SELECT * FROM public.emergency_notifications WHERE user_id=u ORDER BY created_at DESC LIMIT 30)t),'[]'),
  'hospitals',CASE WHEN p_kind='admin' AND is_admin THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'lat',lat,'lng',lng,'emergency',emergency)) FROM public.hospitals),'[]') ELSE '[]'::jsonb END,
  'accounts',CASE WHEN p_kind='admin' AND is_admin THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'view',a.requested_view,'role',a.requested_role)) FROM public.account_role_requests a JOIN public.profiles p ON p.id=a.user_id WHERE a.status='approved'),'[]') ELSE '[]'::jsonb END,
  'doctors',CASE WHEN p_kind IN('hospital','admin') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'label',r.label,'categories',r.categories)) FROM emergency_private.resources r WHERE r.kind='doctor' AND emergency_private.approved(r.owner_id,'doctor')),'[]') ELSE '[]'::jsonb END,
  'roster',COALESCE((SELECT jsonb_agg(ro) FROM emergency_private.roster ro WHERE(p_kind='admin' AND is_admin) OR EXISTS(SELECT 1 FROM emergency_private.resources r WHERE r.id=ro.hospital_id AND r.owner_id=u)),'[]'),
  'bays',COALESCE((SELECT jsonb_agg(b) FROM emergency_private.bays b WHERE(p_kind='admin' AND is_admin) OR EXISTS(SELECT 1 FROM emergency_private.resources r WHERE r.id=b.hospital_id AND r.owner_id=u)),'[]')
 ) INTO result;
 RETURN result;
END $$;
-- Service-only worker. No client timer drives escalation; each selected case is row locked.
CREATE FUNCTION emergency_private.tick() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c record; n integer:=0;
BEGIN
 UPDATE emergency_private.settings SET worker_checked_at=clock_timestamp();
 IF NOT(SELECT enabled FROM emergency_private.settings) THEN RETURN 0; END IF;
 FOR c IN SELECT id FROM public.emergency_cases WHERE state='open' ORDER BY dispatch_checked_at NULLS FIRST,created_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  PERFORM emergency_private.dispatch(c.id); n:=n+1;
 END LOOP;
 RETURN n;
END $$;
-- Block old ambulance-only creation after V2 cutover so two isolated queues cannot dispatch the same crew.
CREATE FUNCTION emergency_private.legacy_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM emergency_private.settings FOR SHARE;
 IF (SELECT enabled FROM emergency_private.settings) THEN
  IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND OLD.status='requested' AND NEW.status='accepted') THEN
   RAISE EXCEPTION 'Emergency dispatch upgraded. Refresh/update this app before creating or accepting new cases.';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ BEGIN
 IF to_regclass('public.ambulance_requests') IS NOT NULL THEN
  CREATE TRIGGER emergency_v2_legacy_guard BEFORE INSERT OR UPDATE ON public.ambulance_requests
   FOR EACH ROW EXECUTE FUNCTION emergency_private.legacy_guard();
 END IF;
END $$;
CREATE FUNCTION emergency_private.offer_read(recipient uuid,k text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND (emergency_private.admin_ok() OR(recipient=(SELECT auth.uid()) AND emergency_private.approved(recipient,k)));
$$;
-- Public RPC wrappers remain SECURITY INVOKER. All mutation policy lives in checked private commands.
CREATE FUNCTION public.emergency_command(p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT emergency_private.command(p_action,p_payload); $$;
CREATE FUNCTION public.emergency_dashboard(p_kind text DEFAULT 'patient') RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT emergency_private.dashboard(p_kind); $$;
CREATE FUNCTION public.emergency_snapshot(p_case_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT emergency_private.snapshot(p_case_id); $$;
CREATE FUNCTION public.emergency_run_due() RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT emergency_private.tick(); $$;

REVOKE ALL ON ALL TABLES IN SCHEMA emergency_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA emergency_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION emergency_private.command(text,jsonb),emergency_private.dashboard(text),emergency_private.snapshot(uuid),
 emergency_private.can_read(uuid),emergency_private.offer_read(uuid,text) TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA emergency_private TO service_role;
REVOKE ALL ON FUNCTION public.emergency_command(text,jsonb),public.emergency_dashboard(text),public.emergency_snapshot(uuid),public.emergency_run_due() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.emergency_command(text,jsonb),public.emergency_dashboard(text),public.emergency_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emergency_run_due() TO service_role;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['emergency_cases','emergency_offers','emergency_events','emergency_notifications','emergency_positions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tab);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',tab);
 END LOOP;
 -- Defense in depth: private-schema tables are not API exposed and have no client grants/policies.
 FOREACH tab IN ARRAY ARRAY['resources','roster','bays','settings'] LOOP
  EXECUTE format('ALTER TABLE emergency_private.%I ENABLE ROW LEVEL SECURITY',tab);
 END LOOP;
END $$;
CREATE POLICY emergency_cases_participants ON public.emergency_cases FOR SELECT TO authenticated USING(emergency_private.can_read(id));
CREATE POLICY emergency_offers_owner ON public.emergency_offers FOR SELECT TO authenticated USING(emergency_private.offer_read(recipient_id,kind));
CREATE POLICY emergency_events_participants ON public.emergency_events FOR SELECT TO authenticated USING(emergency_private.can_read(case_id));
CREATE POLICY emergency_notifications_owner ON public.emergency_notifications FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY emergency_positions_participants ON public.emergency_positions FOR SELECT TO authenticated USING(
 emergency_private.can_read(case_id) AND EXISTS(SELECT 1 FROM public.emergency_cases c WHERE c.id=case_id AND c.state='open' AND c.ambulance_status<>'handed_over'));
DO $$ DECLARE tab text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  FOREACH tab IN ARRAY ARRAY['emergency_cases','emergency_offers','emergency_notifications','emergency_positions'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=tab) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',tab);
   END IF;
  END LOOP;
 END IF;
END $$;
COMMENT ON TABLE public.emergency_positions IS 'Latest assigned-crew GPS only. Visibility ends after handover/admission/cancellation. Schedule a retention policy. Foreground web tracking is not native background tracking.';
COMMENT ON TABLE public.emergency_notifications IS 'Transactional in-app notifications only. This table does not certify delivery of OS push, SMS or voice calls.';
NOTIFY pgrst,'reload schema';
COMMIT;

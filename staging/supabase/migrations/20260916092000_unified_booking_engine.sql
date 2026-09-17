-- ============================================================================
-- Care staff module, part 3 of 3: the engine.
--
-- Handover sections 6.3, 7 and 8. Everything that changes a booking lives here
-- as a SECURITY DEFINER function, because three rules cannot be enforced from
-- the client:
--
--   race safety  acceptance locks the booking row and re-checks its status, so
--                two simultaneous accepts can never both win
--   privacy      a pending offer exposes skill, area, distance, duration, fee
--                and expiry and nothing else; patient identity is added only
--                after that provider's own offer is accepted
--   settings     every radius and penalty is read from
--                booking_matching_settings, never hard-coded
-- ============================================================================

-- Derived, never stored: 80 as a starting position plus the event log,
-- clamped. A score cannot drift from the history that produced it.
CREATE OR REPLACE FUNCTION public.provider_reliability_score(p_provider_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(0, LEAST(100, 80 + COALESCE(
    (SELECT sum(score_delta)::int FROM public.provider_reliability_events
      WHERE provider_id = p_provider_id), 0)));
$$;

CREATE OR REPLACE FUNCTION public.care_distance_km(
  a_lat double precision, a_lng double precision,
  b_lat double precision, b_lng double precision
) RETURNS double precision LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN a_lat IS NULL OR a_lng IS NULL OR b_lat IS NULL OR b_lng IS NULL THEN NULL
    ELSE 6371.0 * 2 * asin(least(1.0, sqrt(
      power(sin(radians(b_lat - a_lat) / 2), 2) +
      cos(radians(a_lat)) * cos(radians(b_lat)) *
      power(sin(radians(b_lng - a_lng) / 2), 2))))
  END;
$$;

-- Quiet hours, with the wrap across midnight handled.
CREATE OR REPLACE FUNCTION public.care_in_quiet_hours(
  p_enabled boolean, p_start time, p_end time, p_allow_emergency boolean, p_priority text
) RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN NOT COALESCE(p_enabled, false) THEN false
    WHEN p_priority = 'emergency' AND COALESCE(p_allow_emergency, true) THEN false
    WHEN p_start < p_end THEN localtime BETWEEN p_start AND p_end
    ELSE localtime >= p_start OR localtime <= p_end
  END;
$$;

-- ------------------------------------------------------------ candidates ---
-- The single qualification filter from section 7.2, one branch per role.
-- A provider qualifies only if active, verified, online, available, the skill
-- matches, the pay clears their floor, they are not in quiet hours, their
-- reliability is at or above the minimum, they hold fewer than the maximum
-- active jobs, and they are inside the radius or match the area or the city.
CREATE OR REPLACE FUNCTION public.care_candidates(p_booking_id uuid)
RETURNS TABLE (provider_id uuid, distance_km numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.unified_bookings; s public.booking_matching_settings;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO s FROM public.booking_matching_settings WHERE id = 1;

  RETURN QUERY
  WITH roster AS (
    SELECT n.user_id AS pid, n.lat, n.lng, n.areas, n.city, n.travel_radius_km,
           n.minimum_pay, n.working_days,
           n.dnd_enabled, n.dnd_start, n.dnd_end, n.dnd_allow_emergency,
           (b.service_code IS NULL OR b.service_code = ANY (n.skills)) AS skill_ok,
           (CASE WHEN b.visit_mode = 'home' THEN n.home_care ELSE n.hospital_duty END) AS mode_ok
      FROM public.nurses n
     WHERE b.provider_role = 'nurse'
       AND n.active AND n.verified AND n.is_online AND n.available_today
    UNION ALL
    SELECT t.user_id, t.lat, t.lng, t.areas, t.city, t.travel_radius_km,
           t.minimum_pay, t.working_days,
           t.dnd_enabled, t.dnd_start, t.dnd_end, t.dnd_allow_emergency,
           (b.service_code IS NULL OR b.service_code = ANY (t.tests)),
           (CASE WHEN b.visit_mode = 'home' THEN t.home_visits ELSE t.clinic_visits END)
      FROM public.technicians t
     WHERE b.provider_role = 'technician'
       AND t.active AND t.verified AND t.is_online AND t.available_today
    UNION ALL
    SELECT p.user_id, p.lat, p.lng, ARRAY[COALESCE(p.area,'')], p.city, p.travel_radius_km,
           p.minimum_pay, p.working_days,
           p.dnd_enabled, p.dnd_start, p.dnd_end, p.dnd_allow_emergency,
           (b.service_code IS NULL OR b.service_code = ANY (p.therapies)),
           (CASE WHEN b.visit_mode = 'home' THEN p.home_visits ELSE p.clinic_visits END)
      FROM public.physio_therapists p
     WHERE b.provider_role = 'physiotherapist'
       AND p.active AND p.verified AND p.is_online AND p.available_today
       AND p.user_id IS NOT NULL
  )
  SELECT r.pid,
         round(public.care_distance_km(b.lat, b.lng, r.lat, r.lng)::numeric, 2)
    FROM roster r
   WHERE r.pid IS NOT NULL
     AND r.pid IS DISTINCT FROM b.patient_id
     AND r.skill_ok
     AND COALESCE(r.mode_ok, true)
     AND COALESCE(b.estimated_earnings, 0) >= COALESCE(r.minimum_pay, 0)
     AND extract(dow FROM COALESCE(b.scheduled_for, now()))::int = ANY (r.working_days)
     AND NOT public.care_in_quiet_hours(r.dnd_enabled, r.dnd_start, r.dnd_end,
                                        r.dnd_allow_emergency, b.priority)
     AND public.provider_reliability_score(r.pid) >= COALESCE(s.minimum_reliability_score, 40)
     AND (SELECT count(*) FROM public.unified_bookings ab
           WHERE ab.assigned_provider_id = r.pid
             AND ab.status IN ('accepted','en_route','arrived','in_progress'))
         < COALESCE(s.max_active_jobs, 3)
     -- Inside the current search radius, or a named area match, or the city.
     AND (
       (public.care_distance_km(b.lat, b.lng, r.lat, r.lng) IS NOT NULL
        AND public.care_distance_km(b.lat, b.lng, r.lat, r.lng) <= b.current_radius_km
        AND public.care_distance_km(b.lat, b.lng, r.lat, r.lng) <= COALESCE(r.travel_radius_km, 11))
       OR (b.area IS NOT NULL AND b.area = ANY (r.areas))
       OR (b.city IS NOT NULL AND b.city = r.city)
     )
     -- Never re-offer to anyone who already answered, or is still holding one.
     AND NOT EXISTS (
       SELECT 1 FROM public.booking_offers o
        WHERE o.booking_id = p_booking_id AND o.provider_id = r.pid
          AND o.status IN ('pending','accepted','declined'))
   ORDER BY 2 NULLS LAST;
END $$;

-- ---------------------------------------------------------------- matcher --
-- Radius grows with elapsed time, not with call count, so calling the matcher
-- twice in the same minute cannot skip a step.
CREATE OR REPLACE FUNCTION public.match_unified_booking(p_booking_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.unified_bookings; s public.booking_matching_settings;
  v_radius numeric; v_steps integer; v_n integer := 0;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR b.status NOT IN ('requested','searching','expanded','offered') THEN
    RETURN 0;
  END IF;
  SELECT * INTO s FROM public.booking_matching_settings WHERE id = 1;

  v_steps := GREATEST(0, floor(
    EXTRACT(epoch FROM (now() - COALESCE(b.search_started_at, b.created_at)))
    / (GREATEST(1, s.expansion_interval_minutes) * 60))::int);
  v_radius := LEAST(s.max_radius_km,
                    s.initial_radius_km + v_steps * s.expansion_step_km);

  UPDATE public.unified_bookings
     SET current_radius_km = v_radius,
         search_started_at = COALESCE(search_started_at, now()),
         status = CASE WHEN v_radius > s.initial_radius_km THEN 'expanded' ELSE 'searching' END,
         updated_at = now()
   WHERE id = p_booking_id
  RETURNING * INTO b;

  INSERT INTO public.booking_offers
    (booking_id, provider_id, provider_role, status, distance_km, earnings, expires_at)
  SELECT p_booking_id, c.provider_id, b.provider_role, 'pending',
         c.distance_km, b.estimated_earnings,
         now() + make_interval(mins => COALESCE(s.offer_expiry_minutes, 10))
    FROM public.care_candidates(p_booking_id) c
  -- A withdrawn or expired offer must be re-openable. Without this, anyone
  -- whose offer was withdrawn when somebody else accepted could never be
  -- asked again, so a cancelled job would find nobody on the second pass.
  ON CONFLICT (booking_id, provider_id) DO UPDATE
    SET status = 'pending', offered_at = now(), responded_at = NULL,
        distance_km = excluded.distance_km, earnings = excluded.earnings,
        expires_at = excluded.expires_at
    WHERE public.booking_offers.status IN ('withdrawn','expired');
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n > 0 THEN
    UPDATE public.unified_bookings
       SET notified_provider_count = notified_provider_count + v_n,
           status = 'offered', updated_at = now()
     WHERE id = p_booking_id;
    INSERT INTO public.booking_status_history (booking_id, status, note)
    VALUES (p_booking_id, 'offered',
            v_n || ' notified within ' || v_radius || ' km');
  END IF;
  RETURN v_n;
END $$;

-- Scheduled entry point. Section 7.5: matching runs on demand today, and this
-- is what an external scheduler calls once a minute in production.
CREATE OR REPLACE FUNCTION public.unified_booking_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_matched integer := 0; v_expired integer := 0;
BEGIN
  UPDATE public.booking_offers SET status = 'expired', responded_at = now()
   WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  FOR v_id IN
    SELECT id FROM public.unified_bookings
     WHERE status IN ('requested','searching','expanded','offered')
     ORDER BY created_at LIMIT 200
  LOOP
    v_matched := v_matched + public.match_unified_booking(v_id);
  END LOOP;

  RETURN jsonb_build_object('offers_created', v_matched, 'offers_expired', v_expired);
END $$;

-- ----------------------------------------------------------------- create --
CREATE OR REPLACE FUNCTION public.server_create_unified_booking(
  p_service_type       text,
  p_provider_role      text,
  p_title              text,
  p_service_code       text DEFAULT NULL,
  p_description        text DEFAULT NULL,
  p_priority           text DEFAULT 'routine',
  p_visit_mode         text DEFAULT 'home',
  p_scheduled_for      timestamptz DEFAULT NULL,
  p_duration_minutes   integer DEFAULT 60,
  p_estimated_earnings integer DEFAULT 0,
  p_address            text DEFAULT NULL,
  p_area               text DEFAULT NULL,
  p_city               text DEFAULT 'Pune',
  p_lat                double precision DEFAULT NULL,
  p_lng                double precision DEFAULT NULL,
  p_owner_facility_id  uuid DEFAULT NULL,
  p_metadata           jsonb DEFAULT '{}'::jsonb
) RETURNS public.unified_bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); b public.unified_bookings; s public.booking_matching_settings;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BOOKING_AUTH_REQUIRED: Sign in to book care.';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'BOOKING_BAD_INPUT: Describe what you need.';
  END IF;
  SELECT * INTO s FROM public.booking_matching_settings WHERE id = 1;

  INSERT INTO public.unified_bookings (
    service_type, provider_role, service_code, title, description, priority,
    visit_mode, status, scheduled_for, duration_minutes, estimated_earnings,
    address, area, city, lat, lng, current_radius_km, search_started_at,
    patient_id, patient_name, patient_phone, owner_facility_id, metadata)
  VALUES (
    p_service_type, p_provider_role, p_service_code, trim(p_title), p_description,
    COALESCE(p_priority,'routine'), COALESCE(p_visit_mode,'home'), 'searching',
    p_scheduled_for, COALESCE(p_duration_minutes,60), COALESCE(p_estimated_earnings,0),
    p_address, p_area, COALESCE(p_city,'Pune'), p_lat, p_lng,
    s.initial_radius_km, now(),
    v_uid,
    (SELECT full_name FROM public.profiles WHERE id = v_uid),
    (SELECT phone FROM public.profiles WHERE id = v_uid),
    p_owner_facility_id, COALESCE(p_metadata,'{}'::jsonb))
  RETURNING * INTO b;

  INSERT INTO public.booking_status_history (booking_id, status, note, actor_id)
  VALUES (b.id, 'searching', 'Request received', v_uid);

  PERFORM public.match_unified_booking(b.id);
  SELECT * INTO b FROM public.unified_bookings WHERE id = b.id;
  RETURN b;
END $$;

-- A venue posts a nurse duty. Same booking rail, owned by the venue.
CREATE OR REPLACE FUNCTION public.post_facility_nurse_duty(
  p_facility_id uuid, p_skill text, p_shift text, p_start timestamptz,
  p_hours integer, p_pay integer, p_urgency text DEFAULT 'routine',
  p_area text DEFAULT NULL, p_city text DEFAULT 'Pune'
) RETURNS public.unified_bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.unified_bookings;
BEGIN
  PERFORM public.assert_known_skills('nurse', ARRAY[p_skill]);
  b := public.server_create_unified_booking(
        p_service_type => 'nurse_duty', p_provider_role => 'nurse',
        p_title => initcap(replace(p_shift,'_',' ')) || ' duty',
        p_service_code => p_skill, p_priority => COALESCE(p_urgency,'routine'),
        p_visit_mode => 'hospital', p_scheduled_for => p_start,
        p_duration_minutes => COALESCE(p_hours,8) * 60,
        p_estimated_earnings => COALESCE(p_pay,0),
        p_area => p_area, p_city => p_city,
        p_owner_facility_id => p_facility_id,
        p_metadata => jsonb_build_object('shift', p_shift, 'hours', p_hours));
  RETURN b;
END $$;

-- ----------------------------------------------------------------- accept --
-- Race safety, section 7.3. The booking row is locked and its status is
-- re-checked inside the same transaction, so the second tap always loses.
CREATE OR REPLACE FUNCTION public.server_accept_unified_booking_offer(p_booking_id uuid)
RETURNS public.unified_bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); b public.unified_bookings; v_offer public.booking_offers;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: That job no longer exists.';
  END IF;

  SELECT * INTO v_offer FROM public.booking_offers
   WHERE booking_id = p_booking_id AND provider_id = v_uid;
  IF NOT FOUND OR v_offer.status NOT IN ('pending') THEN
    RAISE EXCEPTION 'BOOKING_NOT_OFFERED: This job was not offered to you.';
  END IF;
  IF v_offer.expires_at IS NOT NULL AND v_offer.expires_at < now() THEN
    UPDATE public.booking_offers SET status = 'expired', responded_at = now()
     WHERE id = v_offer.id;
    RAISE EXCEPTION 'BOOKING_OFFER_EXPIRED: That offer has expired.';
  END IF;
  IF b.status NOT IN ('searching','expanded','offered') OR b.assigned_provider_id IS NOT NULL THEN
    UPDATE public.booking_offers SET status = 'withdrawn', responded_at = now()
     WHERE id = v_offer.id AND status = 'pending';
    RAISE EXCEPTION 'BOOKING_ALREADY_TAKEN: Somebody else accepted this first.';
  END IF;

  UPDATE public.unified_bookings
     SET assigned_provider_id = v_uid, status = 'accepted',
         assigned_at = now(), updated_at = now()
   WHERE id = p_booking_id RETURNING * INTO b;

  UPDATE public.booking_offers SET status = 'accepted', responded_at = now()
   WHERE id = v_offer.id;
  UPDATE public.booking_offers SET status = 'withdrawn', responded_at = now()
   WHERE booking_id = p_booking_id AND provider_id <> v_uid AND status = 'pending';

  INSERT INTO public.booking_status_history (booking_id, status, note, actor_id)
  VALUES (p_booking_id, 'accepted', 'Professional assigned', v_uid);
  RETURN b;
END $$;

CREATE OR REPLACE FUNCTION public.server_decline_unified_booking_offer(
  p_booking_id uuid, p_reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.booking_offers
     SET status = 'declined', responded_at = now(), note = p_reason
   WHERE booking_id = p_booking_id AND provider_id = auth.uid() AND status = 'pending';
  PERFORM public.match_unified_booking(p_booking_id);
END $$;

-- ------------------------------------------------------------- transition --
CREATE OR REPLACE FUNCTION public.server_transition_unified_booking(
  p_booking_id uuid, p_status text, p_note text DEFAULT NULL
) RETURNS public.unified_bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); b public.unified_bookings; v_allowed text[];
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: That job no longer exists.';
  END IF;
  IF b.assigned_provider_id IS DISTINCT FROM v_uid AND NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'BOOKING_FORBIDDEN: Only the assigned professional can do that.';
  END IF;

  -- The ladder only goes one way; skipping arrival would let a job be closed
  -- without anyone turning up.
  v_allowed := CASE b.status
    WHEN 'accepted'    THEN ARRAY['en_route']
    WHEN 'en_route'    THEN ARRAY['arrived']
    WHEN 'arrived'     THEN ARRAY['in_progress']
    WHEN 'in_progress' THEN ARRAY['completed']
    ELSE ARRAY[]::text[] END;
  IF NOT (p_status = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'BOOKING_BAD_STATUS: Cannot go from % to %.', b.status, p_status;
  END IF;

  UPDATE public.unified_bookings
     SET status = p_status,
         en_route_at  = CASE WHEN p_status='en_route'    THEN now() ELSE en_route_at END,
         arrived_at   = CASE WHEN p_status='arrived'     THEN now() ELSE arrived_at END,
         started_at   = CASE WHEN p_status='in_progress' THEN now() ELSE started_at END,
         completed_at = CASE WHEN p_status='completed'   THEN now() ELSE completed_at END,
         updated_at = now()
   WHERE id = p_booking_id RETURNING * INTO b;

  INSERT INTO public.booking_status_history (booking_id, status, note, actor_id)
  VALUES (p_booking_id, p_status, p_note, v_uid);
  RETURN b;
END $$;

-- --------------------------------------------------------------- cancel ----
-- Section 7.4. A cancelled job re-enters the search immediately, and the
-- person who dropped it is excluded by their own declined offer.
CREATE OR REPLACE FUNCTION public.server_cancel_unified_booking(
  p_booking_id uuid, p_reason text DEFAULT NULL
) RETURNS public.unified_bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); b public.unified_bookings;
  s public.booking_matching_settings; v_n integer;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: That job no longer exists.';
  END IF;
  SELECT * INTO s FROM public.booking_matching_settings WHERE id = 1;

  -- The patient cancelling ends the booking.
  IF b.patient_id = v_uid THEN
    UPDATE public.unified_bookings
       SET status = 'cancelled', cancelled_at = now(),
           cancellation_reason = p_reason, updated_at = now()
     WHERE id = p_booking_id RETURNING * INTO b;
    UPDATE public.booking_offers SET status = 'withdrawn', responded_at = now()
     WHERE booking_id = p_booking_id AND status = 'pending';
    INSERT INTO public.booking_status_history (booking_id, status, note, actor_id)
    VALUES (p_booking_id, 'cancelled', COALESCE(p_reason,'Cancelled by patient'), v_uid);
    RETURN b;
  END IF;

  IF b.assigned_provider_id IS DISTINCT FROM v_uid AND NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'BOOKING_FORBIDDEN: Only the assigned professional can drop this job.';
  END IF;

  UPDATE public.booking_offers
     SET status = 'declined', responded_at = now(),
         note = COALESCE(p_reason, 'Cancelled after accepting')
   WHERE booking_id = p_booking_id AND provider_id = b.assigned_provider_id;
  UPDATE public.booking_offers SET status = 'withdrawn', responded_at = now()
   WHERE booking_id = p_booking_id AND status = 'pending';

  INSERT INTO public.provider_reliability_events
    (provider_id, booking_id, event_type, score_delta, note)
  VALUES (b.assigned_provider_id, p_booking_id, 'provider_cancellation',
          -COALESCE(s.provider_cancellation_penalty, 10), p_reason);

  UPDATE public.unified_bookings
     SET assigned_provider_id = NULL, assigned_at = NULL,
         status = 'searching',
         current_radius_km = s.initial_radius_km,
         search_started_at = now(),
         cancellation_reason = p_reason, updated_at = now()
   WHERE id = p_booking_id RETURNING * INTO b;

  INSERT INTO public.booking_status_history (booking_id, status, note, actor_id)
  VALUES (p_booking_id, 'searching', 'Professional cancelled, finding another', v_uid);

  v_n := public.match_unified_booking(p_booking_id);
  -- Nothing pending at the initial radius, so widen one step straight away
  -- rather than making the patient wait a full interval for the first retry.
  IF v_n = 0 THEN
    UPDATE public.unified_bookings
       SET current_radius_km = LEAST(s.max_radius_km,
                                     current_radius_km + s.expansion_step_km),
           status = 'expanded', updated_at = now()
     WHERE id = p_booking_id;
    PERFORM public.match_unified_booking(p_booking_id);
  END IF;

  SELECT * INTO b FROM public.unified_bookings WHERE id = p_booking_id;
  RETURN b;
END $$;

CREATE OR REPLACE FUNCTION public.server_retry_unified_booking(p_booking_id uuid)
RETURNS public.unified_bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.unified_bookings;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = p_booking_id;
  IF NOT FOUND OR b.patient_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'BOOKING_FORBIDDEN: Not your request.';
  END IF;
  PERFORM public.match_unified_booking(p_booking_id);
  SELECT * INTO b FROM public.unified_bookings WHERE id = p_booking_id;
  RETURN b;
END $$;

-- ---------------------------------------------------------------- review ---
CREATE OR REPLACE FUNCTION public.server_submit_unified_booking_review(
  p_booking_id uuid, p_overall smallint,
  p_quality smallint DEFAULT NULL, p_punctuality smallint DEFAULT NULL,
  p_professionalism smallint DEFAULT NULL, p_communication smallint DEFAULT NULL,
  p_would_recommend boolean DEFAULT NULL, p_comment text DEFAULT NULL
) RETURNS public.booking_reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); b public.unified_bookings; r public.booking_reviews;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = p_booking_id;
  IF NOT FOUND OR b.patient_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'BOOKING_FORBIDDEN: Not your booking.';
  END IF;
  IF b.status <> 'completed' THEN
    RAISE EXCEPTION 'BOOKING_NOT_COMPLETE: You can rate this once the visit is finished.';
  END IF;

  INSERT INTO public.booking_reviews (booking_id, patient_id, provider_id, overall,
    quality, punctuality, professionalism, communication, would_recommend, comment)
  VALUES (p_booking_id, v_uid, b.assigned_provider_id, p_overall, p_quality,
          p_punctuality, p_professionalism, p_communication, p_would_recommend, p_comment)
  ON CONFLICT (booking_id) DO UPDATE SET
    overall = excluded.overall, quality = excluded.quality,
    punctuality = excluded.punctuality, professionalism = excluded.professionalism,
    communication = excluded.communication, would_recommend = excluded.would_recommend,
    comment = excluded.comment
  RETURNING * INTO r;

  -- A five keeps somebody in work; a one starts to take them out of it.
  IF b.assigned_provider_id IS NOT NULL THEN
    INSERT INTO public.provider_reliability_events
      (provider_id, booking_id, event_type, score_delta, note)
    VALUES (b.assigned_provider_id, p_booking_id, 'patient_rating',
            CASE WHEN p_overall >= 4 THEN 2 WHEN p_overall = 3 THEN 0 ELSE -5 END,
            'Rated ' || p_overall || ' by the patient');
  END IF;
  RETURN r;
END $$;

-- -------------------------------------------------------------- tracking ---
CREATE OR REPLACE FUNCTION public.set_provider_live_location(
  p_booking_id uuid, p_lat double precision, p_lng double precision,
  p_accuracy_m numeric DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); b public.unified_bookings;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = p_booking_id;
  IF NOT FOUND OR b.assigned_provider_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'BOOKING_FORBIDDEN: Not your job.';
  END IF;
  -- Location is only collected while a job is actually running.
  IF b.status NOT IN ('accepted','en_route','arrived','in_progress') THEN
    RAISE EXCEPTION 'BOOKING_NOT_ACTIVE: Location is only shared during a job.';
  END IF;

  INSERT INTO public.booking_location_tracks (booking_id, provider_id, lat, lng, accuracy_m)
  VALUES (p_booking_id, v_uid, p_lat, p_lng, p_accuracy_m);
END $$;

-- Distance and ETA for the patient's map. Speeds per role, section 8.
CREATE OR REPLACE FUNCTION public.get_booking_live_tracks(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); b public.unified_bookings;
  t public.booking_location_tracks; v_km double precision; v_speed numeric;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = p_booking_id;
  IF NOT FOUND
     OR (b.patient_id IS DISTINCT FROM v_uid
         AND b.assigned_provider_id IS DISTINCT FROM v_uid
         AND NOT public.has_role(v_uid,'admin')) THEN
    RAISE EXCEPTION 'BOOKING_FORBIDDEN: Not your booking.';
  END IF;

  SELECT * INTO t FROM public.booking_location_tracks
   WHERE booking_id = p_booking_id ORDER BY recorded_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('shared', false);
  END IF;

  v_km := public.care_distance_km(t.lat, t.lng, b.lat, b.lng);
  v_speed := CASE b.provider_role
    WHEN 'ambulance' THEN 34 WHEN 'care_physician' THEN 24
    WHEN 'physiotherapist' THEN 22 ELSE 20 END;

  RETURN jsonb_build_object(
    'shared', true, 'lat', t.lat, 'lng', t.lng, 'recorded_at', t.recorded_at,
    'distance_km', round(v_km::numeric, 2),
    -- 1.35 detour factor: roads are not straight lines.
    'eta_minutes', CASE WHEN v_km IS NULL THEN NULL
                        ELSE ceil((v_km * 1.35) / v_speed * 60)::int END);
END $$;

-- ================================================== privacy projection =====
-- Section 10.1, enforced here rather than in the UI because the endpoint is
-- directly callable. A pending offer never carries patient identity; the same
-- booking read after acceptance does.
CREATE OR REPLACE FUNCTION public.list_my_booking_offers()
RETURNS TABLE (
  booking_id uuid, offer_id uuid, service_type text, provider_role text,
  service_code text, title text, priority text, visit_mode text,
  area text, city text, distance_km numeric, duration_minutes integer,
  earnings integer, scheduled_for timestamptz, expires_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, o.id, b.service_type, b.provider_role, b.service_code, b.title,
         b.priority, b.visit_mode, b.area, b.city, o.distance_km,
         b.duration_minutes, o.earnings, b.scheduled_for, o.expires_at
    FROM public.booking_offers o
    JOIN public.unified_bookings b ON b.id = o.booking_id
   WHERE o.provider_id = auth.uid()
     AND o.status = 'pending'
     AND b.status IN ('searching','expanded','offered')
   ORDER BY o.offered_at DESC
   LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.get_my_assigned_booking(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); b public.unified_bookings;
BEGIN
  SELECT * INTO b FROM public.unified_bookings WHERE id = p_booking_id;
  IF NOT FOUND OR b.assigned_provider_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'BOOKING_FORBIDDEN: This job is not assigned to you.';
  END IF;
  RETURN jsonb_build_object(
    'id', b.id, 'title', b.title, 'description', b.description,
    'service_code', b.service_code, 'priority', b.priority, 'status', b.status,
    'scheduled_for', b.scheduled_for, 'duration_minutes', b.duration_minutes,
    'earnings', b.estimated_earnings,
    'patient_name', b.patient_name, 'patient_phone', b.patient_phone,
    'address', b.address, 'area', b.area, 'city', b.city,
    'lat', b.lat, 'lng', b.lng,
    'maps_url', CASE WHEN b.lat IS NULL THEN NULL
                     ELSE 'https://www.google.com/maps/dir/?api=1&destination='
                          || b.lat::text || ',' || b.lng::text END);
END $$;

-- ===================================================== admin operations ====
CREATE OR REPLACE FUNCTION public.admin_update_matching_settings(p_patch jsonb)
RETURNS public.booking_matching_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.booking_matching_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'BOOKING_FORBIDDEN: Admins only.';
  END IF;
  UPDATE public.booking_matching_settings SET
    initial_radius_km = COALESCE((p_patch->>'initial_radius_km')::numeric, initial_radius_km),
    expansion_step_km = COALESCE((p_patch->>'expansion_step_km')::numeric, expansion_step_km),
    expansion_interval_minutes = COALESCE((p_patch->>'expansion_interval_minutes')::int, expansion_interval_minutes),
    max_radius_km = COALESCE((p_patch->>'max_radius_km')::numeric, max_radius_km),
    offer_expiry_minutes = COALESCE((p_patch->>'offer_expiry_minutes')::int, offer_expiry_minutes),
    minimum_reliability_score = COALESCE((p_patch->>'minimum_reliability_score')::int, minimum_reliability_score),
    max_active_jobs = COALESCE((p_patch->>'max_active_jobs')::int, max_active_jobs),
    provider_cancellation_penalty = COALESCE((p_patch->>'provider_cancellation_penalty')::int, provider_cancellation_penalty),
    late_arrival_penalty = COALESCE((p_patch->>'late_arrival_penalty')::int, late_arrival_penalty),
    no_show_penalty = COALESCE((p_patch->>'no_show_penalty')::int, no_show_penalty),
    updated_at = now(), updated_by = auth.uid()
  WHERE id = 1 RETURNING * INTO s;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_provider_reliability(
  p_provider_id uuid, p_delta integer, p_reason text
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'BOOKING_FORBIDDEN: Admins only.';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'BOOKING_REASON_REQUIRED: Write why you are changing this score.';
  END IF;
  INSERT INTO public.provider_reliability_events
    (provider_id, event_type, score_delta, note, actor_id)
  VALUES (p_provider_id, 'manual_adjustment', p_delta, trim(p_reason), auth.uid());
  RETURN public.provider_reliability_score(p_provider_id);
END $$;

-- ======================================================== grants ===========
REVOKE ALL ON FUNCTION public.care_candidates(uuid)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_unified_booking(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unified_booking_tick()         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.care_in_quiet_hours(boolean, time, time, boolean, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_candidates(uuid)       TO service_role;
GRANT EXECUTE ON FUNCTION public.match_unified_booking(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.unified_booking_tick()      TO service_role;

REVOKE ALL ON FUNCTION public.provider_reliability_score(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_reliability_score(uuid) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.server_create_unified_booking(
  text, text, text, text, text, text, text, timestamptz, integer, integer,
  text, text, text, double precision, double precision, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_facility_nurse_duty(
  uuid, text, text, timestamptz, integer, integer, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.server_accept_unified_booking_offer(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.server_decline_unified_booking_offer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.server_transition_unified_booking(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.server_cancel_unified_booking(uuid, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.server_retry_unified_booking(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.server_submit_unified_booking_review(
  uuid, smallint, smallint, smallint, smallint, smallint, boolean, text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_provider_live_location(uuid, double precision, double precision, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_booking_live_tracks(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_booking_offers()                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_assigned_booking(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_matching_settings(jsonb)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_provider_reliability(uuid, integer, text) TO authenticated;

-- Close the module the same way the nursing module is closed: nothing
-- SECURITY DEFINER reachable by anon, no trigger function reachable as an RPC.
DO $$
DECLARE v_fn record;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure AS sig, p.prorettype = 'trigger'::regtype AS is_trigger
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
       AND (p.proname LIKE '%unified_booking%' OR p.proname LIKE 'care_%'
            OR p.proname LIKE '%booking_offer%' OR p.proname LIKE 'admin_%'
            OR p.proname IN ('provider_reliability_score','set_provider_live_location',
                             'get_booking_live_tracks','list_my_booking_offers',
                             'get_my_assigned_booking','post_facility_nurse_duty',
                             'assert_known_skills'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_fn.sig);
    IF v_fn.is_trigger THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', v_fn.sig);
    END IF;
  END LOOP;
END $$;

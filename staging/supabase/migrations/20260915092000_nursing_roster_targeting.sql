-- ============================================================================
-- Nursing: offer the work to nurses who can actually reach the address.
--
-- Both broadcasts selected `user_roles WHERE role='provider' LIMIT 100`. There
-- is no nurse filter and no geography in that, so a radiologist in Nagpur is
-- offered a Pune nursing package and first-accept-wins lets him take it. The
-- LIMIT is also arbitrary: whichever hundred rows the planner returns.
--
-- The roster is now nurse-only, inside a radius, nearest first, and the views
-- that count as nursing are configuration rather than a literal in a function.
-- ============================================================================

ALTER TABLE public.nursing_settings
  ADD COLUMN IF NOT EXISTS roster_views text[] NOT NULL
    DEFAULT ARRAY['nurse','nursing','n_gen','n_baby'],
  ADD COLUMN IF NOT EXISTS roster_radius_km numeric NOT NULL DEFAULT 15,
  -- Widen once if nobody inside the first radius takes it.
  ADD COLUMN IF NOT EXISTS roster_radius_km_wide numeric NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS roster_limit integer NOT NULL DEFAULT 50;

CREATE OR REPLACE FUNCTION public.nursing_distance_km(
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

-- The one roster definition. p_radius_km NULL means no distance filter, which
-- is what a booking with no coordinates gets.
CREATE OR REPLACE FUNCTION public.nursing_roster(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_km  numeric,
  p_exclude    uuid[] DEFAULT '{}'::uuid[]
) RETURNS TABLE (nurse_id uuid, distance_km double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cfg AS (
    SELECT COALESCE(roster_views, ARRAY['nurse','nursing','n_gen','n_baby']) AS views,
           COALESCE(roster_limit, 50) AS lim
      FROM public.nursing_settings WHERE id = 1
  )
  SELECT c.id, c.km FROM (
    SELECT p.id,
           public.nursing_distance_km(p_lat, p_lng, p.lat, p.lng) AS km
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'provider'
      CROSS JOIN cfg
     WHERE NOT (p.id = ANY (COALESCE(p_exclude, '{}'::uuid[])))
       -- A nurse is a provider whose approved view, or whose profile view, is
       -- one of the configured nursing views. Doctors never appear here.
       AND (
         p.view = ANY (cfg.views)
         OR EXISTS (SELECT 1 FROM public.account_role_requests r
                     WHERE r.user_id = p.id AND r.status = 'approved'
                       AND r.requested_role = 'provider'
                       AND r.requested_view = ANY (cfg.views))
       )
  ) c
  CROSS JOIN cfg
  WHERE p_radius_km IS NULL
     OR c.km IS NULL          -- nurse has no coordinates yet; do not exclude her
     OR c.km <= p_radius_km
  ORDER BY c.km NULLS LAST
  LIMIT (SELECT lim FROM cfg);
$$;

-- Package broadcast, nurse-only and radius-bounded. Widens once rather than
-- leaving a paid booking with nobody to take it.
CREATE OR REPLACE FUNCTION public.broadcast_nursing_engagement(p_engagement_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_eng public.nursing_engagements; v_n integer := 0;
  v_near numeric; v_wide numeric;
BEGIN
  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = p_engagement_id;
  IF NOT FOUND OR v_eng.assignment_state <> 'seeking_nurse' THEN RETURN 0; END IF;

  SELECT roster_radius_km, roster_radius_km_wide INTO v_near, v_wide
    FROM public.nursing_settings WHERE id = 1;

  -- No coordinates on the booking means no meaningful radius; offer it to the
  -- nursing roster unfiltered rather than to nobody.
  IF v_eng.lat IS NULL OR v_eng.lng IS NULL THEN v_near := NULL; v_wide := NULL; END IF;

  INSERT INTO public.nursing_engagement_offers
    (engagement_id, nurse_id, offer_amount, days_offered)
  SELECT p_engagement_id, r.nurse_id, v_eng.total_amount, v_eng.days_scheduled
    FROM public.nursing_roster(v_eng.lat, v_eng.lng, v_near,
                               ARRAY[v_eng.patient_id]) r
  ON CONFLICT (engagement_id, nurse_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n = 0 AND v_wide IS NOT NULL THEN
    INSERT INTO public.nursing_engagement_offers
      (engagement_id, nurse_id, offer_amount, days_offered)
    SELECT p_engagement_id, r.nurse_id, v_eng.total_amount, v_eng.days_scheduled
      FROM public.nursing_roster(v_eng.lat, v_eng.lng, v_wide,
                                 ARRAY[v_eng.patient_id]) r
    ON CONFLICT (engagement_id, nurse_id) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  END IF;

  UPDATE public.nursing_engagements
     SET last_broadcast_at = now(), offers_sent = offers_sent + v_n, updated_at = now()
   WHERE id = p_engagement_id;
  RETURN v_n;
END $$;

-- Single-day cover, same roster.
CREATE OR REPLACE FUNCTION public.broadcast_nursing_visit(p_visit_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_visit public.nursing_visits; v_eng public.nursing_engagements;
  v_n integer := 0; v_near numeric; v_wide numeric;
BEGIN
  SELECT * INTO v_visit FROM public.nursing_visits WHERE id = p_visit_id;
  IF NOT FOUND OR v_visit.status <> 'seeking_cover' THEN RETURN 0; END IF;
  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = v_visit.engagement_id;

  SELECT roster_radius_km, roster_radius_km_wide INTO v_near, v_wide
    FROM public.nursing_settings WHERE id = 1;
  IF v_eng.lat IS NULL OR v_eng.lng IS NULL THEN v_near := NULL; v_wide := NULL; END IF;

  INSERT INTO public.nursing_visit_offers (visit_id, nurse_id, offer_amount)
  SELECT p_visit_id, r.nurse_id, COALESCE(v_visit.payout_amount, v_eng.day_rate, 800)
    FROM public.nursing_roster(v_eng.lat, v_eng.lng, v_near,
           ARRAY[v_eng.patient_id, v_visit.original_nurse_id]) r
  ON CONFLICT (visit_id, nurse_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n = 0 AND v_wide IS NOT NULL THEN
    INSERT INTO public.nursing_visit_offers (visit_id, nurse_id, offer_amount)
    SELECT p_visit_id, r.nurse_id, COALESCE(v_visit.payout_amount, v_eng.day_rate, 800)
      FROM public.nursing_roster(v_eng.lat, v_eng.lng, v_wide,
             ARRAY[v_eng.patient_id, v_visit.original_nurse_id]) r
    ON CONFLICT (visit_id, nurse_id) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  END IF;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.nursing_roster(double precision, double precision, numeric, uuid[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_nursing_engagement(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_nursing_visit(uuid)      FROM PUBLIC, anon, authenticated;

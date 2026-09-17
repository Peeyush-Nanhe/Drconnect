-- ============================================================================
-- Care staff module, part 2 of 3: one booking record for every service.
--
-- Handover section 6.1 and 6.2. Table order per the brief: CREATE TABLE, then
-- GRANTs, then ENABLE ROW LEVEL SECURITY, then policies.
--
-- Reliability is NOT a column. It is derived in part 3 from the event log, so
-- it cannot drift from its own history or be edited directly.
-- ============================================================================

-- ------------------------------------------------ matching settings --------
CREATE TABLE IF NOT EXISTS public.booking_matching_settings (
  id                          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  initial_radius_km           numeric NOT NULL DEFAULT 4,
  expansion_step_km           numeric NOT NULL DEFAULT 1,
  expansion_interval_minutes  integer NOT NULL DEFAULT 1,
  max_radius_km               numeric NOT NULL DEFAULT 11,
  offer_expiry_minutes        integer NOT NULL DEFAULT 10,
  minimum_reliability_score   integer NOT NULL DEFAULT 40,
  max_active_jobs             integer NOT NULL DEFAULT 3,
  provider_cancellation_penalty integer NOT NULL DEFAULT 10,
  late_arrival_penalty          integer NOT NULL DEFAULT 5,
  no_show_penalty               integer NOT NULL DEFAULT 20,
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  uuid
);
GRANT SELECT ON public.booking_matching_settings TO authenticated;
GRANT ALL ON public.booking_matching_settings TO service_role;
ALTER TABLE public.booking_matching_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings readable" ON public.booking_matching_settings;
CREATE POLICY "settings readable" ON public.booking_matching_settings
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.booking_matching_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ------------------------------------------------------ unified booking ----
CREATE TABLE IF NOT EXISTS public.unified_bookings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type          text NOT NULL,
  provider_role         text NOT NULL
    CHECK (provider_role IN ('nurse','technician','physiotherapist','care_physician','ambulance')),
  service_code          text,
  title                 text NOT NULL,
  description           text,
  priority              text NOT NULL DEFAULT 'routine'
    CHECK (priority IN ('routine','urgent','emergency')),
  visit_mode            text NOT NULL DEFAULT 'home'
    CHECK (visit_mode IN ('home','clinic','hospital','hub')),
  status                text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','searching','expanded','offered','accepted',
                      'en_route','arrived','in_progress','completed',
                      'cancelled','expired','disputed')),
  scheduled_for         timestamptz,
  duration_minutes      integer NOT NULL DEFAULT 60,
  estimated_earnings    integer NOT NULL DEFAULT 0,

  address               text,
  area                  text,
  city                  text NOT NULL DEFAULT 'Pune',
  lat                   double precision,
  lng                   double precision,

  current_radius_km       numeric NOT NULL DEFAULT 4,
  notified_provider_count integer NOT NULL DEFAULT 0,
  search_started_at       timestamptz,

  patient_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_name          text,
  patient_phone         text,
  assigned_provider_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_facility_id  uuid,
  preferred_facility_id uuid,
  owner_facility_id     uuid,

  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  cancellation_reason   text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  assigned_at           timestamptz,
  en_route_at           timestamptz,
  arrived_at            timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.unified_bookings TO authenticated;
GRANT ALL ON public.unified_bookings TO service_role;
ALTER TABLE public.unified_bookings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------- booking offers ----
CREATE TABLE IF NOT EXISTS public.booking_offers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES public.unified_bookings(id) ON DELETE CASCADE,
  provider_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facility_id   uuid,
  provider_role text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','withdrawn','expired')),
  distance_km   numeric,
  earnings      integer,
  note          text,
  offered_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  responded_at  timestamptz,
  UNIQUE (booking_id, provider_id)
);
GRANT SELECT ON public.booking_offers TO authenticated;
GRANT ALL ON public.booking_offers TO service_role;
ALTER TABLE public.booking_offers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS booking_offers_provider_idx
  ON public.booking_offers (provider_id, status, offered_at DESC);

-- ------------------------------------------------------ status history -----
CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.unified_bookings(id) ON DELETE CASCADE,
  status     text NOT NULL,
  note       text,
  actor_id   uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.booking_status_history TO authenticated;
GRANT ALL ON public.booking_status_history TO service_role;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS booking_status_history_idx
  ON public.booking_status_history (booking_id, created_at);

-- ----------------------------------------------------- booking reviews -----
CREATE TABLE IF NOT EXISTS public.booking_reviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid NOT NULL UNIQUE REFERENCES public.unified_bookings(id) ON DELETE CASCADE,
  patient_id       uuid,
  provider_id      uuid,
  overall          smallint NOT NULL CHECK (overall BETWEEN 1 AND 5),
  quality          smallint CHECK (quality BETWEEN 1 AND 5),
  punctuality      smallint CHECK (punctuality BETWEEN 1 AND 5),
  professionalism  smallint CHECK (professionalism BETWEEN 1 AND 5),
  communication    smallint CHECK (communication BETWEEN 1 AND 5),
  would_recommend  boolean,
  comment          text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.booking_reviews TO authenticated;
GRANT ALL ON public.booking_reviews TO service_role;
ALTER TABLE public.booking_reviews ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------- provider reliability -------
CREATE TABLE IF NOT EXISTS public.provider_reliability_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id  uuid REFERENCES public.unified_bookings(id) ON DELETE SET NULL,
  event_type  text NOT NULL,
  score_delta integer NOT NULL,
  note        text,
  actor_id    uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_reliability_events TO authenticated;
GRANT ALL ON public.provider_reliability_events TO service_role;
ALTER TABLE public.provider_reliability_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS reliability_provider_idx
  ON public.provider_reliability_events (provider_id, created_at DESC);

-- ------------------------------------------------------ booking issues -----
CREATE TABLE IF NOT EXISTS public.booking_issues (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES public.unified_bookings(id) ON DELETE CASCADE,
  reporter_id uuid,
  provider_id uuid,
  category    text NOT NULL,
  details     text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','dismissed')),
  resolution  text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.booking_issues TO authenticated;
GRANT ALL ON public.booking_issues TO service_role;
ALTER TABLE public.booking_issues ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------- live tracking -----
CREATE TABLE IF NOT EXISTS public.booking_location_tracks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES public.unified_bookings(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  accuracy_m  numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.booking_location_tracks TO authenticated;
GRANT ALL ON public.booking_location_tracks TO service_role;
ALTER TABLE public.booking_location_tracks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS booking_tracks_idx
  ON public.booking_location_tracks (booking_id, recorded_at DESC);

-- ==================================================== policies =============
-- Patients see their own. Providers see what they were offered or assigned.
-- Venues see what they posted. Admins see everything. Nothing is writable
-- directly: every change goes through a SECURITY DEFINER function in part 3,
-- so the privacy projection and the race guards cannot be bypassed.

DROP POLICY IF EXISTS "booking visible to its parties" ON public.unified_bookings;
CREATE POLICY "booking visible to its parties" ON public.unified_bookings
  FOR SELECT TO authenticated USING (
    patient_id = auth.uid()
    OR assigned_provider_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.booking_offers o
                WHERE o.booking_id = id AND o.provider_id = auth.uid())
  );

DROP POLICY IF EXISTS "offer visible to its provider" ON public.booking_offers;
CREATE POLICY "offer visible to its provider" ON public.booking_offers
  FOR SELECT TO authenticated
  USING (provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "history visible to booking parties" ON public.booking_status_history;
CREATE POLICY "history visible to booking parties" ON public.booking_status_history
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.unified_bookings b
             WHERE b.id = booking_id
               AND (b.patient_id = auth.uid() OR b.assigned_provider_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "review visible to its parties" ON public.booking_reviews;
CREATE POLICY "review visible to its parties" ON public.booking_reviews
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR provider_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin'));

-- A provider sees their own score movements; nobody sees anyone else's.
DROP POLICY IF EXISTS "reliability visible to that provider" ON public.provider_reliability_events;
CREATE POLICY "reliability visible to that provider" ON public.provider_reliability_events
  FOR SELECT TO authenticated
  USING (provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "issue visible to reporter and admin" ON public.booking_issues;
CREATE POLICY "issue visible to reporter and admin" ON public.booking_issues
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- The patient watching the map, and the provider sending the pings.
DROP POLICY IF EXISTS "track visible to booking parties" ON public.booking_location_tracks;
CREATE POLICY "track visible to booking parties" ON public.booking_location_tracks
  FOR SELECT TO authenticated USING (
    provider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.unified_bookings b
                WHERE b.id = booking_id AND b.patient_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.unified_bookings REPLICA IDENTITY FULL;
ALTER TABLE public.booking_offers REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.unified_bookings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_offers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

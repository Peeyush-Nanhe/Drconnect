
-- 1. handle_new_user: always default to 'patient'; never trust client-supplied role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.phone)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient'::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. care_requests: enforce column-level rules for owner updates via trigger
CREATE OR REPLACE FUNCTION public.enforce_care_request_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin');
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Provider path (already accepted by this user): may update status/notes; cannot rewrite ownership fields
  IF OLD.accepted_by IS NOT NULL AND OLD.accepted_by = auth.uid() THEN
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
      RAISE EXCEPTION 'cannot change patient_id';
    END IF;
    IF NEW.accepted_by IS DISTINCT FROM OLD.accepted_by THEN
      RAISE EXCEPTION 'cannot change accepted_by';
    END IF;
    RETURN NEW;
  END IF;

  -- Patient path: can only cancel their own request; cannot self-assign a provider or fake acceptance
  IF OLD.patient_id = auth.uid() THEN
    IF NEW.accepted_by IS DISTINCT FROM OLD.accepted_by THEN
      RAISE EXCEPTION 'patient cannot change accepted_by';
    END IF;
    IF NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
      RAISE EXCEPTION 'patient cannot change accepted_at';
    END IF;
    IF NEW.fare IS DISTINCT FROM OLD.fare THEN
      RAISE EXCEPTION 'patient cannot change fare';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('open','cancelled') THEN
      RAISE EXCEPTION 'patient can only cancel their request';
    END IF;
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
      RAISE EXCEPTION 'cannot change patient_id';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'not authorized to update care_request';
END;
$$;

DROP TRIGGER IF EXISTS enforce_care_request_update ON public.care_requests;
CREATE TRIGGER enforce_care_request_update
BEFORE UPDATE ON public.care_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_care_request_update();

-- 3. request_events: only participants of the referenced request may insert
DROP POLICY IF EXISTS "insert own events" ON public.request_events;
CREATE POLICY "insert own events"
  ON public.request_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.care_requests r
      WHERE r.id = request_id
        AND (
          r.patient_id = auth.uid()
          OR r.accepted_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'super_admin')
        )
    )
  );

-- 4. hub_beds: restrict SELECT to hub owner, assigned patient, or admin
DROP POLICY IF EXISTS "beds readable" ON public.hub_beds;
CREATE POLICY "beds readable"
  ON public.hub_beds
  FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.hubs h
      WHERE h.id = hub_beds.hub_id AND h.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 5. profiles: restrict SELECT on base table to owner + admins; create narrow public view
DROP POLICY IF EXISTS "profiles readable" ON public.profiles;
CREATE POLICY "own or admin profile read"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = off) AS
  SELECT id, full_name, specialty, hub_id, lat, lng, view, last_seen_at, created_at
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- 6. Lock down SECURITY DEFINER helper triggers from direct execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_demo_admin_roles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_care_request_update() FROM PUBLIC, anon, authenticated;

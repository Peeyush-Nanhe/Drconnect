
-- 1. Stage columns
ALTER TABLE public.surgery_booking_roles
  ADD COLUMN IF NOT EXISTS notification_stage TEXT NOT NULL DEFAULT 'all'
    CHECK (notification_stage IN ('preferred','all')),
  ADD COLUMN IF NOT EXISTS stage_expires_at TIMESTAMPTZ;

-- 2. Helper: is this provider a hub-preferred surgery pick for this role?
CREATE OR REPLACE FUNCTION public.is_hub_surgery_preferred(_hub_id UUID, _role TEXT, _provider_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hub_favorite_providers
    WHERE hub_id = _hub_id
      AND kind = 'surgery'
      AND category = _role
      AND provider_id = _provider_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_hub_surgery_preferred(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hub_surgery_preferred(UUID, TEXT, UUID) TO authenticated, service_role;

-- 3. On insert, mark the role as "preferred" stage if the owning hub has any preferred providers for that role
CREATE OR REPLACE FUNCTION public.set_surgery_role_initial_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hub UUID;
  v_has_pref BOOLEAN;
BEGIN
  SELECT facility_id INTO v_hub FROM public.surgery_bookings WHERE id = NEW.booking_id;
  IF v_hub IS NULL THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.hub_favorite_providers
    WHERE hub_id = v_hub AND kind = 'surgery' AND category = NEW.role
  ) INTO v_has_pref;

  IF v_has_pref THEN
    NEW.notification_stage := 'preferred';
    NEW.stage_expires_at := now() + interval '60 seconds';
  ELSE
    NEW.notification_stage := 'all';
    NEW.stage_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_surgery_role_initial_stage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS surgery_role_set_stage ON public.surgery_booking_roles;
CREATE TRIGGER surgery_role_set_stage
  BEFORE INSERT ON public.surgery_booking_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_surgery_role_initial_stage();

-- 4. Backfill existing rows: leave as 'all' (already default)

-- 5. Tighten RLS: providers can view/accept only when the role is open to them
DROP POLICY IF EXISTS "Providers can view pending or own role invitations" ON public.surgery_booking_roles;
CREATE POLICY "Providers can view pending or own role invitations"
  ON public.surgery_booking_roles
  FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR (
      status = 'pending'
      AND (
        notification_stage = 'all'
        OR (stage_expires_at IS NOT NULL AND stage_expires_at < now())
        OR public.is_hub_surgery_preferred(
             (SELECT facility_id FROM public.surgery_bookings WHERE id = surgery_booking_roles.booking_id),
             role,
             auth.uid()
           )
      )
    )
  );

DROP POLICY IF EXISTS "Provider can accept a pending role" ON public.surgery_booking_roles;
CREATE POLICY "Provider can accept a pending role"
  ON public.surgery_booking_roles
  FOR UPDATE
  USING (
    (
      status = 'pending'
      AND assigned_to IS NULL
      AND (
        notification_stage = 'all'
        OR (stage_expires_at IS NOT NULL AND stage_expires_at < now())
        OR public.is_hub_surgery_preferred(
             (SELECT facility_id FROM public.surgery_bookings WHERE id = surgery_booking_roles.booking_id),
             role,
             auth.uid()
           )
      )
    )
    OR assigned_to = auth.uid()
  )
  WITH CHECK (assigned_to = auth.uid());

CREATE INDEX IF NOT EXISTS surgery_booking_roles_stage_idx
  ON public.surgery_booking_roles (notification_stage, stage_expires_at)
  WHERE status = 'pending';

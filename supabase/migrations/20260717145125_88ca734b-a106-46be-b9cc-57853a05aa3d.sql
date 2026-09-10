
-- 1) New columns
ALTER TABLE public.surgery_bookings
  ADD COLUMN IF NOT EXISTS ot_room TEXT,
  ADD COLUMN IF NOT EXISTS blood_units INTEGER,
  ADD COLUMN IF NOT EXISTS blood_group TEXT;

ALTER TABLE public.surgery_bookings
  DROP CONSTRAINT IF EXISTS surgery_bookings_blood_group_check;
ALTER TABLE public.surgery_bookings
  ADD CONSTRAINT surgery_bookings_blood_group_check
    CHECK (blood_group IS NULL OR blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-'));

ALTER TABLE public.surgery_booking_roles
  ADD COLUMN IF NOT EXISTS fee NUMERIC(10,2);

-- 2) Specialty-matching helper
CREATE OR REPLACE FUNCTION public.provider_matches_surgery_role(_uid UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spec TEXT;
BEGIN
  IF _role IS NULL OR _role = 'other' THEN
    RETURN true;
  END IF;
  SELECT LOWER(COALESCE(specialty, '')) INTO v_spec FROM public.profiles WHERE id = _uid;
  IF v_spec IS NULL OR v_spec = '' THEN
    -- no specialty on file: allow only "other" (already returned above)
    RETURN false;
  END IF;
  RETURN CASE _role
    WHEN 'surgeon'        THEN v_spec LIKE '%surgeon%' OR v_spec LIKE '%surgery%'
    WHEN 'anaesthetist'   THEN v_spec LIKE '%anaesth%' OR v_spec LIKE '%anesth%'
    WHEN 'obstetrician'   THEN v_spec LIKE '%obstetr%' OR v_spec LIKE '%gynae%' OR v_spec LIKE '%gynec%'
    WHEN 'paediatrician'  THEN v_spec LIKE '%paediatr%' OR v_spec LIKE '%pediatr%'
    WHEN 'ot_technician'  THEN v_spec LIKE '%ot tech%' OR v_spec LIKE '%operat%tech%' OR v_spec LIKE '%ot_tech%'
    WHEN 'scrub_nurse'    THEN v_spec LIKE '%scrub%' OR v_spec LIKE '%nurse%'
    ELSE false
  END;
END;
$$;

-- 3) Tighten policies to require specialty match for pending discovery/accept
DROP POLICY IF EXISTS "Providers can view pending or own role invitations" ON public.surgery_booking_roles;
CREATE POLICY "Providers can view pending or own role invitations"
  ON public.surgery_booking_roles FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR (
      status = 'pending'
      AND public.provider_matches_surgery_role(auth.uid(), role)
      AND (
        notification_stage = 'all'
        OR (stage_expires_at IS NOT NULL AND stage_expires_at < now())
        OR public.is_hub_surgery_preferred(
             (SELECT facility_id FROM public.surgery_bookings WHERE id = surgery_booking_roles.booking_id),
             role, auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Provider can accept a pending role" ON public.surgery_booking_roles;
CREATE POLICY "Provider can accept a pending role"
  ON public.surgery_booking_roles FOR UPDATE TO authenticated
  USING (
    (status = 'pending'
     AND assigned_to IS NULL
     AND public.provider_matches_surgery_role(auth.uid(), role)
     AND (
       notification_stage = 'all'
       OR (stage_expires_at IS NOT NULL AND stage_expires_at < now())
       OR public.is_hub_surgery_preferred(
            (SELECT facility_id FROM public.surgery_bookings WHERE id = surgery_booking_roles.booking_id),
            role, auth.uid())
     ))
    OR assigned_to = auth.uid()
  )
  WITH CHECK (assigned_to = auth.uid());

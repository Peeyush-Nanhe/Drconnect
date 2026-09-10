
-- 1) TABLES
CREATE TABLE public.surgery_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL,
  patient_name text NOT NULL,
  patient_phone text,
  procedure text NOT NULL,
  mode text NOT NULL DEFAULT 'planned' CHECK (mode IN ('planned','emergency')),
  scheduled_at timestamptz,
  notes text,
  status text NOT NULL DEFAULT 'broadcasting' CHECK (status IN ('draft','broadcasting','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.surgery_booking_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.surgery_bookings(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('surgeon','anaesthetist','obstetrician','paediatrician','ot_technician','scrub_nurse','other')),
  specialty text,
  assigned_to uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surgery_bookings TO authenticated;
GRANT ALL ON public.surgery_bookings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surgery_booking_roles TO authenticated;
GRANT ALL ON public.surgery_booking_roles TO service_role;

-- 3) RLS
ALTER TABLE public.surgery_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_booking_roles ENABLE ROW LEVEL SECURITY;

-- 4) POLICIES
CREATE POLICY "Facility manages own surgery bookings"
  ON public.surgery_bookings FOR ALL TO authenticated
  USING (facility_id = auth.uid())
  WITH CHECK (facility_id = auth.uid());

CREATE POLICY "Assigned providers can view surgery bookings"
  ON public.surgery_bookings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.surgery_booking_roles r
      WHERE r.booking_id = surgery_bookings.id
        AND (r.assigned_to = auth.uid() OR r.status = 'pending')
    )
  );

CREATE POLICY "Facility manages roles on own bookings"
  ON public.surgery_booking_roles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surgery_bookings b WHERE b.id = booking_id AND b.facility_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.surgery_bookings b WHERE b.id = booking_id AND b.facility_id = auth.uid()));

CREATE POLICY "Providers can view pending or own role invitations"
  ON public.surgery_booking_roles FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR status = 'pending');

CREATE POLICY "Provider can accept a pending role"
  ON public.surgery_booking_roles FOR UPDATE TO authenticated
  USING ((status = 'pending' AND assigned_to IS NULL) OR assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- 5) TRIGGERS
CREATE TRIGGER surgery_bookings_set_updated_at
  BEFORE UPDATE ON public.surgery_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER surgery_booking_roles_set_updated_at
  BEFORE UPDATE ON public.surgery_booking_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.surgery_autoconfirm_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining int;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT COUNT(*) INTO remaining
      FROM public.surgery_booking_roles
      WHERE booking_id = NEW.booking_id AND status <> 'accepted';
    IF remaining = 0 THEN
      UPDATE public.surgery_bookings
        SET status = 'confirmed', updated_at = now()
        WHERE id = NEW.booking_id AND status = 'broadcasting';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER surgery_booking_roles_autoconfirm
  AFTER UPDATE ON public.surgery_booking_roles
  FOR EACH ROW EXECUTE FUNCTION public.surgery_autoconfirm_booking();

-- 6) REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.surgery_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.surgery_booking_roles;

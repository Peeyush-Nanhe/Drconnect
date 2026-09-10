
-- Special Needs Child Care bookings
CREATE TABLE public.special_needs_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL,
  category text NOT NULL,
  subtype text NOT NULL,
  provider_name text NOT NULL,
  fee numeric,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_needs_bookings TO authenticated;
GRANT ALL ON public.special_needs_bookings TO service_role;

ALTER TABLE public.special_needs_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients manage own special needs bookings"
  ON public.special_needs_bookings
  FOR ALL
  TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Admins view all special needs bookings"
  ON public.special_needs_bookings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER set_special_needs_bookings_updated_at
  BEFORE UPDATE ON public.special_needs_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Blood Bank & Donation activity (need blood, donor register, camp register)
CREATE TABLE public.blood_bank_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL,
  activity_type text NOT NULL,
  blood_group text,
  units integer,
  hospital text,
  urgent boolean,
  donor_name text,
  camp_id text,
  camp_name text,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blood_bank_activity TO authenticated;
GRANT ALL ON public.blood_bank_activity TO service_role;

ALTER TABLE public.blood_bank_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients manage own blood bank activity"
  ON public.blood_bank_activity
  FOR ALL
  TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Admins view all blood bank activity"
  ON public.blood_bank_activity
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER set_blood_bank_activity_updated_at
  BEFORE UPDATE ON public.blood_bank_activity
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

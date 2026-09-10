
CREATE TABLE public.prosthetics_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subtype TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  fee NUMERIC,
  status TEXT NOT NULL DEFAULT 'booked',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prosthetics_bookings TO authenticated;
GRANT ALL ON public.prosthetics_bookings TO service_role;

ALTER TABLE public.prosthetics_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own prosthetics bookings"
  ON public.prosthetics_bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = patient_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Patients create own prosthetics bookings"
  ON public.prosthetics_bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients update own prosthetics bookings"
  ON public.prosthetics_bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients delete own prosthetics bookings"
  ON public.prosthetics_bookings FOR DELETE
  TO authenticated
  USING (auth.uid() = patient_id);

CREATE OR REPLACE FUNCTION public.update_prosthetics_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_prosthetics_bookings_updated_at
  BEFORE UPDATE ON public.prosthetics_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_prosthetics_bookings_updated_at();

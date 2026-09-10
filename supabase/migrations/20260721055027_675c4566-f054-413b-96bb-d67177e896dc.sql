CREATE TABLE public.specialty_care_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty TEXT NOT NULL,
  specialty_label TEXT NOT NULL,
  concern TEXT NOT NULL,
  concern_id TEXT,
  provider_name TEXT NOT NULL,
  mode TEXT NOT NULL,
  price_low NUMERIC,
  price_high NUMERIC,
  photo_attached BOOLEAN DEFAULT false,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'booked',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialty_care_bookings TO authenticated;
GRANT ALL ON public.specialty_care_bookings TO service_role;

ALTER TABLE public.specialty_care_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own specialty care bookings"
  ON public.specialty_care_bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = patient_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Patients create own specialty care bookings"
  ON public.specialty_care_bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients update own specialty care bookings"
  ON public.specialty_care_bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients delete own specialty care bookings"
  ON public.specialty_care_bookings FOR DELETE
  TO authenticated
  USING (auth.uid() = patient_id);

CREATE TRIGGER trg_scb_updated_at
  BEFORE UPDATE ON public.specialty_care_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.specialty_care_bookings;
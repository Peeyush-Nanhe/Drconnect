CREATE TABLE public.consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_kind TEXT NOT NULL,
  booking_id UUID NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('home_visit')),
  policy_version TEXT NOT NULL,
  document_text TEXT NOT NULL,
  ip INET,
  user_agent TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX consents_unique_per_booking
  ON public.consents (user_id, booking_kind, booking_id, consent_type);
CREATE INDEX consents_booking_idx
  ON public.consents (booking_kind, booking_id);

GRANT SELECT, INSERT ON public.consents TO authenticated;
GRANT ALL ON public.consents TO service_role;

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can insert their own consents"
  ON public.consents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Patients can view their own consents"
  ON public.consents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
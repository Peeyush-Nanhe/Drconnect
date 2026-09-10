CREATE TABLE public.service_referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_key   TEXT NOT NULL,
  service_label TEXT NOT NULL,
  service_tab   TEXT,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  care_request_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.service_referrals TO authenticated;
GRANT ALL ON public.service_referrals TO service_role;

ALTER TABLE public.service_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral readable by doctor or patient"
  ON public.service_referrals FOR SELECT
  TO authenticated
  USING (doctor_id = auth.uid() OR patient_id = auth.uid()
         OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "doctor creates referral"
  ON public.service_referrals FOR INSERT
  TO authenticated
  WITH CHECK (doctor_id = auth.uid()
              AND (public.has_role(auth.uid(),'provider') OR public.has_role(auth.uid(),'facility')));

CREATE POLICY "patient or doctor updates referral"
  ON public.service_referrals FOR UPDATE
  TO authenticated
  USING (patient_id = auth.uid() OR doctor_id = auth.uid())
  WITH CHECK (patient_id = auth.uid() OR doctor_id = auth.uid());

CREATE TRIGGER trg_service_referrals_updated_at
  BEFORE UPDATE ON public.service_referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_service_referrals_patient ON public.service_referrals(patient_id, created_at DESC);
CREATE INDEX idx_service_referrals_doctor  ON public.service_referrals(doctor_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.service_referrals;
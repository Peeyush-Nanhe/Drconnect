
-- shared updated_at trigger fn (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ care_program_bookings ============
CREATE TABLE public.care_program_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program TEXT NOT NULL CHECK (program IN ('assistive_living','rehab','ivf_fertility','weight_management')),
  tier TEXT,
  summary TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  fee NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_program_bookings TO authenticated;
GRANT ALL ON public.care_program_bookings TO service_role;

ALTER TABLE public.care_program_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own program bookings"
  ON public.care_program_bookings FOR SELECT TO authenticated
  USING (auth.uid() = patient_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Patients create own program bookings"
  ON public.care_program_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients or admins update program bookings"
  ON public.care_program_bookings FOR UPDATE TO authenticated
  USING (auth.uid() = patient_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (auth.uid() = patient_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins delete program bookings"
  ON public.care_program_bookings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_cpb_updated_at BEFORE UPDATE ON public.care_program_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.care_program_bookings;

-- ============ community_requests ============
CREATE TABLE public.community_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('society_shield','insurance_benefit','corporate_health')),
  contact_name TEXT,
  contact_phone TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_requests TO authenticated;
GRANT ALL ON public.community_requests TO service_role;

ALTER TABLE public.community_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters view own community requests"
  ON public.community_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Requesters create own community requests"
  ON public.community_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Requesters or admins update community requests"
  ON public.community_requests FOR UPDATE TO authenticated
  USING (auth.uid() = requester_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (auth.uid() = requester_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins delete community requests"
  ON public.community_requests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_cr_updated_at BEFORE UPDATE ON public.community_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.community_requests;

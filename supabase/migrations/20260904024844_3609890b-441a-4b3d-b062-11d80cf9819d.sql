-- =============== Home physiotherapy module =====================

CREATE TABLE public.physio_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  name text NOT NULL,
  city text NOT NULL DEFAULT 'Mumbai',
  contact_email text,
  contact_phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.physio_partners TO authenticated;
GRANT ALL ON public.physio_partners TO service_role;
ALTER TABLE public.physio_partners ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.physio_partner_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.physio_partners(id) ON DELETE CASCADE,
  area text NOT NULL,
  city text NOT NULL DEFAULT 'Mumbai',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, area)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.physio_partner_areas TO authenticated;
GRANT ALL ON public.physio_partner_areas TO service_role;
ALTER TABLE public.physio_partner_areas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.physio_therapists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  partner_id uuid REFERENCES public.physio_partners(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text,
  specializations text[] NOT NULL DEFAULT '{}',
  area text,
  city text NOT NULL DEFAULT 'Mumbai',
  registration_number text,
  verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.physio_therapists TO authenticated;
GRANT ALL ON public.physio_therapists TO service_role;
ALTER TABLE public.physio_therapists ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.physio_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid,
  patient_name text,
  therapy_type text NOT NULL DEFAULT 'orthopaedic'
    CHECK (therapy_type IN ('neuro','orthopaedic','sports','paediatric','geriatric','cardio_respiratory','post_surgical','pelvic_floor','general')),
  area text NOT NULL,
  city text NOT NULL DEFAULT 'Mumbai',
  address text,
  lat double precision,
  lng double precision,
  scheduled_at timestamptz,
  duration_min integer NOT NULL DEFAULT 45,
  session_number integer NOT NULL DEFAULT 1,
  therapist_id uuid REFERENCES public.physio_therapists(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES public.physio_partners(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','assigned','en_route','in_progress','completed','cancelled','no_show')),
  urgency text NOT NULL DEFAULT 'planned' CHECK (urgency IN ('planned','urgent')),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  no_show boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  cancel_reason text,
  fee numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.physio_visits TO authenticated;
GRANT ALL ON public.physio_visits TO service_role;
ALTER TABLE public.physio_visits ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.physio_visit_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL UNIQUE REFERENCES public.physio_visits(id) ON DELETE CASCADE,
  patient_id uuid,
  therapist_id uuid REFERENCES public.physio_therapists(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES public.physio_partners(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  punctuality smallint CHECK (punctuality BETWEEN 1 AND 5),
  professionalism smallint CHECK (professionalism BETWEEN 1 AND 5),
  would_rebook boolean,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.physio_visit_feedback TO authenticated;
GRANT ALL ON public.physio_visit_feedback TO service_role;
ALTER TABLE public.physio_visit_feedback ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_physio_visits_sched ON public.physio_visits (scheduled_at DESC);
CREATE INDEX idx_physio_visits_area ON public.physio_visits (area);
CREATE INDEX idx_physio_visits_partner ON public.physio_visits (partner_id);
CREATE INDEX idx_physio_visits_therapist ON public.physio_visits (therapist_id);
CREATE INDEX idx_physio_visits_patient ON public.physio_visits (patient_id);
CREATE INDEX idx_physio_therapists_partner ON public.physio_therapists (partner_id);

-- helpers --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_physio_partner_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.physio_partners WHERE user_id = auth.uid() AND active LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.my_physio_partner_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_physio_partner_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.physio_partner_covers_area(_partner_id uuid, _area text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _partner_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.physio_partner_areas pa
    WHERE pa.partner_id = _partner_id AND lower(pa.area) = lower(_area)
  );
$$;
REVOKE ALL ON FUNCTION public.physio_partner_covers_area(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.physio_partner_covers_area(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated, service_role;

-- policies -------------------------------------------------------------
CREATE POLICY "partners read own" ON public.physio_partners
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "admins manage partners" ON public.physio_partners
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "partner areas read" ON public.physio_partner_areas
  FOR SELECT TO authenticated
  USING (partner_id = public.my_physio_partner_id() OR public.is_admin_user());
CREATE POLICY "admins manage partner areas" ON public.physio_partner_areas
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "therapists read" ON public.physio_therapists
  FOR SELECT TO authenticated
  USING (public.is_admin_user() OR partner_id = public.my_physio_partner_id() OR user_id = auth.uid());
CREATE POLICY "partner manages own therapists" ON public.physio_therapists
  FOR ALL TO authenticated
  USING (public.is_admin_user() OR partner_id = public.my_physio_partner_id())
  WITH CHECK (public.is_admin_user() OR partner_id = public.my_physio_partner_id());

CREATE POLICY "visits read" ON public.physio_visits
  FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_admin_user()
    OR public.physio_partner_covers_area(public.my_physio_partner_id(), area)
    OR therapist_id IN (SELECT id FROM public.physio_therapists WHERE user_id = auth.uid())
  );
CREATE POLICY "patients create own visits" ON public.physio_visits
  FOR INSERT TO authenticated WITH CHECK (patient_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "patients cancel own visits" ON public.physio_visits
  FOR UPDATE TO authenticated
  USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());
CREATE POLICY "partner manages area visits" ON public.physio_visits
  FOR UPDATE TO authenticated
  USING (public.is_admin_user() OR public.physio_partner_covers_area(public.my_physio_partner_id(), area))
  WITH CHECK (public.is_admin_user() OR public.physio_partner_covers_area(public.my_physio_partner_id(), area));

CREATE POLICY "feedback read" ON public.physio_visit_feedback
  FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_admin_user()
    OR partner_id = public.my_physio_partner_id()
  );
CREATE POLICY "patients write own feedback" ON public.physio_visit_feedback
  FOR INSERT TO authenticated WITH CHECK (patient_id = auth.uid());
CREATE POLICY "patients update own feedback" ON public.physio_visit_feedback
  FOR UPDATE TO authenticated USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());

CREATE TRIGGER physio_partners_updated_at BEFORE UPDATE ON public.physio_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER physio_therapists_updated_at BEFORE UPDATE ON public.physio_therapists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER physio_visits_updated_at BEFORE UPDATE ON public.physio_visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER physio_feedback_updated_at BEFORE UPDATE ON public.physio_visit_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
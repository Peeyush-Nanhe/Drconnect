-- 1. Allow mental wellness in care program bookings
ALTER TABLE public.care_program_bookings DROP CONSTRAINT IF EXISTS care_program_bookings_program_check;
ALTER TABLE public.care_program_bookings ADD CONSTRAINT care_program_bookings_program_check
  CHECK (program = ANY (ARRAY['assistive_living','rehab','ivf_fertility','weight_management','dialysis','medical_tourism','mental_wellness']));

-- 2. Provider registration / verification fields
ALTER TABLE public.provider_directory
  ADD COLUMN IF NOT EXISTS registration_body text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_case_load integer NOT NULL DEFAULT 0;

-- 3. Helper: is the caller an active, verified coordinator?
CREATE OR REPLACE FUNCTION public.is_active_coordinator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coordinator_profiles cp
    WHERE cp.user_id = _user_id
      AND cp.application_status IN ('submitted','verified','approved')
  ) OR public.has_role(_user_id, 'admin');
$$;

-- 4. Care teams
CREATE TABLE public.mw_care_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track text NOT NULL CHECK (track IN ('depression','anxiety','schizophrenia','sexual_wellness')),
  booking_id uuid REFERENCES public.care_program_bookings(id) ON DELETE SET NULL,
  anchor_role text,
  anchor_summary text,
  anchor_modality text NOT NULL DEFAULT 'in_person' CHECK (anchor_modality IN ('in_person','online')),
  modality_reason text,
  urgent boolean NOT NULL DEFAULT false,
  screening_instrument text,
  screening_score integer,
  screening_band text,
  screening_red_flag boolean NOT NULL DEFAULT false,
  assigned_coordinator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'assembling' CHECK (status IN ('assembling','active','completed','cancelled')),
  first_contact_at timestamptz,
  assembled_at timestamptz,
  first_contact_due_at timestamptz NOT NULL DEFAULT (now() + interval '4 hours'),
  assembly_due_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  review_flag boolean NOT NULL DEFAULT false,
  programme_tier text,
  programme_enrolled_at timestamptz,
  coordination_fee numeric,
  coordination_fee_disclosed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mw_care_teams TO authenticated;
GRANT ALL ON public.mw_care_teams TO service_role;
ALTER TABLE public.mw_care_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients read own care teams" ON public.mw_care_teams
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR public.is_active_coordinator(auth.uid()));
CREATE POLICY "Patients create own care teams" ON public.mw_care_teams
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Patient or coordinator updates care team" ON public.mw_care_teams
  FOR UPDATE TO authenticated
  USING (patient_id = auth.uid() OR public.is_active_coordinator(auth.uid()))
  WITH CHECK (patient_id = auth.uid() OR public.is_active_coordinator(auth.uid()));

CREATE INDEX mw_care_teams_patient_idx ON public.mw_care_teams(patient_id, created_at DESC);
CREATE INDEX mw_care_teams_queue_idx ON public.mw_care_teams(status, urgent DESC, created_at);

CREATE TRIGGER mw_care_teams_updated_at BEFORE UPDATE ON public.mw_care_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Team members
CREATE TABLE public.mw_care_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.mw_care_teams(id) ON DELETE CASCADE,
  role text NOT NULL,
  role_label text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  provider_id uuid REFERENCES public.provider_directory(id) ON DELETE SET NULL,
  provider_name text,
  appointment_note text,
  appointment_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','declined','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, role)
);

GRANT SELECT, INSERT, UPDATE ON public.mw_care_team_members TO authenticated;
GRANT ALL ON public.mw_care_team_members TO service_role;
ALTER TABLE public.mw_care_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read team members of accessible teams" ON public.mw_care_team_members
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mw_care_teams t WHERE t.id = team_id
    AND (t.patient_id = auth.uid() OR public.is_active_coordinator(auth.uid()))));
CREATE POLICY "Patient seeds own team members" ON public.mw_care_team_members
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.mw_care_teams t WHERE t.id = team_id
    AND (t.patient_id = auth.uid() OR public.is_active_coordinator(auth.uid()))));
CREATE POLICY "Coordinator assigns team members" ON public.mw_care_team_members
  FOR UPDATE TO authenticated
  USING (public.is_active_coordinator(auth.uid())
    OR EXISTS (SELECT 1 FROM public.mw_care_teams t WHERE t.id = team_id AND t.patient_id = auth.uid()))
  WITH CHECK (public.is_active_coordinator(auth.uid())
    OR EXISTS (SELECT 1 FROM public.mw_care_teams t WHERE t.id = team_id AND t.patient_id = auth.uid()));

CREATE INDEX mw_team_members_team_idx ON public.mw_care_team_members(team_id);

CREATE TRIGGER mw_team_members_updated_at BEFORE UPDATE ON public.mw_care_team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Verification gate: legally gated roles need a verified provider registration
CREATE OR REPLACE FUNCTION public.enforce_mw_verification_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gated_roles text[] := ARRAY['psychiatrist','clinical_psychologist','psychiatric_social_worker',
                              'psychiatric_nurse','care_coordinator','occupational_therapist'];
  is_verified boolean;
BEGIN
  IF NEW.provider_id IS NOT NULL AND NEW.role = ANY (gated_roles) THEN
    SELECT pd.verified INTO is_verified FROM public.provider_directory pd WHERE pd.id = NEW.provider_id;
    IF COALESCE(is_verified, false) = false THEN
      RAISE EXCEPTION 'Provider registration is not verified for role %. Verified NMC, RCI or State Mental Health Authority registration is required.', NEW.role
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_mw_verification_gate() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER mw_verification_gate
  BEFORE INSERT OR UPDATE ON public.mw_care_team_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mw_verification_gate();

-- 7. Quorum-accept: team becomes active only when every required role is confirmed
CREATE OR REPLACE FUNCTION public.rollup_mw_team_quorum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_required integer;
BEGIN
  SELECT count(*) INTO pending_required
  FROM public.mw_care_team_members m
  WHERE m.team_id = NEW.team_id AND m.required = true AND m.status <> 'confirmed';

  IF pending_required = 0 THEN
    UPDATE public.mw_care_teams
       SET status = CASE WHEN status = 'assembling' THEN 'active' ELSE status END,
           assembled_at = COALESCE(assembled_at, now())
     WHERE id = NEW.team_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.rollup_mw_team_quorum() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER mw_team_quorum
  AFTER INSERT OR UPDATE OF status ON public.mw_care_team_members
  FOR EACH ROW EXECUTE FUNCTION public.rollup_mw_team_quorum();

-- 8. Measurement loop
CREATE TABLE public.mw_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.mw_care_teams(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument text NOT NULL,
  score integer NOT NULL,
  band text NOT NULL,
  red_flag boolean NOT NULL DEFAULT false,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mw_measurements TO authenticated;
GRANT ALL ON public.mw_measurements TO service_role;
ALTER TABLE public.mw_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or queue measurements" ON public.mw_measurements
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR public.is_active_coordinator(auth.uid()));
CREATE POLICY "Patient or coordinator records measurement" ON public.mw_measurements
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid() OR public.is_active_coordinator(auth.uid()));

CREATE INDEX mw_measurements_team_idx ON public.mw_measurements(team_id, taken_at DESC);
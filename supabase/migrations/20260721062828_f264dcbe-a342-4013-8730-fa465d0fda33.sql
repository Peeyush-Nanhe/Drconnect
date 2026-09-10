
-- ============ family_physician_plans ============
CREATE TABLE public.family_physician_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  doctor_name TEXT NOT NULL,
  doctor_spec TEXT,
  price NUMERIC NOT NULL DEFAULT 3000,
  status TEXT NOT NULL DEFAULT 'active', -- active | cancelled | expired
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '365 days'),
  cancelled_at TIMESTAMPTZ,
  chat_unlimited BOOLEAN NOT NULL DEFAULT true,
  voice_call_interval_days INT NOT NULL DEFAULT 15,
  video_call_interval_days INT NOT NULL DEFAULT 30,
  family_lab_records BOOLEAN NOT NULL DEFAULT true,
  free_consult_months INT NOT NULL DEFAULT 12,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fpp_patient_active ON public.family_physician_plans (patient_id, status, expires_at DESC);
CREATE INDEX idx_fpp_doctor_active ON public.family_physician_plans (doctor_id, status, expires_at DESC);
-- Only one active plan per patient at a time
CREATE UNIQUE INDEX uq_fpp_one_active_per_patient
  ON public.family_physician_plans (patient_id)
  WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_physician_plans TO authenticated;
GRANT ALL ON public.family_physician_plans TO service_role;

ALTER TABLE public.family_physician_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own family plans"
  ON public.family_physician_plans FOR SELECT
  TO authenticated
  USING (
    auth.uid() = patient_id
    OR auth.uid() = doctor_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Patients create own family plans"
  ON public.family_physician_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients update own family plans"
  ON public.family_physician_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients delete own family plans"
  ON public.family_physician_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = patient_id);

CREATE TRIGGER trg_fpp_updated_at
  BEFORE UPDATE ON public.family_physician_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ family_plan_call_log ============
CREATE TABLE public.family_plan_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.family_physician_plans(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('voice','video')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fpcl_plan_type_time ON public.family_plan_call_log (plan_id, call_type, created_at DESC);

GRANT SELECT, INSERT ON public.family_plan_call_log TO authenticated;
GRANT ALL ON public.family_plan_call_log TO service_role;

ALTER TABLE public.family_plan_call_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own call log"
  ON public.family_plan_call_log FOR SELECT
  TO authenticated
  USING (
    auth.uid() = patient_id
    OR auth.uid() = doctor_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Patients log own calls"
  ON public.family_plan_call_log FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = patient_id
    AND EXISTS (
      SELECT 1 FROM public.family_physician_plans p
      WHERE p.id = plan_id
        AND p.patient_id = auth.uid()
        AND p.status = 'active'
        AND p.expires_at > now()
    )
  );

-- ============ helper: fetch active plan ============
CREATE OR REPLACE FUNCTION public.get_active_family_plan(_patient_id UUID)
RETURNS public.family_physician_plans
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.family_physician_plans
  WHERE patient_id = _patient_id
    AND status = 'active'
    AND expires_at > now()
  ORDER BY purchased_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_family_plan(UUID) TO authenticated;

-- ============ helper: entitlement check ============
CREATE OR REPLACE FUNCTION public.check_family_plan_call_entitlement(
  _plan_id UUID,
  _call_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.family_physician_plans%ROWTYPE;
  v_interval_days INT;
  v_last_at TIMESTAMPTZ;
  v_next_at TIMESTAMPTZ;
  v_allowed BOOLEAN;
BEGIN
  IF _call_type NOT IN ('voice','video') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_call_type');
  END IF;

  SELECT * INTO v_plan FROM public.family_physician_plans WHERE id = _plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'plan_not_found');
  END IF;

  -- Only the patient or the linked doctor can query entitlements
  IF NOT (
    auth.uid() = v_plan.patient_id
    OR auth.uid() = v_plan.doctor_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'forbidden');
  END IF;

  IF v_plan.status <> 'active' OR v_plan.expires_at <= now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'plan_inactive');
  END IF;

  v_interval_days := CASE _call_type
    WHEN 'voice' THEN v_plan.voice_call_interval_days
    ELSE v_plan.video_call_interval_days
  END;

  SELECT created_at INTO v_last_at
  FROM public.family_plan_call_log
  WHERE plan_id = _plan_id AND call_type = _call_type
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_at IS NULL THEN
    v_allowed := true;
    v_next_at := now();
  ELSE
    v_next_at := v_last_at + make_interval(days => v_interval_days);
    v_allowed := v_next_at <= now();
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'reason', CASE WHEN v_allowed THEN 'ok' ELSE 'quota_exhausted' END,
    'last_call_at', v_last_at,
    'next_available_at', v_next_at,
    'interval_days', v_interval_days
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_family_plan_call_entitlement(UUID, TEXT) TO authenticated;

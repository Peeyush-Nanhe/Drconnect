
-- 1) Table
CREATE TABLE public.provider_availability (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  working_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  blocked_dates DATE[] NOT NULL DEFAULT '{}',
  service_online JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_availability TO authenticated;
GRANT ALL ON public.provider_availability TO service_role;

ALTER TABLE public.provider_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider manages own availability"
  ON public.provider_availability FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins view all availability"
  ON public.provider_availability FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- allow anyone signed-in to read a provider's availability (needed so patient UI can hint availability).
CREATE POLICY "authenticated read availability"
  ON public.provider_availability FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_provider_availability_updated_at
  BEFORE UPDATE ON public.provider_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Availability check function
CREATE OR REPLACE FUNCTION public.is_provider_available(_uid UUID, _specialty TEXT, _at TIMESTAMPTZ DEFAULT now())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.provider_availability%ROWTYPE;
  v_local TIMESTAMP;
  v_dow INT;
  v_time TIME;
  v_day_key TEXT;
  v_intervals JSONB;
  v_interval JSONB;
  v_svc JSONB;
  v_svc_val JSONB;
BEGIN
  SELECT * INTO v FROM public.provider_availability WHERE user_id = _uid;
  IF NOT FOUND THEN
    RETURN true; -- no prefs set => available
  END IF;

  IF NOT v.is_online THEN RETURN false; END IF;

  v_local := (_at AT TIME ZONE COALESCE(v.timezone, 'Asia/Kolkata'));

  -- blocked dates
  IF v.blocked_dates IS NOT NULL AND v_local::date = ANY(v.blocked_dates) THEN
    RETURN false;
  END IF;

  -- per-service toggle: only enforce if key present
  IF _specialty IS NOT NULL AND v.service_online ? _specialty THEN
    v_svc_val := v.service_online -> _specialty;
    IF v_svc_val::text = 'false' THEN
      RETURN false;
    END IF;
  END IF;

  -- working hours: keys mon,tue,wed,thu,fri,sat,sun. If working_hours empty => always on.
  IF v.working_hours IS NULL OR v.working_hours = '{}'::jsonb THEN
    RETURN true;
  END IF;

  v_dow := EXTRACT(DOW FROM v_local)::int; -- 0=Sun..6=Sat
  v_day_key := (ARRAY['sun','mon','tue','wed','thu','fri','sat'])[v_dow + 1];
  v_intervals := v.working_hours -> v_day_key;

  IF v_intervals IS NULL OR jsonb_array_length(v_intervals) = 0 THEN
    RETURN false; -- day explicitly closed
  END IF;

  v_time := v_local::time;
  FOR v_interval IN SELECT * FROM jsonb_array_elements(v_intervals) LOOP
    IF v_time >= (v_interval->>'start')::time
       AND v_time < (v_interval->>'end')::time THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

-- 3) Enforce on care_requests accept
CREATE OR REPLACE FUNCTION public.enforce_provider_availability_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'open' AND NEW.status = 'accepted' AND NEW.accepted_by IS NOT NULL THEN
    IF NOT public.is_provider_available(NEW.accepted_by, NEW.specialty, now()) THEN
      RAISE EXCEPTION 'You are currently unavailable (offline, blocked date, outside working hours, or this service is turned off).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_provider_availability ON public.care_requests;
CREATE TRIGGER trg_enforce_provider_availability
  BEFORE UPDATE ON public.care_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_provider_availability_on_accept();

-- 4) Same for surgery role accepts
CREATE OR REPLACE FUNCTION public.enforce_surgery_availability_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;
  IF (OLD.status IS DISTINCT FROM 'accepted') AND NEW.status = 'accepted' AND NEW.assigned_to IS NOT NULL THEN
    IF NOT public.is_provider_available(NEW.assigned_to, NEW.role, now()) THEN
      RAISE EXCEPTION 'You are currently unavailable for this surgery role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_surgery_availability ON public.surgery_booking_roles;
CREATE TRIGGER trg_enforce_surgery_availability
  BEFORE UPDATE ON public.surgery_booking_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_surgery_availability_on_accept();

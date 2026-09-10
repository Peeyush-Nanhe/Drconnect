
ALTER TABLE public.provider_availability
  ADD COLUMN IF NOT EXISTS dnd_windows JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dnd_allow_emergency BOOLEAN NOT NULL DEFAULT true;

-- Helper: is provider currently in a DND window?
CREATE OR REPLACE FUNCTION public.is_provider_in_dnd(_uid UUID, _at TIMESTAMPTZ DEFAULT now())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.provider_availability%ROWTYPE;
  v_local TIMESTAMP;
  v_time TIME;
  v_dow INT;
  v_day_key TEXT;
  v_win JSONB;
  v_days JSONB;
  v_start TIME;
  v_end TIME;
  v_day_match BOOLEAN;
  v_d JSONB;
BEGIN
  SELECT * INTO v FROM public.provider_availability WHERE user_id = _uid;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v.dnd_windows IS NULL OR jsonb_array_length(v.dnd_windows) = 0 THEN
    RETURN false;
  END IF;

  v_local := (_at AT TIME ZONE COALESCE(v.timezone, 'Asia/Kolkata'));
  v_dow := EXTRACT(DOW FROM v_local)::int;
  v_day_key := (ARRAY['sun','mon','tue','wed','thu','fri','sat'])[v_dow + 1];
  v_time := v_local::time;

  FOR v_win IN SELECT * FROM jsonb_array_elements(v.dnd_windows) LOOP
    v_days := v_win -> 'days';
    v_day_match := false;
    IF v_days IS NULL OR jsonb_array_length(v_days) = 0 THEN
      v_day_match := true; -- empty days => every day
    ELSE
      FOR v_d IN SELECT * FROM jsonb_array_elements(v_days) LOOP
        IF trim(both '"' from v_d::text) = v_day_key THEN
          v_day_match := true;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF NOT v_day_match THEN CONTINUE; END IF;

    v_start := (v_win->>'start')::time;
    v_end := (v_win->>'end')::time;

    IF v_start = v_end THEN
      CONTINUE;
    ELSIF v_start < v_end THEN
      IF v_time >= v_start AND v_time < v_end THEN RETURN true; END IF;
    ELSE
      -- overnight window (e.g. 22:00 -> 07:00)
      IF v_time >= v_start OR v_time < v_end THEN RETURN true; END IF;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

-- Update care_requests enforcement to respect DND (allowing emergency if toggle set)
CREATE OR REPLACE FUNCTION public.enforce_provider_availability_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.provider_availability%ROWTYPE;
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'open' AND NEW.status = 'accepted' AND NEW.accepted_by IS NOT NULL THEN
    IF NOT public.is_provider_available(NEW.accepted_by, NEW.specialty, now()) THEN
      RAISE EXCEPTION 'You are currently unavailable (offline, blocked date, outside working hours, or this service is turned off).';
    END IF;

    IF public.is_provider_in_dnd(NEW.accepted_by, now()) THEN
      SELECT * INTO v FROM public.provider_availability WHERE user_id = NEW.accepted_by;
      IF NOT (COALESCE(v.dnd_allow_emergency, true) AND COALESCE(NEW.emergency, false)) THEN
        RAISE EXCEPTION 'You are in a Do-Not-Disturb window. Non-emergency requests are auto-declined.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Update surgery role accept to respect DND (emergency inferred from parent surgery_bookings.mode)
CREATE OR REPLACE FUNCTION public.enforce_surgery_availability_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.provider_availability%ROWTYPE;
  v_is_emergency BOOLEAN := false;
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;
  IF (OLD.status IS DISTINCT FROM 'accepted') AND NEW.status = 'accepted' AND NEW.assigned_to IS NOT NULL THEN
    IF NOT public.is_provider_available(NEW.assigned_to, NEW.role, now()) THEN
      RAISE EXCEPTION 'You are currently unavailable for this surgery role.';
    END IF;

    IF public.is_provider_in_dnd(NEW.assigned_to, now()) THEN
      SELECT (mode = 'emergency') INTO v_is_emergency
        FROM public.surgery_bookings WHERE id = NEW.booking_id;
      SELECT * INTO v FROM public.provider_availability WHERE user_id = NEW.assigned_to;
      IF NOT (COALESCE(v.dnd_allow_emergency, true) AND COALESCE(v_is_emergency, false)) THEN
        RAISE EXCEPTION 'You are in a Do-Not-Disturb window. Non-emergency surgery calls are auto-declined.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

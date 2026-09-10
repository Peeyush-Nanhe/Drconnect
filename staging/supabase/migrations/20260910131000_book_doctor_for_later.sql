
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show');

CREATE TABLE public.doctor_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES auth.users(id),
  patient_id UUID NOT NULL REFERENCES auth.users(id),
  dependent_id UUID,
  service TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'in-person',
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  provider_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  fee NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status public.appointment_status NOT NULL DEFAULT 'confirmed',
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Use a trigger for overlap since PGLite doesn't support btree_gist for EXCLUDE constraints
CREATE OR REPLACE FUNCTION check_appointment_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.doctor_appointments
    WHERE provider_id = NEW.provider_id
      AND id != NEW.id
      AND status IN ('confirmed', 'pending', 'rescheduled')
      AND tstzrange(start_time, end_time, '[)') && tstzrange(NEW.start_time, NEW.end_time, '[)')
  ) THEN
    RAISE EXCEPTION 'Appointment overlaps with an existing reservation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_appointment_overlap
BEFORE INSERT OR UPDATE ON public.doctor_appointments
FOR EACH ROW EXECUTE FUNCTION check_appointment_overlap();

-- Enable RLS
ALTER TABLE public.doctor_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can read own appointments"
  ON public.doctor_appointments FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "Doctors can read assigned appointments"
  ON public.doctor_appointments FOR SELECT
  USING (auth.uid() = provider_id);

-- Prevent direct client inserts; enforce booking via RPC
CREATE POLICY "Deny all direct inserts/updates/deletes"
  ON public.doctor_appointments FOR ALL
  USING (false);

-- 2. Create RPC to fetch real slots
CREATE OR REPLACE FUNCTION get_provider_slots(
  p_provider_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_duration_minutes INT DEFAULT 30
) RETURNS TABLE (
  slot_id TEXT,
  provider_id UUID,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  is_available BOOLEAN
) AS $$
DECLARE
  v_availability RECORD;
  v_current_date DATE;
  v_day_of_week TEXT;
  v_hours JSONB;
  v_interval JSONB;
  v_start_time TIME;
  v_end_time TIME;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_is_booked BOOLEAN;
BEGIN
  -- 1. Fetch provider availability
  SELECT * INTO v_availability FROM provider_availability WHERE user_id = p_provider_id;
  
  IF NOT FOUND OR NOT v_availability.is_online THEN
    RETURN;
  END IF;

  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    -- Skip blocked dates
    IF v_current_date = ANY(v_availability.blocked_dates) THEN
      v_current_date := v_current_date + 1;
      CONTINUE;
    END IF;

    -- Get working hours for the day
    v_day_of_week := lower(to_char(v_current_date, 'dy'));
    v_hours := v_availability.working_hours->v_day_of_week;
    
    IF v_hours IS NOT NULL AND jsonb_array_length(v_hours) > 0 THEN
      FOR i IN 0 .. jsonb_array_length(v_hours) - 1 LOOP
        v_interval := v_hours->i;
        v_start_time := (v_interval->>'start')::TIME;
        v_end_time := (v_interval->>'end')::TIME;
        
        -- Generate slots
        v_slot_start := (v_current_date || ' ' || v_start_time || ' ' || v_availability.timezone)::TIMESTAMPTZ;
        v_slot_end := v_slot_start + (p_duration_minutes || ' minutes')::INTERVAL;
        
        WHILE v_slot_end <= (v_current_date || ' ' || v_end_time || ' ' || v_availability.timezone)::TIMESTAMPTZ LOOP
          
          -- Check existing active reservations
          SELECT EXISTS (
             SELECT 1 FROM doctor_appointments 
             WHERE doctor_appointments.provider_id = p_provider_id
             AND status IN ('confirmed', 'pending', 'rescheduled')
             AND tstzrange(doctor_appointments.start_time, doctor_appointments.end_time, '[)') && tstzrange(v_slot_start, v_slot_end, '[)')
          ) INTO v_is_booked;
          
          slot_id := p_provider_id || '_' || extract(epoch from v_slot_start);
          get_provider_slots.provider_id := p_provider_id;
          get_provider_slots.start_time := v_slot_start;
          get_provider_slots.end_time := v_slot_end;
          is_available := NOT v_is_booked;
          
          IF v_slot_start > now() THEN
             RETURN NEXT;
          END IF;
          
          v_slot_start := v_slot_end;
          v_slot_end := v_slot_start + (p_duration_minutes || ' minutes')::INTERVAL;
        END LOOP;
      END LOOP;
    END IF;
    
    v_current_date := v_current_date + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.get_provider_slots(UUID, DATE, DATE, INT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_provider_slots(UUID, DATE, DATE, INT) TO authenticated;

-- 3. atomic_book_appointment implementation (Gate D anchor)
CREATE OR REPLACE FUNCTION public.atomic_book_appointment(
  p_provider_id UUID,
  p_patient_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_service TEXT,
  p_fee NUMERIC
) RETURNS UUID AS $$
DECLARE
  v_availability RECORD;
  v_day_of_week TEXT;
  v_hours JSONB;
  v_interval JSONB;
  v_start_time TIME;
  v_end_time TIME;
  v_slot_valid BOOLEAN := FALSE;
  v_appointment_id UUID;
  v_duration_minutes INT;
BEGIN
  -- 1. Check if provider has availability configured
  SELECT * INTO v_availability FROM public.provider_availability WHERE user_id = p_provider_id;
  IF NOT FOUND OR NOT v_availability.is_online THEN
    RAISE EXCEPTION 'Provider is not available for booking';
  END IF;

  -- 2. Verify slot falls within working hours
  v_day_of_week := lower(to_char(p_start_time AT TIME ZONE v_availability.timezone, 'dy'));
  v_hours := v_availability.working_hours->v_day_of_week;
  
  IF v_hours IS NOT NULL AND jsonb_array_length(v_hours) > 0 THEN
    FOR i IN 0 .. jsonb_array_length(v_hours) - 1 LOOP
      v_interval := v_hours->i;
      v_start_time := (v_interval->>'start')::TIME;
      v_end_time := (v_interval->>'end')::TIME;
      
      IF (p_start_time AT TIME ZONE v_availability.timezone)::TIME >= v_start_time AND 
         (p_end_time AT TIME ZONE v_availability.timezone)::TIME <= v_end_time THEN
        v_slot_valid := TRUE;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_slot_valid THEN
    RAISE EXCEPTION 'Requested slot is outside provider working hours';
  END IF;
  
  -- 3. Verify no overlap (using the trigger check on insert, but we can also lock)
  -- The trigger `tr_check_appointment_overlap` handles the concurrency check,
  -- but we'll insert now which will fire the trigger.
  
  INSERT INTO public.doctor_appointments (
    provider_id,
    patient_id,
    start_time,
    end_time,
    service,
    fee,
    provider_timezone
  ) VALUES (
    p_provider_id,
    p_patient_id,
    p_start_time,
    p_end_time,
    p_service,
    p_fee,
    v_availability.timezone
  ) RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.atomic_book_appointment(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, NUMERIC) FROM public;
GRANT EXECUTE ON FUNCTION public.atomic_book_appointment(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, NUMERIC) TO authenticated;

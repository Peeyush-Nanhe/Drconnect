-- Migration: Phase F - Cancellation and Rescheduling UI
-- Adds RPCs for cancelling and rescheduling doctor appointments atomically.

-- 1. Cancel Appointment RPC
CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id UUID)
RETURNS VOID AS $$
DECLARE
  v_appointment RECORD;
BEGIN
  -- Fetch the appointment to verify ownership
  SELECT * INTO v_appointment FROM public.doctor_appointments WHERE id = p_appointment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- Ensure the caller is either the patient or the provider
  IF auth.uid() != v_appointment.patient_id AND auth.uid() != v_appointment.provider_id THEN
    RAISE EXCEPTION 'Unauthorized to cancel this appointment';
  END IF;

  -- Only allow cancellation of upcoming appointments (confirmed or rescheduled)
  IF v_appointment.status NOT IN ('confirmed', 'rescheduled') THEN
    RAISE EXCEPTION 'Only confirmed or rescheduled appointments can be cancelled';
  END IF;

  -- Update status
  UPDATE public.doctor_appointments
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.cancel_appointment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(UUID) TO authenticated;

-- 2. Reschedule Appointment RPC
CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id UUID,
  p_new_start TIMESTAMPTZ,
  p_new_end TIMESTAMPTZ
) RETURNS VOID AS $$
DECLARE
  v_appointment RECORD;
  v_availability RECORD;
  v_day_of_week TEXT;
  v_hours JSONB;
  v_interval JSONB;
  v_start_time TIME;
  v_end_time TIME;
  v_slot_valid BOOLEAN := FALSE;
BEGIN
  -- Fetch the appointment to verify ownership
  SELECT * INTO v_appointment FROM public.doctor_appointments WHERE id = p_appointment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- Ensure the caller is either the patient or the provider
  IF auth.uid() != v_appointment.patient_id AND auth.uid() != v_appointment.provider_id THEN
    RAISE EXCEPTION 'Unauthorized to reschedule this appointment';
  END IF;

  -- Only allow rescheduling of upcoming appointments
  IF v_appointment.status NOT IN ('confirmed', 'rescheduled') THEN
    RAISE EXCEPTION 'Only confirmed or rescheduled appointments can be rescheduled';
  END IF;

  -- 1. Check if provider has availability configured
  SELECT * INTO v_availability FROM public.provider_availability WHERE user_id = v_appointment.provider_id;
  IF NOT FOUND OR NOT v_availability.is_online THEN
    RAISE EXCEPTION 'Provider is not available for booking';
  END IF;

  -- 2. Verify slot falls within working hours
  v_day_of_week := lower(to_char(p_new_start AT TIME ZONE v_availability.timezone, 'dy'));
  v_hours := v_availability.working_hours->v_day_of_week;
  
  IF v_hours IS NOT NULL AND jsonb_array_length(v_hours) > 0 THEN
    FOR i IN 0 .. jsonb_array_length(v_hours) - 1 LOOP
      v_interval := v_hours->i;
      v_start_time := (v_interval->>'start')::TIME;
      v_end_time := (v_interval->>'end')::TIME;
      
      IF (p_new_start AT TIME ZONE v_availability.timezone)::TIME >= v_start_time AND 
         (p_new_end AT TIME ZONE v_availability.timezone)::TIME <= v_end_time THEN
        v_slot_valid := TRUE;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_slot_valid THEN
    RAISE EXCEPTION 'Requested slot is outside provider working hours';
  END IF;

  -- 3. The trigger `tr_check_appointment_overlap` handles concurrency checks.
  -- We just need to update the row. The trigger checks overlaps excluding the current row.
  
  UPDATE public.doctor_appointments
  SET start_time = p_new_start,
      end_time = p_new_end,
      status = 'rescheduled',
      updated_at = NOW()
  WHERE id = p_appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.reschedule_appointment(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

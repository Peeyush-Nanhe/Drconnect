-- ============================================================================
-- Nursing: a reserved shift has to be visible to the appointment side.
--
-- get_provider_slots reads provider_availability and checks doctor_appointments
-- only, so a nurse booked thirty days straight still shows every half-hour slot
-- as free. check_appointment_overlap has the same blind spot, which means
-- fixing only the slot list would leave the block advisory: anything calling
-- atomic_book_appointment directly still lands on top of a nursing shift.
--
-- Both now read the same [shift_start, shift_end) window.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.nursing_shift_busy(
  p_provider_id uuid, p_from timestamptz, p_to timestamptz
) RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nursing_visits v
     WHERE v.assigned_nurse_id = p_provider_id
       AND v.status IN ('scheduled','en_route','arrived')
       AND v.shift_start IS NOT NULL
       AND tstzrange(v.shift_start, v.shift_end, '[)') && tstzrange(p_from, p_to, '[)'));
$$;
GRANT EXECUTE ON FUNCTION public.nursing_shift_busy(uuid, timestamptz, timestamptz)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_provider_slots(
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
  SELECT * INTO v_availability FROM provider_availability WHERE user_id = p_provider_id;

  IF NOT FOUND OR NOT v_availability.is_online THEN
    RETURN;
  END IF;

  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    IF v_current_date = ANY(v_availability.blocked_dates) THEN
      v_current_date := v_current_date + 1;
      CONTINUE;
    END IF;

    v_day_of_week := lower(to_char(v_current_date, 'dy'));
    v_hours := v_availability.working_hours->v_day_of_week;

    IF v_hours IS NOT NULL AND jsonb_array_length(v_hours) > 0 THEN
      FOR i IN 0 .. jsonb_array_length(v_hours) - 1 LOOP
        v_interval := v_hours->i;
        v_start_time := (v_interval->>'start')::TIME;
        v_end_time := (v_interval->>'end')::TIME;

        v_slot_start := (v_current_date || ' ' || v_start_time || ' ' || v_availability.timezone)::TIMESTAMPTZ;
        v_slot_end := v_slot_start + (p_duration_minutes || ' minutes')::INTERVAL;

        WHILE v_slot_end <= (v_current_date || ' ' || v_end_time || ' ' || v_availability.timezone)::TIMESTAMPTZ LOOP

          SELECT EXISTS (
             SELECT 1 FROM doctor_appointments
             WHERE doctor_appointments.provider_id = p_provider_id
             AND status IN ('confirmed', 'pending', 'rescheduled')
             AND tstzrange(doctor_appointments.start_time, doctor_appointments.end_time, '[)') && tstzrange(v_slot_start, v_slot_end, '[)')
          ) INTO v_is_booked;

          -- A reserved nursing shift takes the whole window with it.
          IF NOT v_is_booked THEN
            v_is_booked := public.nursing_shift_busy(p_provider_id, v_slot_start, v_slot_end);
          END IF;

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

REVOKE EXECUTE ON FUNCTION public.get_provider_slots(UUID, DATE, DATE, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_provider_slots(UUID, DATE, DATE, INT) TO authenticated;

-- The enforcement half. Without this the slot list is only a suggestion.
CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
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

  IF NEW.status IN ('confirmed','pending','rescheduled')
     AND public.nursing_shift_busy(NEW.provider_id, NEW.start_time, NEW.end_time) THEN
    RAISE EXCEPTION 'Appointment overlaps with a reserved nursing shift';
  END IF;

  RETURN NEW;
END $$;

-- The reverse direction: a nurse cannot take a shift over a confirmed
-- appointment either. Same rule, enforced where the nursing row is written.
CREATE OR REPLACE FUNCTION public.nursing_visit_block_appointment_clash()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.assigned_nurse_id IS NOT NULL
     AND NEW.status IN ('scheduled','en_route','arrived')
     AND NEW.shift_start IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.doctor_appointments a
        WHERE a.provider_id = NEW.assigned_nurse_id
          AND a.status IN ('confirmed','pending','rescheduled')
          AND tstzrange(a.start_time, a.end_time, '[)')
           && tstzrange(NEW.shift_start, NEW.shift_end, '[)')) THEN
    RAISE EXCEPTION 'NURSING_NURSE_BUSY: That shift overlaps an appointment already in the diary.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_nursing_visit_appointment_clash ON public.nursing_visits;
CREATE TRIGGER tr_nursing_visit_appointment_clash
  BEFORE INSERT OR UPDATE OF assigned_nurse_id, status, shift_start ON public.nursing_visits
  FOR EACH ROW EXECUTE FUNCTION public.nursing_visit_block_appointment_clash();

-- Hosted Supabase preserves explicit default grants separately from PUBLIC.
-- Revoke only the four inherited scheduling RPC grants identified by advisors.
REVOKE EXECUTE ON FUNCTION public.atomic_book_appointment(uuid,uuid,timestamptz,timestamptz,text,numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_appointment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_provider_slots(uuid,date,date,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reschedule_appointment(uuid,timestamptz,timestamptz) FROM anon;

-- Foreign-key indexes support owner lookup, synthetic fixture cleanup and
-- restricted access without broadening any role's grants or changing history.
CREATE INDEX doctor_appointments_patient_idx ON public.doctor_appointments(patient_id);
CREATE INDEX home_visit_quotes_provider_idx ON public.home_visit_quotes(provider_id);
CREATE INDEX home_visit_quotes_booking_idx ON public.home_visit_quotes(booking_id);
CREATE INDEX home_visit_details_patient_idx ON public.home_visit_details(patient_id);
CREATE INDEX home_visit_consents_actor_idx ON public.home_visit_consents(actor_id);
CREATE INDEX home_visit_consents_patient_idx ON public.home_visit_consents(patient_id);
CREATE INDEX home_visit_events_actor_idx ON public.home_visit_events(actor_id);
CREATE INDEX home_visit_encounters_author_idx ON public.home_visit_encounters(author_id);
CREATE INDEX home_visit_settlements_actor_idx ON public.home_visit_settlements(actor_id);
CREATE INDEX home_visit_holds_quote_idx ON public.home_visit_reschedule_holds(quote_id);
CREATE INDEX home_visit_holds_requester_idx ON public.home_visit_reschedule_holds(requested_by);
CREATE INDEX home_visit_jobs_booking_idx ON public.home_visit_notification_jobs(booking_id);
CREATE INDEX home_visit_jobs_event_idx ON public.home_visit_notification_jobs(event_id);
CREATE INDEX home_visit_jobs_recipient_idx ON public.home_visit_notification_jobs(recipient_id);
CREATE INDEX home_visit_disputes_actor_idx ON public.home_visit_disputes(actor_id);

-- Bound the inherited generic slot iterator and use the same capacity view.
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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authenticated caller required'; END IF;
  IF p_provider_id IS NULL OR p_start_date IS NULL OR p_end_date IS NULL
     OR p_end_date<p_start_date OR p_end_date-p_start_date>62
     OR p_duration_minutes IS NULL OR p_duration_minutes NOT BETWEEN 5 AND 240 THEN
    RAISE EXCEPTION 'Slot discovery requires a date range of at most 62 days and a duration from 5 to 240 minutes';
  END IF;
  -- 1. Fetch provider availability
  SELECT * INTO v_availability FROM public.provider_availability WHERE user_id = p_provider_id;

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
          v_is_booked := private.hv_busy(p_provider_id,v_slot_start,v_slot_end);

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.get_provider_slots(UUID, DATE, DATE, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_slots(UUID, DATE, DATE, INT) TO authenticated;


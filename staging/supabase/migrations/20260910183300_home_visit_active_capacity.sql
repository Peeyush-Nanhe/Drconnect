-- An overdue confirmed appointment retains its agreed start/end for history.
-- Those past instants cannot be used to admit travel around current work.
CREATE FUNCTION private.hv_active_capacity_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  admitting boolean;
  actual_start timestamptz;
  actual_end timestamptz;
BEGIN
  IF NEW.mode IS DISTINCT FROM 'home_visit'
     OR NOT COALESCE(NEW.home_visit_status IN ('en_route','arrived','in_consultation'),false) THEN
    RETURN NEW;
  END IF;
  IF NEW.provider_id IS NULL OR NEW.end_time<=NEW.start_time THEN
    RAISE EXCEPTION 'Active home visit requires an assigned doctor and valid duration';
  END IF;

  PERFORM private.hv_lock(NEW.provider_id);
  IF EXISTS (
    SELECT 1 FROM public.doctor_appointments a
    WHERE a.id<>NEW.id AND a.provider_id=NEW.provider_id AND a.mode='home_visit'
      AND a.home_visit_status IN ('en_route','arrived','in_consultation')
  ) THEN
    RAISE EXCEPTION 'Doctor already has an active home visit; finish it before starting another';
  END IF;

  admitting:=TG_OP='INSERT';
  IF TG_OP='UPDATE' THEN
    admitting:=OLD.home_visit_status IS NULL
      OR OLD.home_visit_status NOT IN ('en_route','arrived','in_consultation')
      OR OLD.provider_id IS DISTINCT FROM NEW.provider_id;
  END IF;
  IF NEW.home_visit_status='in_consultation' AND (
    TG_OP='INSERT' OR OLD.home_visit_status IS DISTINCT FROM 'in_consultation'
  ) AND NOT private.hv_doctor(NEW.provider_id) THEN
    RAISE EXCEPTION 'Currently authorised registration-verified doctor required to start consultation';
  END IF;
  IF admitting THEN
    -- Consult the actual server clock after obtaining the shared provider lock.
    -- Published buffers are capacity allowances, not a promised travel ETA.
    actual_start:=clock_timestamp();
    actual_end:=greatest(NEW.end_time,
      actual_start+make_interval(mins=>NEW.home_buffer_before_minutes)
        +(NEW.end_time-NEW.start_time))
      +make_interval(mins=>NEW.home_buffer_after_minutes);
    IF private.hv_busy(NEW.provider_id,actual_start,actual_end,NEW.id) THEN
      RAISE EXCEPTION 'Starting travel now conflicts with current or upcoming provider capacity';
    END IF;
  END IF;
  -- Existing active visits may still acknowledge arrival, start consultation and
  -- save care even when delayed. Their shared occupancy already blocks new work.
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.hv_active_capacity_guard() FROM PUBLIC,anon,authenticated;

-- BEFORE triggers fire alphabetically: run this before tr_check_appointment_overlap.
CREATE TRIGGER home_visit_active_capacity
BEFORE INSERT OR UPDATE OF home_visit_status,provider_id
ON public.doctor_appointments
FOR EACH ROW EXECUTE FUNCTION private.hv_active_capacity_guard();

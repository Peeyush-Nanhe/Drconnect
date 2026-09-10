-- Expiring a replacement is an audited state change, while the original
-- appointment and its agreed quote remain intact. Lock in the same order used
-- by patient/doctor actions: appointment, details, then replacement hold.
CREATE OR REPLACE FUNCTION public.hv_expire_pending(
  p_limit integer DEFAULT 100,
  p_booking_ids uuid[] DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  appointment record;
  replacement public.home_visit_reschedule_holds;
  changes integer:=0;
  batch_limit integer:=least(greatest(COALESCE(p_limit,100),1),500);
BEGIN
  FOR appointment IN
    SELECT a.id FROM public.doctor_appointments a
    JOIN public.home_visit_details d ON d.booking_id=a.id
    WHERE a.mode='home_visit' AND a.home_visit_status='pending' AND a.status='pending'
      AND d.pending_deadline<=now()
      AND (p_booking_ids IS NULL OR a.id=ANY(p_booking_ids))
    ORDER BY d.pending_deadline FOR UPDATE OF a SKIP LOCKED LIMIT batch_limit
  LOOP
    PERFORM 1 FROM public.home_visit_details WHERE booking_id=appointment.id FOR UPDATE;
    UPDATE public.doctor_appointments SET status='cancelled',home_visit_status='expired',updated_at=now()
      WHERE id=appointment.id AND status='pending' AND home_visit_status='pending';
    IF FOUND THEN
      UPDATE public.home_visit_details SET version=version+1 WHERE booking_id=appointment.id;
      PERFORM private.hv_event(appointment.id,'expired');
      changes:=changes+1;
    END IF;
  END LOOP;

  FOR appointment IN
    SELECT a.id FROM public.doctor_appointments a
    JOIN public.home_visit_reschedule_holds h ON h.booking_id=a.id
    WHERE h.expires_at<=now()
      AND (p_booking_ids IS NULL OR a.id=ANY(p_booking_ids))
    ORDER BY h.expires_at FOR UPDATE OF a SKIP LOCKED LIMIT batch_limit
  LOOP
    PERFORM 1 FROM public.home_visit_details WHERE booking_id=appointment.id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT * INTO replacement FROM public.home_visit_reschedule_holds
      WHERE booking_id=appointment.id AND expires_at<=now() FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    DELETE FROM public.home_visit_reschedule_holds WHERE booking_id=appointment.id;
    UPDATE public.home_visit_details SET version=version+1 WHERE booking_id=appointment.id;
    PERFORM private.hv_event(appointment.id,'reschedule_expired');
    changes:=changes+1;
  END LOOP;
  RETURN changes;
END;
$$;
REVOKE ALL ON FUNCTION public.hv_expire_pending(integer,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hv_expire_pending(integer,uuid[]) TO service_role;

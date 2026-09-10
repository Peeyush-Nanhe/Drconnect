
-- ═════════════ 1. Patient flow: mutual ratings + chat expiry ═════════════
ALTER TABLE public.care_requests
  ADD COLUMN IF NOT EXISTS rating_patient smallint,
  ADD COLUMN IF NOT EXISTS rating_patient_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating_provider smallint,
  ADD COLUMN IF NOT EXISTS rating_provider_at timestamptz,
  ADD COLUMN IF NOT EXISTS chat_expires_at timestamptz;

-- Extend care_request update guard: ratings + chat expiry
CREATE OR REPLACE FUNCTION public.enforce_care_request_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin');
  IF is_admin THEN
    IF NEW.otp_verified_at IS NOT NULL AND OLD.otp_verified_at IS NULL AND NEW.chat_expires_at IS NULL THEN
      NEW.chat_expires_at := now() + interval '24 hours';
    END IF;
    RETURN NEW;
  END IF;

  -- Provider accept
  IF OLD.accepted_by IS NULL AND OLD.status = 'open' AND NEW.status = 'accepted'
     AND NEW.accepted_by = auth.uid() AND public.has_role(auth.uid(), 'provider') THEN
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN RAISE EXCEPTION 'cannot change patient_id'; END IF;
    IF NEW.arrival_deadline IS NULL THEN NEW.arrival_deadline := now() + interval '15 minutes'; END IF;
    RETURN NEW;
  END IF;

  -- Provider (accepted this request)
  IF OLD.accepted_by IS NOT NULL AND OLD.accepted_by = auth.uid() THEN
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN RAISE EXCEPTION 'cannot change patient_id'; END IF;
    IF NEW.accepted_by IS DISTINCT FROM OLD.accepted_by THEN RAISE EXCEPTION 'cannot change accepted_by'; END IF;
    IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN RAISE EXCEPTION 'provider cannot change paid_at'; END IF;
    IF NEW.otp IS DISTINCT FROM OLD.otp THEN RAISE EXCEPTION 'provider cannot change otp'; END IF;
    IF NEW.rating_patient IS DISTINCT FROM OLD.rating_patient THEN RAISE EXCEPTION 'provider cannot change rating_patient'; END IF;
    IF OLD.rating_provider IS NOT NULL AND NEW.rating_provider IS DISTINCT FROM OLD.rating_provider THEN
      RAISE EXCEPTION 'rating_provider already set';
    END IF;
    IF NEW.rating_provider IS DISTINCT FROM OLD.rating_provider AND NEW.rating_provider IS NOT NULL THEN
      NEW.rating_provider_at := now();
    END IF;
    IF NEW.otp_verified_at IS DISTINCT FROM OLD.otp_verified_at AND OLD.otp_verified_at IS NOT NULL THEN
      RAISE EXCEPTION 'otp_verified_at already set';
    END IF;
    IF NEW.otp_verified_at IS NOT NULL AND OLD.otp_verified_at IS NULL AND OLD.otp IS NULL THEN
      RAISE EXCEPTION 'cannot verify OTP before patient payment';
    END IF;
    IF NEW.otp_verified_at IS NOT NULL AND OLD.otp_verified_at IS NULL AND NEW.chat_expires_at IS NULL THEN
      NEW.chat_expires_at := now() + interval '24 hours';
    END IF;
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- Patient
  IF OLD.patient_id = auth.uid() THEN
    IF NEW.accepted_by IS DISTINCT FROM OLD.accepted_by THEN RAISE EXCEPTION 'patient cannot change accepted_by'; END IF;
    IF NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN RAISE EXCEPTION 'patient cannot change accepted_at'; END IF;
    IF NEW.fare IS DISTINCT FROM OLD.fare THEN RAISE EXCEPTION 'patient cannot change fare'; END IF;
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN RAISE EXCEPTION 'cannot change patient_id'; END IF;
    IF NEW.otp_verified_at IS DISTINCT FROM OLD.otp_verified_at THEN
      IF OLD.otp_verified_at IS NOT NULL THEN RAISE EXCEPTION 'otp_verified_at already set'; END IF;
      IF NEW.chat_expires_at IS NULL THEN NEW.chat_expires_at := now() + interval '24 hours'; END IF;
    END IF;
    IF NEW.rating_provider IS DISTINCT FROM OLD.rating_provider THEN RAISE EXCEPTION 'patient cannot change rating_provider'; END IF;
    IF OLD.rating_patient IS NOT NULL AND NEW.rating_patient IS DISTINCT FROM OLD.rating_patient THEN
      RAISE EXCEPTION 'rating_patient already set';
    END IF;
    IF NEW.rating_patient IS DISTINCT FROM OLD.rating_patient AND NEW.rating_patient IS NOT NULL THEN
      NEW.rating_patient_at := now();
    END IF;
    IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN RAISE EXCEPTION 'paid_at already set'; END IF;
    IF OLD.otp IS NOT NULL AND NEW.otp IS DISTINCT FROM OLD.otp THEN RAISE EXCEPTION 'otp already set'; END IF;
    IF OLD.amount IS NOT NULL AND NEW.amount IS DISTINCT FROM OLD.amount THEN RAISE EXCEPTION 'amount already set'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
      IF OLD.status = 'accepted' AND NEW.status = 'completed' AND OLD.accepted_by IS NOT NULL THEN
        IF NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'patient can only cancel their request or complete an accepted session';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'not authorized to update care_request';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_care_request_update() FROM PUBLIC, anon, authenticated;

-- ═════════════ 2. Surgery flow: arrival deadline + fail + audit ═════════════
ALTER TABLE public.surgery_booking_roles
  ADD COLUMN IF NOT EXISTS arrival_deadline timestamptz;

-- Optional booking_role_id column on shared audit log
ALTER TABLE public.request_audit_log
  ADD COLUMN IF NOT EXISTS booking_role_id uuid,
  ADD COLUMN IF NOT EXISTS booking_id uuid;

ALTER TABLE public.request_audit_log
  ALTER COLUMN request_id DROP NOT NULL;

-- Extend surgery role update guard: arrival on accept, failed status, ratings symmetry
CREATE OR REPLACE FUNCTION public.enforce_surgery_role_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hub uuid;
  v_booking public.surgery_bookings%ROWTYPE;
  is_admin boolean;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin');
  IF is_admin THEN
    IF NEW.otp_verified_at IS NOT NULL AND OLD.otp_verified_at IS NULL AND NEW.chat_expires_at IS NULL THEN
      NEW.chat_expires_at := now() + interval '24 hours';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO v_booking FROM public.surgery_bookings WHERE id = NEW.booking_id;
  v_hub := v_booking.facility_id;

  -- Auto-set arrival_deadline on accept (any actor)
  IF (OLD.status IS DISTINCT FROM 'accepted') AND NEW.status = 'accepted' AND NEW.arrival_deadline IS NULL THEN
    IF v_booking.mode = 'planned' AND v_booking.scheduled_at IS NOT NULL THEN
      NEW.arrival_deadline := v_booking.scheduled_at;
    ELSE
      NEW.arrival_deadline := now() + interval '30 minutes';
    END IF;
  END IF;

  -- Hub path
  IF v_hub = auth.uid() THEN
    IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN RAISE EXCEPTION 'paid_at already set'; END IF;
    IF OLD.otp IS NOT NULL AND NEW.otp IS DISTINCT FROM OLD.otp THEN RAISE EXCEPTION 'otp already set'; END IF;
    IF OLD.rating_hub IS NOT NULL AND NEW.rating_hub IS DISTINCT FROM OLD.rating_hub THEN RAISE EXCEPTION 'rating_hub already set'; END IF;
    IF NEW.rating_hub IS DISTINCT FROM OLD.rating_hub AND NEW.rating_hub IS NOT NULL THEN NEW.rating_hub_at := now(); END IF;
    IF NEW.otp_verified_at IS DISTINCT FROM OLD.otp_verified_at AND OLD.otp_verified_at IS NOT NULL THEN
      RAISE EXCEPTION 'otp_verified_at already set';
    END IF;
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- Provider path
  IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to = auth.uid() THEN
    IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN RAISE EXCEPTION 'provider cannot change paid_at'; END IF;
    IF NEW.otp IS DISTINCT FROM OLD.otp THEN RAISE EXCEPTION 'provider cannot change otp'; END IF;
    IF NEW.rating_hub IS DISTINCT FROM OLD.rating_hub THEN RAISE EXCEPTION 'provider cannot change rating_hub'; END IF;
    IF OLD.rating_provider IS NOT NULL AND NEW.rating_provider IS DISTINCT FROM OLD.rating_provider THEN
      RAISE EXCEPTION 'rating_provider already set';
    END IF;
    IF NEW.rating_provider IS DISTINCT FROM OLD.rating_provider AND NEW.rating_provider IS NOT NULL THEN
      NEW.rating_provider_at := now();
    END IF;
    IF NEW.otp_verified_at IS DISTINCT FROM OLD.otp_verified_at THEN
      IF OLD.otp_verified_at IS NOT NULL THEN RAISE EXCEPTION 'otp_verified_at already set'; END IF;
      IF OLD.otp IS NULL THEN RAISE EXCEPTION 'cannot verify OTP before hub confirms'; END IF;
      IF NEW.chat_expires_at IS NULL THEN NEW.chat_expires_at := now() + interval '24 hours'; END IF;
    END IF;
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_surgery_role_update() FROM PUBLIC, anon, authenticated;

-- ═════════════ 3. Surgery lifecycle audit log ═════════════
CREATE OR REPLACE FUNCTION public.log_surgery_role_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking public.surgery_bookings%ROWTYPE;
  evt text;
  note_txt text;
BEGIN
  SELECT * INTO v_booking FROM public.surgery_bookings WHERE id = COALESCE(NEW.booking_id, OLD.booking_id);

  IF TG_OP = 'INSERT' THEN
    evt := 'surgery_role_created';
    note_txt := 'Role invitation created: ' || NEW.role;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      evt := 'surgery_role_' || NEW.status;
      note_txt := 'Role ' || NEW.role || ' → ' || NEW.status;
    ELSIF NEW.paid_at IS DISTINCT FROM OLD.paid_at AND NEW.paid_at IS NOT NULL THEN
      evt := 'surgery_otp_generated'; note_txt := 'Hub generated OTP for ' || NEW.role;
    ELSIF NEW.otp_verified_at IS DISTINCT FROM OLD.otp_verified_at AND NEW.otp_verified_at IS NOT NULL THEN
      evt := 'surgery_otp_verified'; note_txt := 'OTP exchanged for ' || NEW.role;
    ELSIF NEW.rating_hub IS DISTINCT FROM OLD.rating_hub AND NEW.rating_hub IS NOT NULL THEN
      evt := 'surgery_rating_hub'; note_txt := 'Hub rated ' || NEW.role || ': ' || NEW.rating_hub || '★';
    ELSIF NEW.rating_provider IS DISTINCT FROM OLD.rating_provider AND NEW.rating_provider IS NOT NULL THEN
      evt := 'surgery_rating_provider'; note_txt := 'Provider rated hub: ' || NEW.rating_provider || '★';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.request_audit_log
    (request_id, booking_id, booking_role_id, actor_id, actor_role, event_type, stage, note, metadata)
  VALUES (
    NULL,
    COALESCE(NEW.booking_id, OLD.booking_id),
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    CASE
      WHEN public.has_role(auth.uid(), 'super_admin') THEN 'super_admin'
      WHEN public.has_role(auth.uid(), 'admin') THEN 'admin'
      WHEN v_booking.facility_id = auth.uid() THEN 'facility'
      WHEN NEW.assigned_to = auth.uid() THEN 'provider'
      ELSE 'system'
    END,
    evt,
    NEW.notification_stage,
    note_txt,
    jsonb_build_object(
      'procedure', v_booking.procedure,
      'role', NEW.role,
      'status', NEW.status,
      'assigned_to', NEW.assigned_to
    )
  );
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_surgery_role_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_surgery_role_event ON public.surgery_booking_roles;
CREATE TRIGGER trg_log_surgery_role_event
AFTER INSERT OR UPDATE ON public.surgery_booking_roles
FOR EACH ROW EXECUTE FUNCTION public.log_surgery_role_event();

-- Broaden audit log RLS SELECT so facility can see their own booking audit
DROP POLICY IF EXISTS "audit_view_related" ON public.request_audit_log;
CREATE POLICY "audit_view_related" ON public.request_audit_log
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  OR (request_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.care_requests cr WHERE cr.id = request_id
      AND (cr.patient_id = auth.uid() OR cr.accepted_by = auth.uid())
  ))
  OR (booking_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.surgery_bookings sb WHERE sb.id = booking_id AND sb.facility_id = auth.uid()
  ))
  OR (booking_role_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.surgery_booking_roles sbr WHERE sbr.id = booking_role_id AND sbr.assigned_to = auth.uid()
  ))
);

-- ═════════════ 4. Auto-favorite hub provider on first completion ═════════════
CREATE OR REPLACE FUNCTION public.autosave_hub_favorite()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hub uuid;
  v_name text;
  v_next_slot smallint;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.assigned_to IS NOT NULL THEN
    SELECT facility_id INTO v_hub FROM public.surgery_bookings WHERE id = NEW.booking_id;
    IF v_hub IS NULL THEN RETURN NEW; END IF;

    -- Skip if already saved
    IF EXISTS (
      SELECT 1 FROM public.hub_favorite_providers
      WHERE hub_id = v_hub AND kind = 'surgery' AND category = NEW.role AND provider_id = NEW.assigned_to
    ) THEN RETURN NEW; END IF;

    SELECT COALESCE(MIN(s), 1) INTO v_next_slot
    FROM generate_series(1, 4) s
    WHERE s NOT IN (
      SELECT slot FROM public.hub_favorite_providers
      WHERE hub_id = v_hub AND kind = 'surgery' AND category = NEW.role
    );

    IF v_next_slot IS NULL THEN RETURN NEW; END IF;

    SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.assigned_to;

    INSERT INTO public.hub_favorite_providers (hub_id, kind, category, provider_id, provider_name, slot)
    VALUES (v_hub, 'surgery', NEW.role, NEW.assigned_to, v_name, v_next_slot)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.autosave_hub_favorite() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_autosave_hub_favorite ON public.surgery_booking_roles;
CREATE TRIGGER trg_autosave_hub_favorite
AFTER UPDATE ON public.surgery_booking_roles
FOR EACH ROW EXECUTE FUNCTION public.autosave_hub_favorite();

-- ═════════════ 5. Booking-level rollup ═════════════
CREATE OR REPLACE FUNCTION public.rollup_surgery_booking_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_open int;
  v_total int;
  v_completed int;
  v_current text;
BEGIN
  SELECT status INTO v_current FROM public.surgery_bookings WHERE id = NEW.booking_id;
  IF v_current IN ('cancelled', 'completed') THEN RETURN NEW; END IF;

  -- in_progress on first OTP verify
  IF NEW.otp_verified_at IS NOT NULL AND OLD.otp_verified_at IS NULL AND v_current <> 'in_progress' THEN
    UPDATE public.surgery_bookings SET status = 'in_progress', updated_at = now()
      WHERE id = NEW.booking_id AND status IN ('broadcasting','confirmed');
  END IF;

  -- completed when every accepted role is completed
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT
      COUNT(*) FILTER (WHERE status = 'accepted' AND completed_at IS NULL),
      COUNT(*) FILTER (WHERE status = 'accepted'),
      COUNT(*) FILTER (WHERE completed_at IS NOT NULL)
    INTO v_open, v_total, v_completed
    FROM public.surgery_booking_roles WHERE booking_id = NEW.booking_id;
    IF v_open = 0 AND v_completed > 0 THEN
      UPDATE public.surgery_bookings SET status = 'completed', updated_at = now()
        WHERE id = NEW.booking_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.rollup_surgery_booking_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_rollup_surgery_booking_status ON public.surgery_booking_roles;
CREATE TRIGGER trg_rollup_surgery_booking_status
AFTER UPDATE ON public.surgery_booking_roles
FOR EACH ROW EXECUTE FUNCTION public.rollup_surgery_booking_status();

-- ═════════════ 6. Cascade booking cancellation to pending roles ═════════════
CREATE OR REPLACE FUNCTION public.cascade_surgery_booking_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.surgery_booking_roles
      SET status = 'declined', updated_at = now()
      WHERE booking_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cascade_surgery_booking_cancel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cascade_surgery_booking_cancel ON public.surgery_bookings;
CREATE TRIGGER trg_cascade_surgery_booking_cancel
AFTER UPDATE ON public.surgery_bookings
FOR EACH ROW EXECUTE FUNCTION public.cascade_surgery_booking_cancel();

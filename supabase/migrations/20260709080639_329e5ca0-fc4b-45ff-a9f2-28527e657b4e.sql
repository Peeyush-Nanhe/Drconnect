
ALTER TABLE public.care_requests
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS otp text,
  ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_care_requests_accepted_by_status
  ON public.care_requests(accepted_by, status);

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
    RETURN NEW;
  END IF;

  -- Provider accept path: open → accepted
  IF OLD.accepted_by IS NULL
     AND OLD.status = 'open'
     AND NEW.status = 'accepted'
     AND NEW.accepted_by = auth.uid()
     AND public.has_role(auth.uid(), 'provider') THEN
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
      RAISE EXCEPTION 'cannot change patient_id';
    END IF;
    -- On accept, auto-set arrival_deadline = now()+15min if not provided.
    IF NEW.arrival_deadline IS NULL THEN
      NEW.arrival_deadline := now() + interval '15 minutes';
    END IF;
    RETURN NEW;
  END IF;

  -- Provider path (already accepted by this user): may update status/notes/otp_verified_at/completed_at
  IF OLD.accepted_by IS NOT NULL AND OLD.accepted_by = auth.uid() THEN
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
      RAISE EXCEPTION 'cannot change patient_id';
    END IF;
    IF NEW.accepted_by IS DISTINCT FROM OLD.accepted_by THEN
      RAISE EXCEPTION 'cannot change accepted_by';
    END IF;
    IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
      RAISE EXCEPTION 'provider cannot change paid_at';
    END IF;
    IF NEW.otp IS DISTINCT FROM OLD.otp THEN
      RAISE EXCEPTION 'provider cannot change otp';
    END IF;
    -- OTP verify requires the entered OTP to already match the row's otp (client sets otp_verified_at only after matching).
    IF NEW.otp_verified_at IS DISTINCT FROM OLD.otp_verified_at
       AND OLD.otp_verified_at IS NOT NULL THEN
      RAISE EXCEPTION 'otp_verified_at already set';
    END IF;
    IF NEW.otp_verified_at IS NOT NULL AND OLD.otp_verified_at IS NULL AND OLD.otp IS NULL THEN
      RAISE EXCEPTION 'cannot verify OTP before patient payment';
    END IF;
    -- On completion, stamp completed_at if not provided
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- Patient path
  IF OLD.patient_id = auth.uid() THEN
    IF NEW.accepted_by IS DISTINCT FROM OLD.accepted_by THEN
      RAISE EXCEPTION 'patient cannot change accepted_by';
    END IF;
    IF NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
      RAISE EXCEPTION 'patient cannot change accepted_at';
    END IF;
    IF NEW.fare IS DISTINCT FROM OLD.fare THEN
      RAISE EXCEPTION 'patient cannot change fare';
    END IF;
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
      RAISE EXCEPTION 'cannot change patient_id';
    END IF;
    IF NEW.otp_verified_at IS DISTINCT FROM OLD.otp_verified_at THEN
      RAISE EXCEPTION 'patient cannot change otp_verified_at';
    END IF;
    -- Patient may set paid_at/amount/otp only once (immutable after set)
    IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
      RAISE EXCEPTION 'paid_at already set';
    END IF;
    IF OLD.otp IS NOT NULL AND NEW.otp IS DISTINCT FROM OLD.otp THEN
      RAISE EXCEPTION 'otp already set';
    END IF;
    IF OLD.amount IS NOT NULL AND NEW.amount IS DISTINCT FROM OLD.amount THEN
      RAISE EXCEPTION 'amount already set';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'cancelled' THEN
        RETURN NEW;
      END IF;
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

DROP TRIGGER IF EXISTS trg_enforce_care_request_update ON public.care_requests;
CREATE TRIGGER trg_enforce_care_request_update
  BEFORE UPDATE ON public.care_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_care_request_update();

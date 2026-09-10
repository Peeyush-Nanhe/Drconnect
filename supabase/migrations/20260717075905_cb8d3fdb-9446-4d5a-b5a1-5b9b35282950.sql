
ALTER TABLE public.surgery_booking_roles
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS otp text,
  ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS chat_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating_hub smallint,
  ADD COLUMN IF NOT EXISTS rating_hub_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating_provider smallint,
  ADD COLUMN IF NOT EXISTS rating_provider_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_surgery_role_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hub uuid;
  is_admin boolean;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin');
  IF is_admin THEN
    IF NEW.otp_verified_at IS NOT NULL AND OLD.otp_verified_at IS NULL AND NEW.chat_expires_at IS NULL THEN
      NEW.chat_expires_at := now() + interval '24 hours';
    END IF;
    RETURN NEW;
  END IF;

  SELECT facility_id INTO v_hub FROM public.surgery_bookings WHERE id = NEW.booking_id;

  -- Hub (booking owner) path
  IF v_hub = auth.uid() THEN
    IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
      RAISE EXCEPTION 'paid_at already set';
    END IF;
    IF OLD.otp IS NOT NULL AND NEW.otp IS DISTINCT FROM OLD.otp THEN
      RAISE EXCEPTION 'otp already set';
    END IF;
    IF OLD.rating_hub IS NOT NULL AND NEW.rating_hub IS DISTINCT FROM OLD.rating_hub THEN
      RAISE EXCEPTION 'rating_hub already set';
    END IF;
    IF NEW.rating_hub IS DISTINCT FROM OLD.rating_hub AND NEW.rating_hub IS NOT NULL THEN
      NEW.rating_hub_at := now();
    END IF;
    IF NEW.otp_verified_at IS DISTINCT FROM OLD.otp_verified_at AND OLD.otp_verified_at IS NOT NULL THEN
      RAISE EXCEPTION 'otp_verified_at already set';
    END IF;
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- Provider (accepted user) path
  IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to = auth.uid() THEN
    IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
      RAISE EXCEPTION 'provider cannot change paid_at';
    END IF;
    IF NEW.otp IS DISTINCT FROM OLD.otp THEN
      RAISE EXCEPTION 'provider cannot change otp';
    END IF;
    IF NEW.rating_hub IS DISTINCT FROM OLD.rating_hub THEN
      RAISE EXCEPTION 'provider cannot change rating_hub';
    END IF;
    IF OLD.rating_provider IS NOT NULL AND NEW.rating_provider IS DISTINCT FROM OLD.rating_provider THEN
      RAISE EXCEPTION 'rating_provider already set';
    END IF;
    IF NEW.rating_provider IS DISTINCT FROM OLD.rating_provider AND NEW.rating_provider IS NOT NULL THEN
      NEW.rating_provider_at := now();
    END IF;
    IF NEW.otp_verified_at IS DISTINCT FROM OLD.otp_verified_at THEN
      IF OLD.otp_verified_at IS NOT NULL THEN RAISE EXCEPTION 'otp_verified_at already set'; END IF;
      IF OLD.otp IS NULL THEN RAISE EXCEPTION 'cannot verify OTP before hub confirms'; END IF;
      IF NEW.chat_expires_at IS NULL THEN
        NEW.chat_expires_at := now() + interval '24 hours';
      END IF;
    END IF;
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- If neither hub nor provider match, fall back to existing accept-path rules
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_surgery_role_enforce_update ON public.surgery_booking_roles;
CREATE TRIGGER trg_surgery_role_enforce_update
BEFORE UPDATE ON public.surgery_booking_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_surgery_role_update();

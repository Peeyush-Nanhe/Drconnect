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

  -- Provider accept path: open → accepted, claiming the row for themselves.
  IF OLD.accepted_by IS NULL
     AND OLD.status = 'open'
     AND NEW.status = 'accepted'
     AND NEW.accepted_by = auth.uid()
     AND public.has_role(auth.uid(), 'provider') THEN
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
      RAISE EXCEPTION 'cannot change patient_id';
    END IF;
    RETURN NEW;
  END IF;

  -- Provider path (already accepted by this user): may update status/notes; cannot rewrite ownership fields
  IF OLD.accepted_by IS NOT NULL AND OLD.accepted_by = auth.uid() THEN
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
      RAISE EXCEPTION 'cannot change patient_id';
    END IF;
    IF NEW.accepted_by IS DISTINCT FROM OLD.accepted_by THEN
      RAISE EXCEPTION 'cannot change accepted_by';
    END IF;
    RETURN NEW;
  END IF;

  -- Patient path: can cancel their own request, or complete an accepted session;
  -- cannot self-assign a provider, fake acceptance, or rewrite fare/ownership fields.
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
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'cancelled' THEN
        RETURN NEW;
      END IF;
      IF OLD.status = 'accepted' AND NEW.status = 'completed' AND OLD.accepted_by IS NOT NULL THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'patient can only cancel their request or complete an accepted session';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'not authorized to update care_request';
END;
$function$;
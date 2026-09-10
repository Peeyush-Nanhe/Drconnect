
-- 1. Extend care_requests with per-stage tracking
ALTER TABLE public.care_requests
  ADD COLUMN IF NOT EXISTS notification_stage TEXT,
  ADD COLUMN IF NOT EXISTS stage_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS my_doctor_id UUID,
  ADD COLUMN IF NOT EXISTS preferred_id UUID;

-- Allow provider trigger to update these fields safely: relax enforce_care_request_update
-- Existing trigger already permits patient status transitions to 'open'/'cancelled';
-- we only add columns, no policy change needed for patient path.

-- 2. Create audit log table
CREATE TABLE IF NOT EXISTS public.request_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.care_requests(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_role TEXT,
  event_type TEXT NOT NULL,
  stage TEXT,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_audit_log_request_created
  ON public.request_audit_log (request_id, created_at DESC);

GRANT SELECT, INSERT ON public.request_audit_log TO authenticated;
GRANT ALL ON public.request_audit_log TO service_role;

ALTER TABLE public.request_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: patient of the request, current accepted_by provider, or admin/super_admin
CREATE POLICY "audit_select_participants_or_admin"
  ON public.request_audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.care_requests cr
      WHERE cr.id = request_audit_log.request_id
        AND (cr.patient_id = auth.uid() OR cr.accepted_by = auth.uid())
    )
  );

-- INSERT: any signed-in user, but only for a request they can see, and actor_id must be them (or null for system-like logs from client we still stamp)
CREATE POLICY "audit_insert_participants_or_admin"
  ON public.request_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (actor_id IS NULL OR actor_id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.care_requests cr
        WHERE cr.id = request_audit_log.request_id
          AND (cr.patient_id = auth.uid() OR cr.accepted_by = auth.uid() OR cr.status = 'open')
      )
    )
  );

-- 3. Auto-log lifecycle events on care_requests
CREATE OR REPLACE FUNCTION public.log_care_request_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evt TEXT;
  stg TEXT;
  note_txt TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    evt := 'request_created';
    stg := NEW.notification_stage;
    note_txt := 'Request created for ' || COALESCE(NEW.specialty, 'general');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      evt := 'status_' || NEW.status;
      stg := NEW.notification_stage;
      IF NEW.status = 'accepted' THEN
        note_txt := 'Provider accepted the request';
      ELSIF NEW.status = 'completed' THEN
        note_txt := 'Request completed';
      ELSIF NEW.status = 'cancelled' THEN
        note_txt := 'Request cancelled';
      ELSE
        note_txt := 'Status changed to ' || NEW.status;
      END IF;
    ELSIF NEW.notification_stage IS DISTINCT FROM OLD.notification_stage THEN
      evt := 'stage_' || COALESCE(NEW.notification_stage, 'cleared');
      stg := NEW.notification_stage;
      note_txt := 'Notification stage moved to ' || COALESCE(NEW.notification_stage, 'none');
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.request_audit_log (request_id, actor_id, actor_role, event_type, stage, note, metadata)
  VALUES (
    NEW.id,
    auth.uid(),
    CASE
      WHEN public.has_role(auth.uid(), 'super_admin') THEN 'super_admin'
      WHEN public.has_role(auth.uid(), 'admin') THEN 'admin'
      WHEN NEW.accepted_by = auth.uid() THEN 'provider'
      WHEN NEW.patient_id = auth.uid() THEN 'patient'
      ELSE 'system'
    END,
    evt,
    stg,
    note_txt,
    jsonb_build_object(
      'status', NEW.status,
      'accepted_by', NEW.accepted_by,
      'my_doctor_id', NEW.my_doctor_id,
      'preferred_id', NEW.preferred_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_care_request_event ON public.care_requests;
CREATE TRIGGER trg_log_care_request_event
AFTER INSERT OR UPDATE ON public.care_requests
FOR EACH ROW EXECUTE FUNCTION public.log_care_request_event();

-- 4. Realtime for audit log
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_audit_log;

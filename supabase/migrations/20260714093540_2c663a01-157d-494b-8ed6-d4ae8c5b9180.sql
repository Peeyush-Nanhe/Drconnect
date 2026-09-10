
-- Fix profiles overexposure: replace blanket authenticated SELECT
DROP POLICY IF EXISTS "profiles readable non-sensitive" ON public.profiles;

CREATE POLICY "own profile select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.care_requests cr
      WHERE (
        (cr.patient_id = auth.uid() AND cr.accepted_by = public.profiles.id)
        OR (cr.accepted_by = auth.uid() AND cr.patient_id = public.profiles.id)
      )
      AND cr.status IN ('accepted','completed')
    )
  );

-- Fix hubs public exposure: require authentication
DROP POLICY IF EXISTS "hubs readable" ON public.hubs;

CREATE POLICY "hubs readable to authenticated"
  ON public.hubs FOR SELECT
  TO authenticated
  USING (true);

-- Fix care_requests pre-acceptance leak: restrict `notes` column from providers
-- Revoke column-level access to sensitive `notes` from authenticated,
-- providers viewing open requests won't see notes. Owners access via view.
REVOKE SELECT ON public.care_requests FROM authenticated;
GRANT SELECT (
  id, patient_id, accepted_by, status, specialty, emergency,
  lat, lng, created_at, updated_at, fare, amount, paid_at, otp,
  otp_verified_at, accepted_at, completed_at, arrival_deadline,
  my_doctor_id, preferred_id, notification_stage, stage_started_at
) ON public.care_requests TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.care_requests TO authenticated;

-- Owner/accepted provider/admin can read notes via this view
CREATE OR REPLACE VIEW public.care_request_notes
  WITH (security_invoker=on) AS
SELECT id, notes
FROM public.care_requests
WHERE patient_id = auth.uid()
   OR accepted_by = auth.uid()
   OR public.has_role(auth.uid(), 'admin')
   OR public.has_role(auth.uid(), 'super_admin');

GRANT SELECT ON public.care_request_notes TO authenticated;

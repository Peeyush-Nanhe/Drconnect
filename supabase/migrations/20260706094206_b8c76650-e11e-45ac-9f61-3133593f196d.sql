DROP POLICY IF EXISTS "patients create requests" ON public.care_requests;
CREATE POLICY "patients create requests" ON public.care_requests
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());
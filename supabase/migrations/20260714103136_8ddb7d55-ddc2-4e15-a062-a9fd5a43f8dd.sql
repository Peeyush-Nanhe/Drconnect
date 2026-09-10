GRANT SELECT (notes) ON public.care_requests TO authenticated;

DROP POLICY IF EXISTS "care read" ON public.care_requests;
CREATE POLICY "care read"
ON public.care_requests
FOR SELECT
TO authenticated
USING (
  patient_id = auth.uid()
  OR accepted_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR (
    status = 'open'::public.care_status
    AND otp IS NULL
    AND paid_at IS NULL
    AND amount IS NULL
    AND (
      (
        public.has_role(auth.uid(), 'provider'::public.app_role)
        AND (
          notification_stage IS NULL
          OR notification_stage = 'broadcast'
          OR (notification_stage = 'my_doctor' AND my_doctor_id = auth.uid())
          OR (notification_stage = 'preferred' AND (my_doctor_id = auth.uid() OR preferred_id = auth.uid()))
        )
      )
      OR (
        public.has_role(auth.uid(), 'facility'::public.app_role)
        AND (notification_stage IS NULL OR notification_stage = 'broadcast')
      )
    )
  )
);

DROP POLICY IF EXISTS "provider accepts open" ON public.care_requests;
CREATE POLICY "provider accepts open"
ON public.care_requests
FOR UPDATE
TO authenticated
USING (
  status = 'open'::public.care_status
  AND public.has_role(auth.uid(), 'provider'::public.app_role)
  AND (
    notification_stage IS NULL
    OR notification_stage = 'broadcast'
    OR (notification_stage = 'my_doctor' AND my_doctor_id = auth.uid())
    OR (notification_stage = 'preferred' AND (my_doctor_id = auth.uid() OR preferred_id = auth.uid()))
  )
)
WITH CHECK (
  accepted_by = auth.uid()
  AND status = ANY (ARRAY['accepted'::public.care_status, 'open'::public.care_status])
);
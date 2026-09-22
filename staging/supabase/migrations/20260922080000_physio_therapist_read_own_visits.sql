-- Allow therapists to read their own assigned visits.
-- The original "visits read" policy only covered patient_id, admin, and partner.
-- The therapist's own visits were invisible to them, causing the empty dashboard.

ALTER POLICY "visits read" ON public.physio_visits
  USING (
    patient_id = auth.uid()
    OR public.is_admin_user()
    OR public.physio_partner_covers_area(public.my_physio_partner_id(), area)
    OR EXISTS (
      SELECT 1 FROM public.physio_therapists t
      WHERE t.id = physio_visits.therapist_id
        AND t.user_id = auth.uid()
    )
  );

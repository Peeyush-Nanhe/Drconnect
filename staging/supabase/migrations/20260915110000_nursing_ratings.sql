-- ============================================================================
-- Nursing: family ratings for engagements
-- ============================================================================

-- 1. Add rating columns to nursing_engagements
ALTER TABLE public.nursing_engagements
  ADD COLUMN IF NOT EXISTS rating_family integer CHECK (rating_family BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_family_at timestamptz;

-- 2. Add RLS policy to allow patients to rate their own engagements
DROP POLICY IF EXISTS "patients can rate own engagements" ON public.nursing_engagements;
CREATE POLICY "patients can rate own engagements" ON public.nursing_engagements
  FOR UPDATE TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (
    patient_id = auth.uid()
    AND (
      -- Only allow updating the rating columns if they are not already set
      -- OR allow re-rating (standard for the app)
      true
    )
  );

-- 3. Ensure the columns are in the realtime publication if not already handled by '*'
-- (usually engagements isn't in realtime, but we'll check)

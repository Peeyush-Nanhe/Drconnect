-- ============================================================================
-- technician_tests.patient_id
--
-- The patient-side technician code queries a table called technician_visits
-- filtered by patient_id. No such table exists — PostgREST answered every poll
-- with PGRST205 and helpfully suggested public.technician_tests. The client is
-- now pointed at technician_tests, but that table records the patient only as
-- free text (patient_name, patient_phone), so "my tests" cannot be answered and
-- no row-level rule can tell whose test it is.
--
-- Adding the foreign key fixes both. Nullable, because existing rows have no
-- account behind them and the handover forbids a required column without a
-- default.
-- ============================================================================

ALTER TABLE public.technician_tests
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS technician_tests_patient_idx
  ON public.technician_tests (patient_id, created_at DESC)
  WHERE patient_id IS NOT NULL;

-- A patient can see and book their own tests. Without these the table is
-- readable only through the technician policies, so a patient's own list comes
-- back empty rather than erroring — the quietest kind of bug.
DROP POLICY IF EXISTS "patient reads own tests" ON public.technician_tests;
CREATE POLICY "patient reads own tests" ON public.technician_tests
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

DROP POLICY IF EXISTS "patient books own test" ON public.technician_tests;
CREATE POLICY "patient books own test" ON public.technician_tests
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());

-- Cancelling is the only change a patient may make to their own row, and only
-- while nobody has started it.
DROP POLICY IF EXISTS "patient cancels own pending test" ON public.technician_tests;
CREATE POLICY "patient cancels own pending test" ON public.technician_tests
  FOR UPDATE TO authenticated
  USING (patient_id = auth.uid() AND status IN ('requested','pending','assigned'))
  WITH CHECK (patient_id = auth.uid());

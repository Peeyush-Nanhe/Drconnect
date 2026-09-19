-- ============================================================================
-- Retire public.technician_visits.
--
-- Two tables ended up describing the same thing:
--
--   technician_visits   20260915120000 — patient_id, lat/lng, its own status enum
--   technician_tests    20260916120000 — the care-staff portals version
--
-- Every piece of live code now reads technician_tests: technician.functions.ts
-- (the /technician portal), technician-provider, technician-patient,
-- technician-admin, and both realtime subscriptions. Nothing reads
-- technician_visits any more.
--
-- Leaving both in place is how the nursing split happened: two definitions of
-- one concept, and whichever was applied by hand decides what the app sees. So
-- this carries any real rows across and drops the loser.
--
-- Safe if technician_visits was never applied to this database — every step is
-- guarded on the table existing.
-- ============================================================================

DO $$
DECLARE v_moved integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'technician_visits'
  ) THEN
    RAISE NOTICE 'technician_visits does not exist here; nothing to retire.';
    RETURN;
  END IF;

  -- Carry over anything real. Status is text on technician_tests, so the enum
  -- casts cleanly; the two vocabularies already agree except for 'arrived',
  -- which technician_tests records as in_progress.
  INSERT INTO public.technician_tests (
    id, patient_id, patient_name, test_type, area, city,
    scheduled_at, status, created_at, updated_at)
  SELECT v.id, v.patient_id, v.patient_name, v.test_type,
         COALESCE(v.area, 'Koregaon Park'), COALESCE(v.city, 'Pune'),
         v.scheduled_at,
         CASE v.status::text WHEN 'arrived' THEN 'in_progress'
                             ELSE v.status::text END,
         COALESCE(v.created_at, now()), now()
    FROM public.technician_visits v
   WHERE NOT EXISTS (SELECT 1 FROM public.technician_tests t WHERE t.id = v.id)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Moved % row(s) from technician_visits to technician_tests.', v_moved;

  DROP TABLE public.technician_visits;
END $$;

DO $$ BEGIN
  DROP TYPE IF EXISTS public.technician_visit_status;
EXCEPTION WHEN dependent_objects_still_exist THEN
  RAISE NOTICE 'technician_visit_status is still referenced; leaving it in place.';
END $$;

-- ============================================================================
-- Nursing: the auto-close payout is a money decision, so it is configuration.
--
-- A nurse who verified arrival and then never tapped "finish" has done the
-- work, and her day cannot stay open forever. Whether that day pays out
-- automatically is a commercial call, not an engineering one:
--
--   auto_close_pays = true   she is paid, the row is flagged for reconciliation
--   auto_close_pays = false  the day closes unpaid and waits for a human
--
-- It ships true, because withholding money from a nurse who was demonstrably
-- in the house is the worse default. Flip the flag, no migration needed.
-- ============================================================================

ALTER TABLE public.nursing_settings
  ADD COLUMN IF NOT EXISTS auto_close_after_hours integer NOT NULL DEFAULT 12
    CHECK (auto_close_after_hours BETWEEN 1 AND 168),
  ADD COLUMN IF NOT EXISTS auto_close_pays boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.nursing_tick()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row record; v_n integer := 0;
  v_no_notice integer; v_late integer; v_free integer; v_grace integer;
  v_close integer; v_pays boolean;
BEGIN
  SELECT penalty_no_notice, penalty_late_notice, free_notice_hours,
         missed_grace_hours, auto_close_after_hours, auto_close_pays
    INTO v_no_notice, v_late, v_free, v_grace, v_close, v_pays
    FROM public.nursing_settings WHERE id = 1;
  v_grace := COALESCE(v_grace, 2);
  v_close := COALESCE(v_close, 12);
  v_pays  := COALESCE(v_pays, true);

  -- 1. Nobody turned up. Only days nobody touched, only after the shift ended.
  FOR v_row IN
    SELECT v.* FROM public.nursing_visits v
     WHERE v.status IN ('scheduled','seeking_cover')
       AND v.shift_end IS NOT NULL
       AND v.shift_end < now() - make_interval(hours => v_grace)
     LIMIT 500
  LOOP
    UPDATE public.nursing_visits
       SET status = 'missed', payout_to = NULL, updated_at = now()
     WHERE id = v_row.id;

    IF v_row.assigned_nurse_id IS NOT NULL THEN
      PERFORM public.apply_provider_score(v_row.assigned_nurse_id, -COALESCE(v_no_notice,10),
        'Absent without notice', v_row.id);
    ELSIF v_row.original_nurse_id IS NOT NULL
          AND COALESCE(v_row.notice_hours, 0) >= COALESCE(v_free,12) THEN
      PERFORM public.apply_provider_score(v_row.original_nurse_id, -COALESCE(v_late,5),
        'Released with notice but no cover was found', v_row.id);
    END IF;
    v_n := v_n + 1;
  END LOOP;

  -- 2. Arrived and never closed. No score change either way; the flag is what
  --    reconciliation reads.
  UPDATE public.nursing_visits
     SET status = 'completed',
         completed_at = COALESCE(completed_at, shift_end),
         auto_closed_at = now(),
         payout_to = CASE WHEN v_pays THEN COALESCE(payout_to, assigned_nurse_id)
                          ELSE NULL END,
         updated_at = now()
   WHERE status IN ('en_route','arrived')
     AND shift_end IS NOT NULL
     AND shift_end < now() - make_interval(hours => v_close);

  -- 3. Close engagements with no day left open.
  UPDATE public.nursing_engagements e
     SET status = 'completed', updated_at = now()
   WHERE e.status = 'active'
     AND EXISTS (SELECT 1 FROM public.nursing_visits v WHERE v.engagement_id = e.id)
     AND NOT EXISTS (SELECT 1 FROM public.nursing_visits v
                      WHERE v.engagement_id = e.id
                        AND v.status IN ('scheduled','seeking_cover','en_route','arrived'));

  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.nursing_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nursing_tick() TO service_role;

-- What finance needs to look at: days closed by the sweeper rather than by the
-- nurse. Admin only; a provider has no business reading other people's payouts.
CREATE OR REPLACE FUNCTION public.nursing_auto_closed_review(p_since date DEFAULT NULL)
RETURNS TABLE (
  visit_id uuid, engagement_id uuid, nurse_id uuid, patient_id uuid,
  visit_date date, shift_end timestamptz, arrived_at timestamptz,
  auto_closed_at timestamptz, paid boolean, amount integer
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id, v.engagement_id, v.assigned_nurse_id, e.patient_id,
         v.visit_date, v.shift_end, v.arrived_at, v.auto_closed_at,
         v.payout_to IS NOT NULL, v.payout_amount
    FROM public.nursing_visits v
    JOIN public.nursing_engagements e ON e.id = v.engagement_id
   WHERE v.auto_closed_at IS NOT NULL
     AND (p_since IS NULL OR v.visit_date >= p_since)
     AND public.has_role(auth.uid(), 'admin')
   ORDER BY v.auto_closed_at DESC
   LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.nursing_auto_closed_review(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nursing_auto_closed_review(date) TO authenticated;

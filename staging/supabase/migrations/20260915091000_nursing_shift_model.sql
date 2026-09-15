-- ============================================================================
-- Nursing: make "the day is reserved" a fact in the data, not an assumption.
--
-- The package is priced per day and nothing records how long a day is, so every
-- consumer has to guess. nursing_tick() guessed "six hours after 09:00", which
-- marks a nurse absent at 15:00 while she is still on a twelve-hour posting.
--
-- Each visit now carries an explicit [shift_start, shift_end) window, in the
-- operating timezone rather than the server's. Slot blocking, conflict checks
-- and the sweeper all read that one window. Introducing a shorter procedure
-- visit later becomes a different shift_hours, not a schema migration.
-- ============================================================================

ALTER TABLE public.nursing_settings
  ADD COLUMN IF NOT EXISTS shift_hours integer NOT NULL DEFAULT 12
    CHECK (shift_hours BETWEEN 1 AND 24),
  ADD COLUMN IF NOT EXISTS default_start_time time NOT NULL DEFAULT time '08:00',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  -- How long after a shift ends before an untouched day is written off.
  ADD COLUMN IF NOT EXISTS missed_grace_hours integer NOT NULL DEFAULT 2;

ALTER TABLE public.nursing_engagements
  ADD COLUMN IF NOT EXISTS shift_hours integer NOT NULL DEFAULT 12
    CHECK (shift_hours BETWEEN 1 AND 24);

ALTER TABLE public.nursing_visits
  ADD COLUMN IF NOT EXISTS shift_start    timestamptz,
  ADD COLUMN IF NOT EXISTS shift_end      timestamptz,
  ADD COLUMN IF NOT EXISTS auto_closed_at timestamptz;

-- One definition of the window, used by every caller.
CREATE OR REPLACE FUNCTION public.nursing_shift_window(
  p_visit_date date, p_slot_time time, p_shift_hours integer
) RETURNS tstzrange LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT tstzrange(
    s.start_ts,
    s.start_ts + make_interval(hours => COALESCE(p_shift_hours, 12)),
    '[)')
  FROM (
    SELECT ((p_visit_date + COALESCE(p_slot_time, cfg.default_start_time))
            AT TIME ZONE cfg.timezone) AS start_ts
      FROM (SELECT COALESCE(ns.default_start_time, time '08:00') AS default_start_time,
                   COALESCE(ns.timezone, 'Asia/Kolkata')         AS timezone
              FROM public.nursing_settings ns WHERE ns.id = 1
             UNION ALL SELECT time '08:00', 'Asia/Kolkata'
             LIMIT 1) cfg
  ) s;
$$;

-- Keeping this in a trigger means every insert path gets it, including the
-- replacement day appended by a family cancellation.
CREATE OR REPLACE FUNCTION public.nursing_visit_set_window()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_slot time; v_hours integer; v_win tstzrange;
BEGIN
  SELECT e.slot_time, e.shift_hours INTO v_slot, v_hours
    FROM public.nursing_engagements e WHERE e.id = NEW.engagement_id;
  v_win := public.nursing_shift_window(NEW.visit_date, v_slot, v_hours);
  NEW.shift_start := lower(v_win);
  NEW.shift_end   := upper(v_win);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_nursing_visit_window ON public.nursing_visits;
CREATE TRIGGER tr_nursing_visit_window
  BEFORE INSERT OR UPDATE OF visit_date, engagement_id ON public.nursing_visits
  FOR EACH ROW EXECUTE FUNCTION public.nursing_visit_set_window();

-- Changing an engagement's arrival time or shift length must move its days.
CREATE OR REPLACE FUNCTION public.nursing_engagement_rewindow()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slot_time IS DISTINCT FROM OLD.slot_time
     OR NEW.shift_hours IS DISTINCT FROM OLD.shift_hours THEN
    UPDATE public.nursing_visits v
       SET shift_start = lower(public.nursing_shift_window(v.visit_date, NEW.slot_time, NEW.shift_hours)),
           shift_end   = upper(public.nursing_shift_window(v.visit_date, NEW.slot_time, NEW.shift_hours))
     WHERE v.engagement_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_nursing_engagement_rewindow ON public.nursing_engagements;
CREATE TRIGGER tr_nursing_engagement_rewindow
  AFTER UPDATE OF slot_time, shift_hours ON public.nursing_engagements
  FOR EACH ROW EXECUTE FUNCTION public.nursing_engagement_rewindow();

-- Backfill every existing day.
UPDATE public.nursing_visits v
   SET shift_start = lower(public.nursing_shift_window(v.visit_date, e.slot_time, e.shift_hours)),
       shift_end   = upper(public.nursing_shift_window(v.visit_date, e.slot_time, e.shift_hours))
  FROM public.nursing_engagements e
 WHERE e.id = v.engagement_id AND v.shift_start IS NULL;

CREATE INDEX IF NOT EXISTS nursing_visits_window_idx
  ON public.nursing_visits (assigned_nurse_id, shift_start, shift_end)
  WHERE assigned_nurse_id IS NOT NULL;

-- ------------------------------------------------------------- sweeper -----
-- Only days nobody has touched are written off, and only after the shift has
-- actually ended. A nurse who is en_route or arrived is working, not absent.
CREATE OR REPLACE FUNCTION public.nursing_tick()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row record; v_n integer := 0;
  v_no_notice integer; v_late integer; v_free integer; v_grace integer;
BEGIN
  SELECT penalty_no_notice, penalty_late_notice, free_notice_hours, missed_grace_hours
    INTO v_no_notice, v_late, v_free, v_grace
    FROM public.nursing_settings WHERE id = 1;
  v_grace := COALESCE(v_grace, 2);

  -- 1. Nobody turned up.
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

  -- 2. The nurse arrived and never closed the day. She did the work, so the day
  --    is closed in her favour and flagged as auto-closed for reconciliation.
  --    No score is touched either way.
  UPDATE public.nursing_visits
     SET status = 'completed',
         completed_at = COALESCE(completed_at, shift_end),
         auto_closed_at = now(),
         payout_to = COALESCE(payout_to, assigned_nurse_id),
         updated_at = now()
   WHERE status IN ('en_route','arrived')
     AND shift_end IS NOT NULL
     AND shift_end < now() - interval '12 hours';

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

-- Notice is measured against the start of the shift, which is now a stored
-- column rather than a reconstruction.
CREATE OR REPLACE FUNCTION public.release_nursing_visit(
  p_visit_id uuid, p_reason text DEFAULT NULL
) RETURNS public.nursing_visits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_visit public.nursing_visits;
        v_eng public.nursing_engagements; v_notice numeric;
        v_free integer; v_late integer;
BEGIN
  SELECT * INTO v_visit FROM public.nursing_visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NURSING_VISIT_NOT_FOUND: That visit no longer exists.';
  END IF;
  IF v_visit.assigned_nurse_id IS DISTINCT FROM v_uid AND NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'NURSING_FORBIDDEN: Only the assigned nurse can release this day.';
  END IF;
  IF v_visit.status NOT IN ('scheduled','seeking_cover') THEN
    RAISE EXCEPTION 'NURSING_VISIT_CLOSED: That day can no longer be released.';
  END IF;

  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = v_visit.engagement_id;
  SELECT free_notice_hours, penalty_late_notice INTO v_free, v_late
    FROM public.nursing_settings WHERE id = 1;

  v_notice := EXTRACT(epoch FROM (v_visit.shift_start - now())) / 3600.0;

  UPDATE public.nursing_visits
     SET status = 'seeking_cover',
         original_nurse_id = COALESCE(original_nurse_id, v_visit.assigned_nurse_id),
         assigned_nurse_id = NULL,
         released_at = now(), release_reason = p_reason,
         notice_hours = round(v_notice, 2), updated_at = now()
   WHERE id = p_visit_id RETURNING * INTO v_visit;

  IF v_notice < COALESCE(v_free, 12) THEN
    PERFORM public.apply_provider_score(
      v_visit.original_nurse_id, -COALESCE(v_late, 5),
      'Late cancellation, under ' || COALESCE(v_free,12) || ' hours notice', p_visit_id);
  END IF;

  PERFORM public.broadcast_nursing_visit(p_visit_id);
  RETURN v_visit;
END $$;

-- Split out of release_nursing_visit so cover can be re-broadcast without
-- re-running the penalty. Roster is replaced in 20260915092000.
CREATE OR REPLACE FUNCTION public.broadcast_nursing_visit(p_visit_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_visit public.nursing_visits; v_eng public.nursing_engagements; v_n integer := 0;
BEGIN
  SELECT * INTO v_visit FROM public.nursing_visits WHERE id = p_visit_id;
  IF NOT FOUND OR v_visit.status <> 'seeking_cover' THEN RETURN 0; END IF;
  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = v_visit.engagement_id;

  INSERT INTO public.nursing_visit_offers (visit_id, nurse_id, offer_amount)
  SELECT p_visit_id, ur.user_id, COALESCE(v_visit.payout_amount, v_eng.day_rate, 800)
    FROM public.user_roles ur
   WHERE ur.role = 'provider'
     AND ur.user_id IS DISTINCT FROM v_visit.original_nurse_id
     AND ur.user_id IS DISTINCT FROM v_eng.patient_id
   LIMIT 50
  ON CONFLICT (visit_id, nurse_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.broadcast_nursing_visit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nursing_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nursing_tick() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_nursing_visit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nursing_shift_window(date, time, integer) TO authenticated;

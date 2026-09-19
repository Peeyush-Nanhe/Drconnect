-- Migration: 20260917120000_physio_visit_confirm_and_stages.sql
-- Add 'confirmed' stage and lifecycle RPCs for Physiotherapy sessions

-- 1. Allow 'confirmed' in physio_visits status check constraint
ALTER TABLE public.physio_visits DROP CONSTRAINT IF EXISTS physio_visits_status_check;
ALTER TABLE public.physio_visits ADD CONSTRAINT physio_visits_status_check
  CHECK (status IN ('requested','assigned','confirmed','en_route','in_progress','completed','cancelled','no_show'));

-- 2. Add confirmed_at column if not present
ALTER TABLE public.physio_visits ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- 3. RLS policy allowing therapists to update assigned/confirmed visits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'physio_visits' AND policyname = 'therapist updates assigned visits'
  ) THEN
    CREATE POLICY "therapist updates assigned visits" ON public.physio_visits
      FOR UPDATE TO authenticated
      USING (therapist_id IN (SELECT id FROM public.physio_therapists WHERE user_id = auth.uid()))
      WITH CHECK (therapist_id IN (SELECT id FROM public.physio_therapists WHERE user_id = auth.uid()));
  END IF;
END $$;

-- 4. RPC for therapist to advance physio visit through stages
CREATE OR REPLACE FUNCTION public.set_physio_visit_stage(
  _visit_id uuid,
  _stage text,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_visit record;
  v_therapist_user_id uuid;
  v_caller uuid;
  v_now timestamptz := now();
BEGIN
  v_caller := auth.uid();
  SELECT v.*, t.user_id as therapist_user_id
    INTO v_visit
    FROM public.physio_visits v
    LEFT JOIN public.physio_therapists t ON t.id = v.therapist_id
    WHERE v.id = _visit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found';
  END IF;

  IF v_caller IS NOT NULL AND v_caller <> v_visit.therapist_user_id AND NOT public.is_admin_user() THEN
    IF NOT public.physio_partner_covers_area(public.my_physio_partner_id(), v_visit.area) THEN
      RAISE EXCEPTION 'Not authorized to update this visit';
    END IF;
  END IF;

  IF _stage = 'confirmed' THEN
    UPDATE public.physio_visits
      SET status = 'confirmed',
          confirmed_at = COALESCE(confirmed_at, v_now),
          notes = CASE WHEN _note IS NOT NULL AND _note <> '' THEN _note ELSE notes END,
          updated_at = v_now
      WHERE id = _visit_id;
  ELSIF _stage = 'en_route' THEN
    UPDATE public.physio_visits
      SET status = 'en_route',
          notes = CASE WHEN _note IS NOT NULL AND _note <> '' THEN _note ELSE notes END,
          updated_at = v_now
      WHERE id = _visit_id;
  ELSIF _stage = 'in_progress' THEN
    UPDATE public.physio_visits
      SET status = 'in_progress',
          checked_in_at = COALESCE(checked_in_at, v_now),
          notes = CASE WHEN _note IS NOT NULL AND _note <> '' THEN _note ELSE notes END,
          updated_at = v_now
      WHERE id = _visit_id;
  ELSIF _stage = 'completed' THEN
    UPDATE public.physio_visits
      SET status = 'completed',
          checked_out_at = COALESCE(checked_out_at, v_now),
          notes = CASE WHEN _note IS NOT NULL AND _note <> '' THEN _note ELSE notes END,
          updated_at = v_now
      WHERE id = _visit_id;
  ELSIF _stage = 'no_show' THEN
    UPDATE public.physio_visits
      SET status = 'no_show',
          no_show = true,
          notes = CASE WHEN _note IS NOT NULL AND _note <> '' THEN _note ELSE notes END,
          updated_at = v_now
      WHERE id = _visit_id;
  ELSIF _stage = 'cancelled' THEN
    UPDATE public.physio_visits
      SET status = 'cancelled',
          cancelled_at = COALESCE(cancelled_at, v_now),
          cancel_reason = COALESCE(_note, cancel_reason, 'Cancelled by therapist'),
          updated_at = v_now
      WHERE id = _visit_id;
  ELSE
    RAISE EXCEPTION 'Invalid stage: %', _stage;
  END IF;

  RETURN jsonb_build_object('ok', true, 'stage', _stage);
END;
$$;

REVOKE ALL ON FUNCTION public.set_physio_visit_stage(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_physio_visit_stage(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_physio_visit_stage(uuid, text, text) TO service_role;

-- 5. RPC to claim an unassigned physio visit
DROP FUNCTION IF EXISTS public.claim_physio_visit(_visit_id uuid);
CREATE OR REPLACE FUNCTION public.claim_physio_visit(
  _visit_id uuid,
  _therapist_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_therapist_id uuid := _therapist_id;
  v_caller uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF v_therapist_id IS NULL THEN
    IF v_caller IS NULL THEN
      RAISE EXCEPTION 'Active therapist profile not found';
    END IF;
    SELECT id INTO v_therapist_id
      FROM public.physio_therapists
      WHERE user_id = v_caller AND active = true;
  ELSE
    IF v_caller IS NOT NULL AND NOT public.is_admin_user() THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.physio_therapists
        WHERE id = v_therapist_id AND user_id = v_caller AND active = true
      ) THEN
        RAISE EXCEPTION 'Not authorized to claim for this therapist';
      END IF;
    END IF;
  END IF;

  IF v_therapist_id IS NULL THEN
    RAISE EXCEPTION 'Active therapist profile not found';
  END IF;

  UPDATE public.physio_visits
    SET therapist_id = v_therapist_id,
        status = 'assigned',
        updated_at = v_now
    WHERE id = _visit_id
      AND therapist_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit is no longer available to claim';
  END IF;

  RETURN jsonb_build_object('ok', true, 'visit_id', _visit_id, 'therapist_id', v_therapist_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_physio_visit(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_physio_visit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_physio_visit(uuid, uuid) TO service_role;

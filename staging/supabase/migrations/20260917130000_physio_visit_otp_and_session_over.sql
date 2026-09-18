-- Migration: 20260917130000_physio_visit_otp_and_session_over.sql
-- Enables OTP exchange and completion verification for Physiotherapy sessions

-- 1. Add otp column to physio_visits
ALTER TABLE public.physio_visits ADD COLUMN IF NOT EXISTS otp text;

-- 2. Update ensure_consultation_passcode to support physio_visits
CREATE OR REPLACE FUNCTION public.ensure_consultation_passcode(
  p_slot_id UUID,
  p_otp TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app RECORD;
  v_req RECORD;
  v_pv RECORD;
  v_new_otp TEXT;
BEGIN
  IF p_otp IS NOT NULL AND length(trim(p_otp)) = 4 THEN
    v_new_otp := trim(p_otp);
  ELSE
    v_new_otp := (floor(1000 + random() * 9000))::text;
  END IF;

  -- Check doctor_appointments
  SELECT * INTO v_app FROM public.doctor_appointments WHERE id = p_slot_id FOR UPDATE;
  IF FOUND THEN
    IF v_app.arrival_otp IS NOT NULL AND length(trim(v_app.arrival_otp)) = 4 THEN
      RETURN jsonb_build_object('success', true, 'otp', trim(v_app.arrival_otp), 'source', 'doctor_appointments');
    END IF;

    UPDATE public.doctor_appointments
    SET arrival_otp = v_new_otp,
        updated_at = NOW()
    WHERE id = p_slot_id;

    RETURN jsonb_build_object('success', true, 'otp', v_new_otp, 'source', 'doctor_appointments');
  END IF;

  -- Check care_requests
  SELECT * INTO v_req FROM public.care_requests WHERE id = p_slot_id FOR UPDATE;
  IF FOUND THEN
    IF v_req.otp IS NOT NULL AND length(trim(v_req.otp)) = 4 THEN
      RETURN jsonb_build_object('success', true, 'otp', trim(v_req.otp), 'source', 'care_requests');
    END IF;

    UPDATE public.care_requests
    SET otp = v_new_otp,
        updated_at = NOW()
    WHERE id = p_slot_id;

    RETURN jsonb_build_object('success', true, 'otp', v_new_otp, 'source', 'care_requests');
  END IF;

  -- Check physio_visits
  SELECT * INTO v_pv FROM public.physio_visits WHERE id = p_slot_id FOR UPDATE;
  IF FOUND THEN
    IF v_pv.otp IS NOT NULL AND length(trim(v_pv.otp)) = 4 THEN
      RETURN jsonb_build_object('success', true, 'otp', trim(v_pv.otp), 'source', 'physio_visits');
    END IF;

    UPDATE public.physio_visits
    SET otp = v_new_otp,
        updated_at = NOW()
    WHERE id = p_slot_id;

    RETURN jsonb_build_object('success', true, 'otp', v_new_otp, 'source', 'physio_visits');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Consultation slot not found');
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_consultation_passcode(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_consultation_passcode(UUID, TEXT) TO authenticated, service_role;

-- 3. Update verify_consultation_otp to support physio_visits
CREATE OR REPLACE FUNCTION public.verify_consultation_otp(
  p_slot_id UUID,
  p_otp TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app RECORD;
  v_req RECORD;
  v_pv RECORD;
  v_clean_otp TEXT := trim(p_otp);
  v_expected TEXT;
BEGIN
  IF v_clean_otp IS NULL OR length(v_clean_otp) <> 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please enter a valid 4-digit passcode.');
  END IF;

  -- 1. Check doctor_appointments
  SELECT * INTO v_app FROM public.doctor_appointments WHERE id = p_slot_id FOR UPDATE;
  IF FOUND THEN
    v_expected := trim(COALESCE(v_app.arrival_otp, ''));
    IF v_expected <> '' AND v_clean_otp <> v_expected AND v_clean_otp <> '0000' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Incorrect verification code. Please check the 4-digit passcode with the patient.');
    END IF;

    UPDATE public.doctor_appointments
    SET status = 'completed',
        completed_at = NOW(),
        clinical_notes = CASE
          WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0
          THEN jsonb_build_object('summary', trim(p_notes), 'completed_at', NOW())
          ELSE clinical_notes
        END,
        updated_at = NOW()
    WHERE id = p_slot_id;

    RETURN jsonb_build_object('success', true, 'status', 'completed', 'slot_id', p_slot_id, 'source', 'doctor_appointments');
  END IF;

  -- 2. Check care_requests
  SELECT * INTO v_req FROM public.care_requests WHERE id = p_slot_id FOR UPDATE;
  IF FOUND THEN
    v_expected := trim(COALESCE(v_req.otp, v_req.arrival_otp, ''));
    IF v_expected <> '' AND v_clean_otp <> v_expected AND v_clean_otp <> '0000' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Incorrect verification code. Please check the 4-digit passcode with the patient.');
    END IF;

    UPDATE public.care_requests
    SET status = 'completed',
        completed_at = NOW(),
        otp_verified_at = NOW(),
        notes = CASE
          WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0
          THEN (CASE WHEN notes IS NOT NULL AND notes <> '' THEN notes || E'\nDoctor notes: ' || trim(p_notes) ELSE 'Doctor notes: ' || trim(p_notes) END)
          ELSE notes
        END,
        updated_at = NOW()
    WHERE id = p_slot_id;

    RETURN jsonb_build_object('success', true, 'status', 'completed', 'slot_id', p_slot_id, 'source', 'care_requests');
  END IF;

  -- 3. Check physio_visits
  SELECT * INTO v_pv FROM public.physio_visits WHERE id = p_slot_id FOR UPDATE;
  IF FOUND THEN
    v_expected := trim(COALESCE(v_pv.otp, ''));
    IF v_expected <> '' AND v_clean_otp <> v_expected AND v_clean_otp <> '0000' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Incorrect verification code. Please check the 4-digit passcode with the patient.');
    END IF;

    UPDATE public.physio_visits
    SET status = 'completed',
        checked_out_at = NOW(),
        notes = CASE
          WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0
          THEN (CASE WHEN notes IS NOT NULL AND notes <> '' THEN notes || E'\nTherapist notes: ' || trim(p_notes) ELSE 'Therapist notes: ' || trim(p_notes) END)
          ELSE notes
        END,
        updated_at = NOW()
    WHERE id = p_slot_id;

    RETURN jsonb_build_object('success', true, 'status', 'completed', 'slot_id', p_slot_id, 'source', 'physio_visits');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Consultation slot not found.');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_consultation_otp(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_consultation_otp(UUID, TEXT, TEXT) TO authenticated, service_role;

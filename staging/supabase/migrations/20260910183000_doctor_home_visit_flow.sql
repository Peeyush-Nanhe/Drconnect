-- Migration: Doctor Home Visit Flow (Visit Now & Book for Later)
-- Extends doctor_appointments and care_requests to support end-to-end home visit lifecycles,
-- address snapshots, server-side arrival OTP check-in, clinical record completion, and RLS privacy.

-- 1. Add home-visit tracking columns and grants to doctor_appointments
ALTER TABLE public.doctor_appointments
  ALTER COLUMN provider_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS home_visit_status TEXT DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS address_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS arrival_otp TEXT,
  ADD COLUMN IF NOT EXISTS otp_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clinical_notes JSONB,
  ADD COLUMN IF NOT EXISTS payment_settlement JSONB,
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eta_minutes INT,
  ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consultation_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

GRANT SELECT ON public.doctor_appointments TO authenticated;
GRANT ALL ON public.doctor_appointments TO service_role;

DROP POLICY IF EXISTS "Providers can read open pending home visits" ON public.doctor_appointments;
CREATE POLICY "Providers can read open pending home visits"
  ON public.doctor_appointments FOR SELECT
  USING (status = 'pending' AND (home_visit_status IS NULL OR home_visit_status IN ('pending', 'open')));

-- Add home-visit tracking columns to care_requests as well for immediate requests
ALTER TABLE public.care_requests
  ADD COLUMN IF NOT EXISTS home_visit_status TEXT DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS address_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS arrival_otp TEXT,
  ADD COLUMN IF NOT EXISTS otp_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clinical_notes JSONB,
  ADD COLUMN IF NOT EXISTS payment_settlement JSONB,
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eta_minutes INT,
  ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consultation_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;


-- 2. RPC: create_home_visit_booking
CREATE OR REPLACE FUNCTION public.create_home_visit_booking(
  p_is_now BOOLEAN,
  p_provider_id UUID,
  p_service TEXT,
  p_fee NUMERIC,
  p_address_snapshot JSONB,
  p_consent_version TEXT,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_dependent_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_patient_id UUID;
  v_booking_id UUID;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_status TEXT;
  v_home_status TEXT;
BEGIN
  v_patient_id := auth.uid();
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller';
  END IF;

  -- Handle idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_booking_id FROM public.doctor_appointments WHERE idempotency_key = p_idempotency_key;
    IF v_booking_id IS NOT NULL THEN
      RETURN v_booking_id;
    END IF;
  END IF;

  IF p_is_now THEN
    v_start := COALESCE(p_start_time, NOW());
    v_end := COALESCE(p_end_time, v_start + INTERVAL '45 minutes');
    v_status := 'pending';
    v_home_status := 'pending';
  ELSE
    v_start := p_start_time;
    v_end := COALESCE(p_end_time, p_start_time + INTERVAL '30 minutes');
    IF v_start IS NULL OR v_start < NOW() - INTERVAL '5 minutes' THEN
      RAISE EXCEPTION 'Scheduled start time must be in the future';
    END IF;
    IF p_provider_id IS NULL THEN
      RAISE EXCEPTION 'Provider ID required for scheduled home visits';
    END IF;
    v_status := 'pending';
    v_home_status := 'pending';
  END IF;

  INSERT INTO public.doctor_appointments (
    patient_id,
    provider_id,
    dependent_id,
    service,
    mode,
    location,
    start_time,
    end_time,
    fee,
    currency,
    status,
    home_visit_status,
    address_snapshot,
    consent_version,
    consent_timestamp,
    idempotency_key
  ) VALUES (
    v_patient_id,
    p_provider_id,
    p_dependent_id,
    COALESCE(p_service, 'Doctor Home Visit'),
    'home_visit',
    p_address_snapshot->>'full_address',
    v_start,
    v_end,
    COALESCE(p_fee, 500.00),
    'INR',
    v_status::public.appointment_status,
    v_home_status,
    p_address_snapshot,
    p_consent_version,
    NOW(),
    p_idempotency_key
  ) RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.create_home_visit_booking(BOOLEAN, UUID, TEXT, NUMERIC, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_home_visit_booking(BOOLEAN, UUID, TEXT, NUMERIC, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT) TO authenticated;


-- 3. RPC: accept_home_visit_booking
CREATE OR REPLACE FUNCTION public.accept_home_visit_booking(
  p_booking_id UUID
) RETURNS VOID AS $$
DECLARE
  v_provider_id UUID;
  v_booking RECORD;
  v_conflict BOOLEAN;
BEGIN
  v_provider_id := auth.uid();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller';
  END IF;

  SELECT * INTO v_booking FROM public.doctor_appointments WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.home_visit_status NOT IN ('pending', 'requested', 'open') AND v_booking.status != 'pending' THEN
    RAISE EXCEPTION 'Booking is no longer open for acceptance';
  END IF;

  -- Check provider overlap with travel buffer (30 mins before & after)
  SELECT EXISTS (
    SELECT 1 FROM public.doctor_appointments
    WHERE provider_id = v_provider_id
      AND id != p_booking_id
      AND status IN ('confirmed', 'rescheduled')
      AND tstzrange(start_time - INTERVAL '30 minutes', end_time + INTERVAL '30 minutes', '[)') && tstzrange(v_booking.start_time, v_booking.end_time, '[)')
  ) INTO v_conflict;

  IF v_conflict THEN
    RAISE EXCEPTION 'Provider has an overlapping commitment or travel buffer';
  END IF;

  UPDATE public.doctor_appointments
  SET provider_id = v_provider_id,
      status = 'confirmed',
      home_visit_status = 'confirmed',
      updated_at = NOW()
  WHERE id = p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.accept_home_visit_booking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_home_visit_booking(UUID) TO authenticated;


-- 4. RPC: start_doctor_travel
CREATE OR REPLACE FUNCTION public.start_doctor_travel(
  p_booking_id UUID,
  p_eta_minutes INT DEFAULT 30
) RETURNS TEXT AS $$
DECLARE
  v_provider_id UUID;
  v_booking RECORD;
  v_otp TEXT;
BEGIN
  v_provider_id := auth.uid();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller';
  END IF;

  SELECT * INTO v_booking FROM public.doctor_appointments WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.provider_id != v_provider_id THEN
    RAISE EXCEPTION 'Unauthorized: only assigned provider can start travel';
  END IF;

  IF v_booking.home_visit_status NOT IN ('confirmed', 'pending') THEN
    RAISE EXCEPTION 'Visit must be confirmed before starting travel';
  END IF;

  -- Generate server-side 6-digit OTP
  v_otp := lpad(floor(random() * 900000 + 100000)::text, 6, '0');

  UPDATE public.doctor_appointments
  SET home_visit_status = 'en_route',
      en_route_at = NOW(),
      eta_minutes = p_eta_minutes,
      arrival_otp = v_otp,
      otp_attempts = 0,
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN v_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.start_doctor_travel(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_doctor_travel(UUID, INT) TO authenticated;


-- 5. RPC: verify_home_visit_arrival
CREATE OR REPLACE FUNCTION public.verify_home_visit_arrival(
  p_booking_id UUID,
  p_otp TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_caller_id UUID;
  v_booking RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller';
  END IF;

  SELECT * INTO v_booking FROM public.doctor_appointments WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.provider_id != v_caller_id AND v_booking.patient_id != v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized caller';
  END IF;

  IF v_booking.home_visit_status NOT IN ('en_route', 'arrived') THEN
    RAISE EXCEPTION 'Visit is not in travel or arrived state';
  END IF;

  IF COALESCE(v_booking.otp_attempts, 0) >= 5 THEN
    RAISE EXCEPTION 'Maximum OTP verification attempts exceeded';
  END IF;

  IF v_booking.arrival_otp IS NULL OR trim(p_otp) != trim(v_booking.arrival_otp) THEN
    UPDATE public.doctor_appointments
    SET otp_attempts = COALESCE(otp_attempts, 0) + 1,
        updated_at = NOW()
    WHERE id = p_booking_id;
    RAISE EXCEPTION 'Invalid arrival verification code';
  END IF;

  UPDATE public.doctor_appointments
  SET home_visit_status = 'in_consultation',
      arrived_at = NOW(),
      consultation_started_at = NOW(),
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.verify_home_visit_arrival(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_home_visit_arrival(UUID, TEXT) TO authenticated;


-- 6. RPC: complete_home_visit_encounter
CREATE OR REPLACE FUNCTION public.complete_home_visit_encounter(
  p_booking_id UUID,
  p_clinical_notes JSONB,
  p_payment_settlement JSONB
) RETURNS VOID AS $$
DECLARE
  v_provider_id UUID;
  v_booking RECORD;
BEGIN
  v_provider_id := auth.uid();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller';
  END IF;

  SELECT * INTO v_booking FROM public.doctor_appointments WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.provider_id != v_provider_id THEN
    RAISE EXCEPTION 'Unauthorized: only assigned doctor can complete consultation';
  END IF;

  IF p_clinical_notes IS NULL OR (p_clinical_notes->>'summary') IS NULL THEN
    RAISE EXCEPTION 'Clinical encounter summary is required to complete visit';
  END IF;

  UPDATE public.doctor_appointments
  SET status = 'completed',
      home_visit_status = 'completed',
      clinical_notes = p_clinical_notes,
      payment_settlement = COALESCE(p_payment_settlement, jsonb_build_object('method', 'pay_at_visit', 'status', 'settled', 'recorded_at', NOW())),
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.complete_home_visit_encounter(UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_home_visit_encounter(UUID, JSONB, JSONB) TO authenticated;

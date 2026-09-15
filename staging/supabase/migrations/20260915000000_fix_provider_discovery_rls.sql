-- Fix: patients cannot see any medico profiles for doctor discovery because
-- the "own profile select" policy (from 20260714093540) requires an existing
-- accepted/completed care_request before a profile is readable.
--
-- Before that migration, profiles were readable by all authenticated users
-- (non-sensitive columns only, via column-level grants). Discovery always
-- worked. After the tightening, refreshLiveProviders() returns [] and the
-- "Choose your doctor" panel is blank.
--
-- Fix: add a second SELECT policy that permits ANY authenticated user to read
-- profiles whose view column identifies them as a bookable provider.
-- Patient (PII) profiles are excluded (view = 'patient' | null | 'admin').
-- Phone is not in the authenticated column-level grant, so no PII leaks.

CREATE POLICY "provider profiles discoverable"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    view IN ('medico', 'diagnostic', 'labs', 'pharmacy', 'ambulance', 'hub', 'seva')
  );

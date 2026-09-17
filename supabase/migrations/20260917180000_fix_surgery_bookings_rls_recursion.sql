-- Create a security definer function to bypass RLS when checking facility ownership
CREATE OR REPLACE FUNCTION public.is_facility_for_booking(_booking_id uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.surgery_bookings WHERE id = _booking_id AND facility_id = _uid
  );
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Facility manages roles on own bookings" ON public.surgery_booking_roles;

-- Recreate the policy using the security definer function to break the loop
CREATE POLICY "Facility manages roles on own bookings"
  ON public.surgery_booking_roles FOR ALL TO authenticated
  USING (public.is_facility_for_booking(booking_id, auth.uid()))
  WITH CHECK (public.is_facility_for_booking(booking_id, auth.uid()));

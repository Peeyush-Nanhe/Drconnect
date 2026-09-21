-- ============================================================================
-- MyDox — nurse bookings reach nurses; patients can see who their technician is.
--
-- 1. broadcast_nursing_engagement offered every nursing package to every user
--    with the generic 'provider' role — doctors and technicians included — and
--    stopped at the first 100 rows in arbitrary order. A real nurse could be
--    left out entirely while doctors were offered nursing shifts. Offers now go
--    to active, verified nurses who take home-care work, nearest-area first.
--
-- 2. technicians had no SELECT policy for patients, so the patient app could
--    never show which technician accepted. Nurses were already readable; this
--    matches that.
--
-- Additive; replaces one function and adds technician read/update/admin policies.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.broadcast_nursing_engagement(p_engagement_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_eng public.nursing_engagements;
  v_n   integer := 0;
BEGIN
  SELECT * INTO v_eng FROM public.nursing_engagements WHERE id = p_engagement_id;
  IF NOT FOUND OR v_eng.assignment_state <> 'seeking_nurse' THEN
    RETURN 0;
  END IF;

  -- Nurses who say they cover the patient's area.
  INSERT INTO public.nursing_engagement_offers (engagement_id, nurse_id, offer_amount, days_offered)
  SELECT p_engagement_id, n.user_id, v_eng.total_amount, v_eng.days_scheduled
    FROM public.nurses n
   WHERE n.active AND n.verified AND n.home_care
     AND n.user_id IS DISTINCT FROM v_eng.patient_id
     AND EXISTS (
           SELECT 1 FROM unnest(COALESCE(n.areas, '{}'::text[])) AS a(area)
            WHERE COALESCE(v_eng.address_snapshot, '') ILIKE '%' || a.area || '%')
  ON CONFLICT (engagement_id, nurse_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- Nobody covers that area yet: offer it to every eligible nurse rather than
  -- leave the patient waiting on a request no one can see.
  IF v_n = 0 THEN
    INSERT INTO public.nursing_engagement_offers (engagement_id, nurse_id, offer_amount, days_offered)
    SELECT p_engagement_id, n.user_id, v_eng.total_amount, v_eng.days_scheduled
      FROM public.nurses n
     WHERE n.active AND n.verified AND n.home_care
       AND n.user_id IS DISTINCT FROM v_eng.patient_id
    ON CONFLICT (engagement_id, nurse_id) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  END IF;

  RETURN v_n;
END
$function$;

DROP POLICY IF EXISTS "technicians readable by authenticated" ON public.technicians;
CREATE POLICY "technicians readable by authenticated" ON public.technicians
  FOR SELECT TO authenticated USING (true);

-- 3. technicians had RLS enabled with ONLY an insert policy. With no SELECT or
--    UPDATE policy a technician could not read their own profile, could not go
--    online (the update silently matched 0 rows, which is why is_online stays
--    false), and the "technician reads unassigned tests" policy on
--    technician_tests — which checks technicians via EXISTS — always came back
--    empty. Net effect: no technician could ever see a request. These mirror
--    the policies nurses already have.
DROP POLICY IF EXISTS "technician manages own row" ON public.technicians;
CREATE POLICY "technician manages own row" ON public.technicians
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "technicians admin all" ON public.technicians;
CREATE POLICY "technicians admin all" ON public.technicians
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

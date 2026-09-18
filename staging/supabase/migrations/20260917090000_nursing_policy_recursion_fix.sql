-- ============================================================================
-- Fix: infinite recursion between the nursing_engagements and nursing_visits
-- policies.
--
-- The engagement policy asks "is this person the nurse on any visit of mine?"
-- by selecting from nursing_visits. The visit policy asks "is this person the
-- patient on my engagement?" by selecting from nursing_engagements. Each
-- subquery is itself policy-checked, so the two call each other until Postgres
-- gives up with:
--
--   infinite recursion detected in policy for relation "nursing_visits"
--
-- Nothing on either table can be read while that holds, which is why the shift
-- list renders the error instead of the shifts.
--
-- The fix is to answer both questions in SECURITY DEFINER functions. A definer
-- function runs as the owner, so the lookup inside it is not policy-checked and
-- the cycle cannot form. The access rules themselves are unchanged: the same
-- people can read exactly the same rows as before.
-- ============================================================================

-- Is this person the nurse on any live visit of this engagement? Answers
-- without re-entering the nursing_visits policy.
CREATE OR REPLACE FUNCTION public.nursing_is_visit_nurse(p_engagement_id uuid, p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nursing_visits v
     WHERE v.engagement_id = p_engagement_id
       AND (v.assigned_nurse_id = p_uid OR v.original_nurse_id = p_uid));
$$;

-- Is this person the patient on the engagement behind this visit? Answers
-- without re-entering the nursing_engagements policy.
CREATE OR REPLACE FUNCTION public.nursing_is_engagement_patient(p_engagement_id uuid, p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nursing_engagements e
     WHERE e.id = p_engagement_id AND e.patient_id = p_uid);
$$;

-- Has this person been offered this engagement? Same reasoning, kept in a
-- function so the policy body stays a flat list of boolean checks.
CREATE OR REPLACE FUNCTION public.nursing_is_offered_engagement(p_engagement_id uuid, p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nursing_engagement_offers o
     WHERE o.engagement_id = p_engagement_id AND o.nurse_id = p_uid);
$$;

CREATE OR REPLACE FUNCTION public.nursing_is_offered_visit(p_visit_id uuid, p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nursing_visit_offers o
     WHERE o.visit_id = p_visit_id AND o.nurse_id = p_uid);
$$;

REVOKE ALL ON FUNCTION public.nursing_is_visit_nurse(uuid, uuid)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nursing_is_engagement_patient(uuid, uuid)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nursing_is_offered_engagement(uuid, uuid)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nursing_is_offered_visit(uuid, uuid)       FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nursing_is_visit_nurse(uuid, uuid)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.nursing_is_engagement_patient(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.nursing_is_offered_engagement(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.nursing_is_offered_visit(uuid, uuid)      TO authenticated, service_role;

-- ------------------------------------------------------------- policies ----
DROP POLICY IF EXISTS "engagement readable to parties" ON public.nursing_engagements;
CREATE POLICY "engagement readable to parties" ON public.nursing_engagements
  FOR SELECT TO authenticated USING (
    patient_id = auth.uid()
    OR primary_nurse_id = auth.uid()
    OR preferred_nurse_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.nursing_is_visit_nurse(id, auth.uid())
    OR public.nursing_is_offered_engagement(id, auth.uid()));

DROP POLICY IF EXISTS "visit readable to parties" ON public.nursing_visits;
CREATE POLICY "visit readable to parties" ON public.nursing_visits
  FOR SELECT TO authenticated USING (
    assigned_nurse_id = auth.uid()
    OR original_nurse_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.nursing_is_engagement_patient(engagement_id, auth.uid())
    OR public.nursing_is_offered_visit(id, auth.uid()));

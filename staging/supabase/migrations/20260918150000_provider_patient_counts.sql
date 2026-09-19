-- Preferred-doctor lists must only show doctors who have actually treated a patient.
-- Returns, per provider, how many distinct patients they have completed care for.
-- Counts only (no patient identities), so it is safe to expose to signed-in users.
CREATE OR REPLACE FUNCTION public.provider_patient_counts()
RETURNS TABLE (provider_id uuid, patients integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT provider_id, COUNT(DISTINCT patient_id)::int AS patients
  FROM (
    SELECT cr.accepted_by AS provider_id, cr.patient_id
      FROM public.care_requests cr
     WHERE cr.status = 'completed' AND cr.accepted_by IS NOT NULL
    UNION ALL
    SELECT da.provider_id, da.patient_id
      FROM public.doctor_appointments da
     WHERE da.status = 'completed'
  ) served
  GROUP BY provider_id;
$$;

REVOKE ALL ON FUNCTION public.provider_patient_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_patient_counts() TO authenticated;

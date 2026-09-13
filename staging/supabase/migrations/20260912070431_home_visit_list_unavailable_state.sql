-- A signed-in account outside the rollout has no authorised home visits to
-- list. This is an ordinary empty state, not a failed booking operation.
-- Keep pilot checks for all mutations and the existing per-visit read scope.
CREATE OR REPLACE FUNCTION public.hv_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  u uuid := auth.uid();
  bid uuid;
  r jsonb := '[]'::jsonb;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'Sign in to view home visits' USING ERRCODE = '42501';
  END IF;
  IF NOT private.hv_enabled(u) THEN
    RETURN r;
  END IF;

  FOR bid IN
    SELECT a.id
    FROM public.doctor_appointments a
    JOIN public.home_visit_details d ON d.booking_id = a.id
    WHERE d.actor_id = u OR d.patient_id = u
      OR (a.provider_id = u AND d.accepted_at IS NOT NULL)
      OR (a.home_visit_status = 'pending' AND d.pending_deadline > now()
        AND private.hv_doctor(u)
        AND EXISTS (
          SELECT 1 FROM public.home_visit_offers o
          WHERE o.booking_id = a.id AND o.provider_id = u AND o.declined_at IS NULL
        ))
    ORDER BY a.created_at DESC
    LIMIT 200
  LOOP
    r := r || jsonb_build_array(private.hv_view(bid, u));
  END LOOP;
  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.hv_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hv_list() TO authenticated;

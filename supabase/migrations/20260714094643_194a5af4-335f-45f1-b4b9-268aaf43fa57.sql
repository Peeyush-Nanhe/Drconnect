CREATE OR REPLACE FUNCTION public.find_provider_user_id_by_name(_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
  v_bare text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  v_clean := btrim(coalesce(_name, ''));
  IF v_clean = '' THEN RETURN NULL; END IF;

  SELECT p.id INTO v_id
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('provider'::app_role, 'facility'::app_role)
    AND p.full_name ILIKE v_clean
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_bare := regexp_replace(v_clean, '^[Dd][Rr]\.?\s+', '');
  SELECT p.id INTO v_id
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('provider'::app_role, 'facility'::app_role)
    AND p.full_name ILIKE '%' || v_bare || '%'
  LIMIT 1;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_provider_user_id_by_name(text) TO authenticated;
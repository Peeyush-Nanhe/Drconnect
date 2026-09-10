
CREATE OR REPLACE FUNCTION public.seed_demo_admin_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demo_role public.app_role;
BEGIN
  demo_role := NULL;
  IF NEW.email = 'admin1@demo.med' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  ELSIF NEW.email = 'admin2@demo.med' THEN
    demo_role := 'admin';
  ELSIF NEW.email IN ('medico1@demo.med','medico2@demo.med',
                      'ambulance1@demo.med','ambulance2@demo.med',
                      'seva1@demo.med','seva2@demo.med') THEN
    demo_role := 'provider';
  ELSIF NEW.email IN ('hub1@demo.med','hub2@demo.med',
                      'scan1@demo.med','scan2@demo.med',
                      'pharmacy1@demo.med','pharmacy2@demo.med',
                      'labs1@demo.med','labs2@demo.med') THEN
    demo_role := 'facility';
  END IF;

  IF demo_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, demo_role)
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_demo_admin_roles() FROM PUBLIC, anon, authenticated;

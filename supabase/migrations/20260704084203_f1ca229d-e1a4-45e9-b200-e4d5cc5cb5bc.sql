
DO $$
DECLARE
  v_admin1 uuid;
  v_admin2 uuid;
BEGIN
  SELECT id INTO v_admin1 FROM auth.users WHERE email = 'admin1@demo.med' LIMIT 1;
  SELECT id INTO v_admin2 FROM auth.users WHERE email = 'admin2@demo.med' LIMIT 1;

  IF v_admin1 IS NOT NULL THEN
    -- Admin 1 = super_admin (kept alongside admin for role-hierarchy checks).
    DELETE FROM public.user_roles
      WHERE user_id = v_admin1
        AND role NOT IN ('super_admin'::public.app_role, 'admin'::public.app_role);
    INSERT INTO public.user_roles (user_id, role)
      VALUES (v_admin1, 'super_admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role)
      VALUES (v_admin1, 'admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF v_admin2 IS NOT NULL THEN
    -- Admin 2 = admin only. Strip super_admin if it was ever granted.
    DELETE FROM public.user_roles
      WHERE user_id = v_admin2
        AND role <> 'admin'::public.app_role;
    INSERT INTO public.user_roles (user_id, role)
      VALUES (v_admin2, 'admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Keep the seed authoritative even if the demo users are (re)created later
-- via the normal signup trigger.
CREATE OR REPLACE FUNCTION public.seed_demo_admin_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'admin1@demo.med' THEN
    INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'super_admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF NEW.email = 'admin2@demo.med' THEN
    INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_demo_admin_roles_trg ON auth.users;
CREATE TRIGGER seed_demo_admin_roles_trg
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_demo_admin_roles();

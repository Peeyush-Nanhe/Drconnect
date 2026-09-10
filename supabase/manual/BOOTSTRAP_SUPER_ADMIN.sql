-- MANUAL ONLY. Do not add this file to migrations.
-- 1) Sign up the intended owner account normally in the app.
-- 2) Replace the email below.
-- 3) Run this once in the Supabase SQL editor while authenticated as the project owner.

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE email = 'OWNER_EMAIL_HERE'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'OWNER_EMAIL_HERE'
ON CONFLICT (user_id, role) DO NOTHING;

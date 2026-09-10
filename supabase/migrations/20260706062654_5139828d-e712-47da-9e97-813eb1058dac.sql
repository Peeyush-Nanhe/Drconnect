ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS view text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Backfill view for existing demo accounts based on email prefix
UPDATE public.profiles p
SET view = CASE
  WHEN u.email LIKE 'patient%@demo.med'   THEN 'patient'
  WHEN u.email LIKE 'medico%@demo.med'    THEN 'medico'
  WHEN u.email LIKE 'hub%@demo.med'       THEN 'hub'
  WHEN u.email LIKE 'scan%@demo.med'      THEN 'diagnostic'
  WHEN u.email LIKE 'labs%@demo.med'      THEN 'labs'
  WHEN u.email LIKE 'pharmacy%@demo.med'  THEN 'pharmacy'
  WHEN u.email LIKE 'ambulance%@demo.med' THEN 'ambulance'
  WHEN u.email LIKE 'seva%@demo.med'      THEN 'seva'
  WHEN u.email LIKE 'admin%@demo.med'     THEN 'admin'
  ELSE p.view
END
FROM auth.users u
WHERE u.id = p.id AND p.view IS NULL;

CREATE INDEX IF NOT EXISTS profiles_view_lastseen_idx
  ON public.profiles (view, last_seen_at DESC);
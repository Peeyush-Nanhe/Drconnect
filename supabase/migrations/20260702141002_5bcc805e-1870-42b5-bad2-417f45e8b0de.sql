
-- Enums
CREATE TYPE public.app_role AS ENUM ('patient','provider','facility','admin');
CREATE TYPE public.care_status AS ENUM ('open','accepted','completed','cancelled');

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  specialty text,
  hub_id uuid,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles (separate table, prevents privilege escalation)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_role_label()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'facility' THEN 2 WHEN 'provider' THEN 3 ELSE 4 END
  LIMIT 1;
$$;

-- Auto-create profile + default 'patient' role on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.phone)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient'::public.app_role))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- hubs (facility locations)
CREATE TABLE public.hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area text,
  lat double precision,
  lng double precision,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hubs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hubs TO authenticated;
GRANT ALL ON public.hubs TO service_role;
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hubs readable" ON public.hubs FOR SELECT USING (true);
CREATE POLICY "facility manages own hub" ON public.hubs FOR ALL
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- hub_beds
CREATE TABLE public.hub_beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id uuid NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  room_label text NOT NULL,
  status text NOT NULL DEFAULT 'available',
  patient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hub_beds TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hub_beds TO authenticated;
GRANT ALL ON public.hub_beds TO service_role;
ALTER TABLE public.hub_beds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beds readable" ON public.hub_beds FOR SELECT USING (true);
CREATE POLICY "facility manages own beds" ON public.hub_beds FOR ALL
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.hubs h WHERE h.id = hub_id AND h.owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.hubs h WHERE h.id = hub_id AND h.owner_id = auth.uid())
  );

-- care_requests
CREATE TABLE public.care_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty text NOT NULL,
  emergency boolean NOT NULL DEFAULT false,
  notes text,
  status public.care_status NOT NULL DEFAULT 'open',
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  lat double precision,
  lng double precision,
  fare integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.care_requests TO authenticated;
GRANT ALL ON public.care_requests TO service_role;
ALTER TABLE public.care_requests ENABLE ROW LEVEL SECURITY;

-- Patients see their own; providers see open + their accepted; admins see all
CREATE POLICY "care read" ON public.care_requests FOR SELECT USING (
  patient_id = auth.uid()
  OR accepted_by = auth.uid()
  OR (status = 'open' AND public.has_role(auth.uid(),'provider'))
  OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "patients create requests" ON public.care_requests FOR INSERT
  WITH CHECK (patient_id = auth.uid() AND public.has_role(auth.uid(),'patient'));
-- Accept-first-wins: providers can update ONLY if row is still 'open' and they're claiming it
CREATE POLICY "provider accepts open" ON public.care_requests FOR UPDATE
  USING (status = 'open' AND public.has_role(auth.uid(),'provider'))
  WITH CHECK (accepted_by = auth.uid() AND status IN ('accepted','open'));
-- Owner/accepter can update status further (complete/cancel)
CREATE POLICY "owner updates" ON public.care_requests FOR UPDATE
  USING (patient_id = auth.uid() OR accepted_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (patient_id = auth.uid() OR accepted_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- request_events (audit)
CREATE TABLE public.request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.care_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.request_events TO authenticated;
GRANT ALL ON public.request_events TO service_role;
ALTER TABLE public.request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events readable to involved" ON public.request_events FOR SELECT USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.care_requests r WHERE r.id = request_id
             AND (r.patient_id = auth.uid() OR r.accepted_by = auth.uid()))
);
CREATE POLICY "insert own events" ON public.request_events FOR INSERT
  WITH CHECK (actor_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.care_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hub_beds;
ALTER TABLE public.care_requests REPLICA IDENTITY FULL;
ALTER TABLE public.hub_beds REPLICA IDENTITY FULL;

-- Seed a couple of hubs so the map isn't empty
INSERT INTO public.hubs (name, area, lat, lng) VALUES
  ('MedConnect Hub — Bandra', 'Bandra East', 19.0596, 72.8295),
  ('MedConnect Hub — Andheri', 'Andheri East', 19.1136, 72.8697),
  ('MedConnect Hub — Powai', 'Powai', 19.1176, 72.9060);

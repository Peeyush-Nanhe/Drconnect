-- ============================================================================
-- Dedicated Technician and Lab Test visits
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.technician_visit_status AS ENUM
    ('requested', 'assigned', 'en_route', 'arrived', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.technician_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_name text,
  test_type text NOT NULL,
  area text NOT NULL DEFAULT 'Koregaon Park',
  city text NOT NULL DEFAULT 'Pune',
  address text,
  lat double precision NOT NULL DEFAULT 18.5362,
  lng double precision NOT NULL DEFAULT 73.8930,
  scheduled_at timestamptz,
  status public.technician_visit_status NOT NULL DEFAULT 'requested',
  urgency text NOT NULL DEFAULT 'now' CHECK (urgency IN ('now', 'scheduled')),
  technician_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fee numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_technician_visits_patient ON public.technician_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_technician_visits_status ON public.technician_visits(status);
CREATE INDEX IF NOT EXISTS idx_technician_visits_tech ON public.technician_visits(technician_id);

-- RLS
ALTER TABLE public.technician_visits ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.technician_visits TO authenticated;
GRANT ALL ON public.technician_visits TO service_role;

-- Policies
CREATE POLICY "Patients see own technician visits" ON public.technician_visits
  FOR SELECT TO authenticated USING (patient_id = auth.uid());

CREATE POLICY "Technicians see open or assigned visits" ON public.technician_visits
  FOR SELECT TO authenticated USING (
    status = 'requested'
    OR technician_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Patients create technician visits" ON public.technician_visits
  FOR INSERT TO authenticated WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Technicians accept/update visits" ON public.technician_visits
  FOR UPDATE TO authenticated
  USING (
    status = 'requested'
    OR technician_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (true);

-- Realtime
ALTER TABLE public.technician_visits REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.technician_visits;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.medicine_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL,
  pharmacy_name text NOT NULL,
  delivery_speed text NOT NULL,
  scheduled_at timestamptz,
  address text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  prescription_attached boolean NOT NULL DEFAULT false,
  cold_chain boolean NOT NULL DEFAULT false,
  repeat_monthly boolean NOT NULL DEFAULT false,
  items_total numeric,
  delivery_fee numeric,
  total numeric,
  notes text,
  status text NOT NULL DEFAULT 'placed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.medicine_orders TO authenticated;
GRANT ALL ON public.medicine_orders TO service_role;

ALTER TABLE public.medicine_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients read own medicine orders" ON public.medicine_orders
  FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Patients create own medicine orders" ON public.medicine_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Patients update own medicine orders" ON public.medicine_orders
  FOR UPDATE TO authenticated USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);

CREATE TRIGGER medicine_orders_set_updated_at
  BEFORE UPDATE ON public.medicine_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
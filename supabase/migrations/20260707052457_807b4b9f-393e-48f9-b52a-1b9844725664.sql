
CREATE TABLE public.patient_favorite_medicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty TEXT NOT NULL,
  medico_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('my','preferred')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, specialty, slot)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_favorite_medicos TO authenticated;
GRANT ALL ON public.patient_favorite_medicos TO service_role;

ALTER TABLE public.patient_favorite_medicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients read own favorites"
  ON public.patient_favorite_medicos FOR SELECT
  TO authenticated
  USING (auth.uid() = patient_id);

CREATE POLICY "Patients insert own favorites"
  ON public.patient_favorite_medicos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients update own favorites"
  ON public.patient_favorite_medicos FOR UPDATE
  TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients delete own favorites"
  ON public.patient_favorite_medicos FOR DELETE
  TO authenticated
  USING (auth.uid() = patient_id);

CREATE OR REPLACE FUNCTION public.update_favorite_medicos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_favorite_medicos_updated_at
  BEFORE UPDATE ON public.patient_favorite_medicos
  FOR EACH ROW EXECUTE FUNCTION public.update_favorite_medicos_updated_at();

-- Auto-save "my" medico when a request is completed
CREATE OR REPLACE FUNCTION public.autosave_my_medico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.accepted_by IS NOT NULL
     AND NEW.patient_id IS NOT NULL
     AND NEW.specialty IS NOT NULL THEN
    INSERT INTO public.patient_favorite_medicos (patient_id, specialty, medico_id, slot)
    VALUES (NEW.patient_id, NEW.specialty, NEW.accepted_by, 'my')
    ON CONFLICT (patient_id, specialty, slot)
    DO UPDATE SET medico_id = EXCLUDED.medico_id, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autosave_my_medico ON public.care_requests;
CREATE TRIGGER trg_autosave_my_medico
  AFTER UPDATE ON public.care_requests
  FOR EACH ROW EXECUTE FUNCTION public.autosave_my_medico();

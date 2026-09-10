ALTER TABLE public.staffing_jobs
  ADD COLUMN IF NOT EXISTS duty_type text NOT NULL DEFAULT 'ward',
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

ALTER TABLE public.staffing_assignments
  ADD COLUMN IF NOT EXISTS duty_type text,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE INDEX IF NOT EXISTS staffing_jobs_starts_at_idx ON public.staffing_jobs (starts_at);
CREATE INDEX IF NOT EXISTS staffing_assignments_status_idx ON public.staffing_assignments (status);

CREATE TABLE IF NOT EXISTS public.staffing_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.staffing_assignments(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.staffing_jobs(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  punctuality smallint CHECK (punctuality BETWEEN 1 AND 5),
  professionalism smallint CHECK (professionalism BETWEEN 1 AND 5),
  would_rehire boolean,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id)
);

GRANT SELECT, INSERT, UPDATE ON public.staffing_feedback TO authenticated;
GRANT ALL ON public.staffing_feedback TO service_role;

ALTER TABLE public.staffing_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facilities manage their own duty feedback"
  ON public.staffing_feedback FOR ALL TO authenticated
  USING (auth.uid() = facility_id)
  WITH CHECK (auth.uid() = facility_id);

CREATE POLICY "Care physicians read feedback about themselves"
  ON public.staffing_feedback FOR SELECT TO authenticated
  USING (auth.uid() = provider_id);

CREATE TRIGGER staffing_feedback_set_updated_at
  BEFORE UPDATE ON public.staffing_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS staffing_feedback_provider_idx ON public.staffing_feedback (provider_id);
CREATE INDEX IF NOT EXISTS staffing_feedback_facility_idx ON public.staffing_feedback (facility_id);
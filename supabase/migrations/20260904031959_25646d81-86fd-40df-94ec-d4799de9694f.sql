CREATE TABLE public.physician_duty_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.staffing_assignments(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.staffing_jobs(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  facility_support smallint CHECK (facility_support BETWEEN 1 AND 5),
  workload smallint CHECK (workload BETWEEN 1 AND 5),
  would_work_again boolean,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id)
);

GRANT SELECT, INSERT, UPDATE ON public.physician_duty_feedback TO authenticated;
GRANT ALL ON public.physician_duty_feedback TO service_role;

ALTER TABLE public.physician_duty_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Physicians manage own duty feedback"
ON public.physician_duty_feedback FOR ALL TO authenticated
USING (auth.uid() = provider_id)
WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Facilities read feedback on their duties"
ON public.physician_duty_feedback FOR SELECT TO authenticated
USING (auth.uid() = facility_id);

CREATE POLICY "Admins read all duty feedback"
ON public.physician_duty_feedback FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_pdf_provider ON public.physician_duty_feedback(provider_id, created_at DESC);
CREATE INDEX idx_pdf_job ON public.physician_duty_feedback(job_id);

CREATE TRIGGER set_physician_duty_feedback_updated_at
BEFORE UPDATE ON public.physician_duty_feedback
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
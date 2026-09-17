CREATE POLICY "therapists insert own visits" ON public.physio_visits FOR INSERT TO authenticated WITH CHECK (therapist_id = auth.uid());

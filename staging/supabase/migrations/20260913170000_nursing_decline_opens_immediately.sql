-- ============================================================================
-- A decline should not cost the patient the full grace period.
--
-- nursing_accept_required.sql offers the work to the preferred nurse and waits
-- ten minutes before broadcasting. That is right for silence. It is wrong for a
-- clear "no": the patient sits waiting while the one person who was asked has
-- already said they cannot come.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.decline_nursing_engagement(p_engagement_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_preferred uuid;
BEGIN
  UPDATE public.nursing_engagement_offers
     SET response = 'declined', responded_at = now()
   WHERE engagement_id = p_engagement_id
     AND nurse_id = auth.uid()
     AND response IS NULL;

  SELECT preferred_nurse_id INTO v_preferred
    FROM public.nursing_engagements WHERE id = p_engagement_id;

  -- Only the preferred nurse's refusal ends the wait. Anyone else declining is
  -- just one fewer taker in a broadcast that is already open.
  IF v_preferred IS NOT NULL AND v_preferred = auth.uid() THEN
    UPDATE public.nursing_engagements
       SET broadcast_after = now(), updated_at = now()
     WHERE id = p_engagement_id AND assignment_state = 'seeking_nurse';
    PERFORM public.escalate_nursing_engagement(p_engagement_id);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.decline_nursing_engagement(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.decline_nursing_engagement(uuid) FROM PUBLIC, anon;

-- ============================================================================
-- booking_matching_settings: create the singleton row.
--
-- 20260916120000 creates the table but never inserts into it, and every engine
-- function does `SELECT * INTO s FROM public.booking_matching_settings WHERE id`.
-- With an empty table `s` is null the whole way through, so the radius, expiry
-- and penalties all fall back to the COALESCE defaults written inline in each
-- function. Matching still runs, but:
--
--   * the admin Booking Operations board reads nothing
--   * changing the radius there updates zero rows and silently does nothing
--   * the handover's promise of "editable without a deploy" does not hold
--
-- Values are the defaults from section 6.1 of the handover.
-- ============================================================================

INSERT INTO public.booking_matching_settings (
  id, initial_radius_km, expansion_interval_minutes, expansion_step_km,
  max_radius_km, offer_expiry_minutes, minimum_reliability_score,
  provider_cancellation_penalty, late_arrival_penalty, no_show_penalty)
VALUES (true, 4, 1, 1, 11, 10, 40, -8, -4, -15)
ON CONFLICT (id) DO NOTHING;

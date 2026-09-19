-- ============================================================================
-- technicians.languages
--
-- The technician profile screen has a Languages chip set, matching the nurse
-- and physiotherapist screens, but the column was never added: nurses and
-- physio_therapists both got `languages` in 20260916120000 and technicians did
-- not. Saving a technician profile would have dropped the selection silently.
--
-- Additive, with a default, so nothing existing changes.
-- ============================================================================

ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}';

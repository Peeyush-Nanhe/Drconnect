ALTER TABLE public.care_requests
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancel_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
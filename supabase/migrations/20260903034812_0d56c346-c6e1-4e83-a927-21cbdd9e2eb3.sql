CREATE TABLE public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token text not null,
  platform text not null check (platform in ('android','ios','web')),
  provider text not null default 'fcm' check (provider in ('fcm','apns','expo','webpush')),
  device_id text,
  app_version text,
  locale text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, token)
);

CREATE INDEX idx_device_tokens_user ON public.device_tokens(user_id) WHERE enabled;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own device tokens select" ON public.device_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own device tokens insert" ON public.device_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own device tokens update" ON public.device_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own device tokens delete" ON public.device_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_device_tokens_updated_at
BEFORE UPDATE ON public.device_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_token_id uuid references public.device_tokens(id) on delete set null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  topic text,
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX idx_push_deliveries_user ON public.push_deliveries(user_id, created_at DESC);
CREATE INDEX idx_push_deliveries_status ON public.push_deliveries(status) WHERE status = 'queued';

GRANT SELECT ON public.push_deliveries TO authenticated;
GRANT ALL ON public.push_deliveries TO service_role;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own push deliveries select" ON public.push_deliveries FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_push_deliveries_updated_at
BEFORE UPDATE ON public.push_deliveries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
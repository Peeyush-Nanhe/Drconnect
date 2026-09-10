
CREATE TABLE public.hub_favorite_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hub_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('general','surgery')),
  category TEXT NOT NULL,
  provider_id UUID NOT NULL,
  provider_name TEXT,
  slot SMALLINT NOT NULL DEFAULT 1 CHECK (slot BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hub_id, kind, category, slot),
  UNIQUE (hub_id, kind, category, provider_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_favorite_providers TO authenticated;
GRANT ALL ON public.hub_favorite_providers TO service_role;

ALTER TABLE public.hub_favorite_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hub owns its favorite providers"
  ON public.hub_favorite_providers
  FOR ALL
  USING (auth.uid() = hub_id)
  WITH CHECK (auth.uid() = hub_id);

CREATE INDEX hub_favorite_providers_hub_kind_idx
  ON public.hub_favorite_providers (hub_id, kind, category);

CREATE TRIGGER hub_favorite_providers_set_updated_at
  BEFORE UPDATE ON public.hub_favorite_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

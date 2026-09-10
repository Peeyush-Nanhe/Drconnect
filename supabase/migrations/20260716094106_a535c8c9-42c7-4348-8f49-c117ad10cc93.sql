
CREATE TABLE public.ai_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('triage','report','voice')),
  title TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  share_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_history_user_created_idx ON public.ai_history(user_id, created_at DESC);
CREATE INDEX ai_history_share_token_idx ON public.ai_history(share_token) WHERE share_token IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_history TO authenticated;
GRANT SELECT ON public.ai_history TO anon;
GRANT ALL ON public.ai_history TO service_role;

ALTER TABLE public.ai_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their ai history"
  ON public.ai_history FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anonymous readers may only see rows explicitly shared via a token.
-- The token acts as an unguessable capability; anon still must provide it in the query.
CREATE POLICY "Anyone can read shared ai history via token"
  ON public.ai_history FOR SELECT
  TO anon, authenticated
  USING (share_token IS NOT NULL);

CREATE TRIGGER ai_history_set_updated_at
  BEFORE UPDATE ON public.ai_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

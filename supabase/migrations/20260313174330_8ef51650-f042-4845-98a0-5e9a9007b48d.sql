CREATE TABLE public.pair_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  timeframe text NOT NULL DEFAULT '1h',
  analysis jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pair_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pair analyses are viewable by authenticated users"
  ON public.pair_analyses FOR SELECT TO authenticated
  USING (true);

CREATE INDEX idx_pair_analyses_lookup ON public.pair_analyses (pair_id, timeframe, created_at DESC);
CREATE TABLE public.market_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief jsonb NOT NULL,
  timeframe text NOT NULL DEFAULT '1h',
  scan_score_avg numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Market briefs are viewable by authenticated users"
  ON public.market_briefs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Market briefs can be inserted by authenticated users"
  ON public.market_briefs FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE TABLE social_sentiment (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('reddit','twitter','stocktwits')),
  pair_symbol text,
  content text,
  sentiment text check (sentiment in ('bullish','bearish','neutral')),
  confidence numeric default 0.5,
  upvotes int default 0,
  original_url text,
  published_at timestamptz,
  fetched_at timestamptz default now()
);

ALTER TABLE social_sentiment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Social sentiment viewable by authenticated users"
  ON social_sentiment FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage social sentiment"
  ON social_sentiment FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE scores ADD COLUMN IF NOT EXISTS social_score numeric;

ALTER PUBLICATION supabase_realtime ADD TABLE social_sentiment;
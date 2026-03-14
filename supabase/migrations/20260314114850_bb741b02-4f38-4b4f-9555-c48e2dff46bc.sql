CREATE TABLE public.news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL,
  summary text,
  source text,
  url text,
  published_at timestamptz,
  sentiment text DEFAULT 'neutral',
  relevant_pairs text[] DEFAULT '{}',
  image_url text,
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "News articles are viewable by authenticated users"
  ON public.news_articles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert news"
  ON public.news_articles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_news_published_at ON public.news_articles (published_at DESC);
CREATE INDEX idx_news_relevant_pairs ON public.news_articles USING GIN (relevant_pairs);
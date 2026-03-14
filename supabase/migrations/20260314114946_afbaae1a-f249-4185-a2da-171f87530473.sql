DROP POLICY "Service role can insert news" ON public.news_articles;

CREATE POLICY "Service role can manage news"
  ON public.news_articles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
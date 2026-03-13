
-- Add unique constraint for score upsert on (pair_id, timeframe)
ALTER TABLE public.scores ADD CONSTRAINT scores_pair_timeframe_unique UNIQUE (pair_id, timeframe);

-- Allow authenticated users to insert and update scores
CREATE POLICY "Authenticated users can insert scores"
  ON public.scores FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update scores"
  ON public.scores FOR UPDATE TO authenticated
  USING (true);

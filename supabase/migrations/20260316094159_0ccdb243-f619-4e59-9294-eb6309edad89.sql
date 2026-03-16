
CREATE TABLE public.mtf_alignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid REFERENCES public.pairs(id) ON DELETE CASCADE NOT NULL,
  symbol text NOT NULL,
  direction text NOT NULL DEFAULT 'neutral',
  alignment numeric NOT NULL DEFAULT 0,
  alignment_score numeric NOT NULL DEFAULT 0,
  label text NOT NULL DEFAULT 'Conflicting',
  bull_count integer NOT NULL DEFAULT 0,
  bear_count integer NOT NULL DEFAULT 0,
  scores_5m jsonb,
  scores_30m jsonb,
  scores_1h jsonb,
  scores_4h jsonb,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pair_id)
);

ALTER TABLE public.mtf_alignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MTF alignments viewable by everyone" ON public.mtf_alignments FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert mtf alignments" ON public.mtf_alignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update mtf alignments" ON public.mtf_alignments FOR UPDATE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.mtf_alignments;

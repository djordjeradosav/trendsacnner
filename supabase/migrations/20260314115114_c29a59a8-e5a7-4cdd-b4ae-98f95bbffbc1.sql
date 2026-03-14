CREATE TABLE public.daily_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Briefings viewable by authenticated users"
  ON public.daily_briefings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage briefings"
  ON public.daily_briefings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
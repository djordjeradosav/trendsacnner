CREATE TABLE public.event_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  currency text,
  scheduled_at timestamptz NOT NULL,
  prediction jsonb NOT NULL,
  was_correct boolean,
  actual_outcome text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_name, currency, scheduled_at)
);

ALTER TABLE public.event_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event predictions viewable by authenticated users"
ON public.event_predictions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Service role can manage event predictions"
ON public.event_predictions FOR ALL TO service_role
USING (true) WITH CHECK (true);
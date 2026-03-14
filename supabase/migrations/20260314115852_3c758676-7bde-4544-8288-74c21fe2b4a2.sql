CREATE TABLE public.economic_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name text NOT NULL,
  country text,
  impact text NOT NULL DEFAULT 'low',
  scheduled_at timestamptz NOT NULL,
  actual text,
  forecast text,
  previous text,
  currency text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.economic_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Economic events viewable by authenticated users"
  ON public.economic_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role can manage economic events"
  ON public.economic_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX idx_economic_events_unique ON public.economic_events (event_name, scheduled_at, currency);

CREATE TABLE public.event_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.economic_events(id) ON DELETE CASCADE,
  pair_symbol text NOT NULL,
  actual_value text,
  forecast_value text,
  surprise numeric,
  beat_miss text,
  price_at_release numeric,
  change_15m numeric,
  change_30m numeric,
  change_60m numeric,
  max_move_60m numeric,
  direction text,
  pips_move numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.event_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event reactions viewable by authenticated users"
  ON public.event_reactions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role can manage event reactions"
  ON public.event_reactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_event_reactions_event_id ON public.event_reactions(event_id);
CREATE INDEX idx_event_reactions_pair_symbol ON public.event_reactions(pair_symbol);

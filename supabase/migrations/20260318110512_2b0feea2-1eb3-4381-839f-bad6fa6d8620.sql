
CREATE TABLE public.macro_indicators (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator      text NOT NULL,
  country        text NOT NULL DEFAULT 'US',
  actual         numeric,
  previous       numeric,
  forecast       numeric,
  surprise       numeric,
  beat_miss      text,
  release_date   date NOT NULL,
  unit           text,
  source         text DEFAULT 'FRED',
  created_at     timestamptz DEFAULT now(),
  UNIQUE(indicator, release_date, country)
);

CREATE INDEX idx_macro_indicator ON public.macro_indicators(indicator, release_date DESC);

ALTER TABLE public.macro_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Macro indicators viewable by authenticated users"
  ON public.macro_indicators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage macro indicators"
  ON public.macro_indicators FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Validation trigger instead of CHECK constraint for beat_miss
CREATE OR REPLACE FUNCTION public.validate_beat_miss()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  IF NEW.beat_miss IS NOT NULL AND NEW.beat_miss NOT IN ('beat', 'miss', 'inline', 'pending') THEN
    RAISE EXCEPTION 'Invalid beat_miss value: %', NEW.beat_miss;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_beat_miss
  BEFORE INSERT OR UPDATE ON public.macro_indicators
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_beat_miss();

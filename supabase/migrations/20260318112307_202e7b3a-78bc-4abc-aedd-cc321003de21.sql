
CREATE TABLE public.seasonality (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol        text NOT NULL,
  month_number  int  NOT NULL,
  year          int  NOT NULL,
  open          numeric,
  close         numeric,
  direction     text,
  return_pct    numeric,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(symbol, month_number, year)
);

CREATE TABLE public.seasonality_stats (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol       text NOT NULL,
  month_number int  NOT NULL,
  up_count     int  NOT NULL DEFAULT 0,
  down_count   int  NOT NULL DEFAULT 0,
  flat_count   int  DEFAULT 0,
  total_years  int  NOT NULL DEFAULT 0,
  up_pct       numeric,
  down_pct     numeric,
  avg_return   numeric,
  best_return  numeric,
  worst_return numeric,
  best_year    int,
  worst_year   int,
  bias         text,
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(symbol, month_number)
);

CREATE INDEX idx_seasonality_symbol ON public.seasonality(symbol, month_number, year);
CREATE INDEX idx_seasonality_stats ON public.seasonality_stats(symbol, month_number);

-- Validation triggers instead of CHECK constraints
CREATE OR REPLACE FUNCTION public.validate_seasonality_month()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.month_number < 1 OR NEW.month_number > 12 THEN
    RAISE EXCEPTION 'month_number must be between 1 and 12';
  END IF;
  IF NEW.direction IS NOT NULL AND NEW.direction NOT IN ('up','down','flat') THEN
    RAISE EXCEPTION 'Invalid direction value: %', NEW.direction;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_seasonality
  BEFORE INSERT OR UPDATE ON public.seasonality
  FOR EACH ROW EXECUTE FUNCTION public.validate_seasonality_month();

CREATE OR REPLACE FUNCTION public.validate_seasonality_stats()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.month_number < 1 OR NEW.month_number > 12 THEN
    RAISE EXCEPTION 'month_number must be between 1 and 12';
  END IF;
  IF NEW.bias IS NOT NULL AND NEW.bias NOT IN ('bullish','bearish','neutral') THEN
    RAISE EXCEPTION 'Invalid bias value: %', NEW.bias;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_seasonality_stats
  BEFORE INSERT OR UPDATE ON public.seasonality_stats
  FOR EACH ROW EXECUTE FUNCTION public.validate_seasonality_stats();

-- RLS
ALTER TABLE public.seasonality ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonality_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seasonality viewable by authenticated users" ON public.seasonality FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage seasonality" ON public.seasonality FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Seasonality stats viewable by authenticated users" ON public.seasonality_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage seasonality stats" ON public.seasonality_stats FOR ALL TO service_role USING (true) WITH CHECK (true);

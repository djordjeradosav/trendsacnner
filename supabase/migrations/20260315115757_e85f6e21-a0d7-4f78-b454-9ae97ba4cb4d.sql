ALTER TABLE public.economic_events ADD COLUMN IF NOT EXISTS is_tentative boolean DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.economic_events DROP CONSTRAINT IF EXISTS economic_events_impact_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.economic_events ADD CONSTRAINT economic_events_impact_check
  CHECK (impact IN ('high', 'medium', 'low', 'holiday'));

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
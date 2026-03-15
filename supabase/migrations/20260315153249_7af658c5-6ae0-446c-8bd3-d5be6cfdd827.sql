ALTER TABLE economic_events 
  ADD COLUMN IF NOT EXISTS is_historical boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_synthetic boolean DEFAULT false;
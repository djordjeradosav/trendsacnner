-- First, clean up all duplicates keeping only the newest row per event
DELETE FROM economic_events
WHERE id NOT IN (
  SELECT DISTINCT ON (event_name, scheduled_at, COALESCE(currency, ''))
    id
  FROM economic_events
  ORDER BY event_name, scheduled_at, COALESCE(currency, ''), created_at DESC
);

-- Create a unique index using COALESCE so null currency doesn't break uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_economic_events_unique
ON economic_events (event_name, scheduled_at, COALESCE(currency, ''));
-- Fix is_tentative for events that have real times
UPDATE economic_events 
SET is_tentative = false 
WHERE is_tentative = true 
  AND scheduled_at::time != '00:00:00' 
  AND scheduled_at::time != '12:00:00';

-- Set currency from country only where it won't create duplicates
UPDATE economic_events e
SET currency = e.country
WHERE e.currency IS NULL 
  AND e.country IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM economic_events e2
    WHERE e2.event_name = e.event_name
      AND e2.scheduled_at = e.scheduled_at
      AND e2.currency = e.country
  );

-- Delete orphan rows with NULL currency that have a duplicate with currency set
DELETE FROM economic_events e
WHERE e.currency IS NULL
  AND EXISTS (
    SELECT 1 FROM economic_events e2
    WHERE e2.event_name = e.event_name
      AND e2.scheduled_at = e.scheduled_at
      AND e2.currency IS NOT NULL
  );
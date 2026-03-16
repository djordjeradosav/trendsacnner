-- Most 12:00 UTC events are real (8 AM ET). Only keep tentative if no forecast AND no previous data
UPDATE economic_events 
SET is_tentative = false 
WHERE is_tentative = true 
  AND (forecast IS NOT NULL OR previous IS NOT NULL OR actual IS NOT NULL);
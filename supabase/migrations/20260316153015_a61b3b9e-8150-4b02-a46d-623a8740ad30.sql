-- Remove old 12:00 UTC placeholder rows that now have correct-time duplicates
DELETE FROM economic_events e1
WHERE e1.scheduled_at::time = '12:00:00'
  AND EXISTS (
    SELECT 1 FROM economic_events e2
    WHERE e2.event_name = e1.event_name
      AND e2.currency = e1.currency
      AND e2.scheduled_at::date = e1.scheduled_at::date
      AND e2.scheduled_at::time != '12:00:00'
      AND e2.id != e1.id
  );
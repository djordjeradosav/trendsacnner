CREATE OR REPLACE FUNCTION public.get_sparkline_data(p_timeframe text, p_limit int DEFAULT 20)
RETURNS TABLE(pair_id uuid, scores numeric[], score_change numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    s.pair_id,
    array_agg(s.score ORDER BY s.scanned_at ASC) as scores,
    (array_agg(s.score ORDER BY s.scanned_at DESC))[1] - 
    (array_agg(s.score ORDER BY s.scanned_at ASC))[1] as score_change
  FROM (
    SELECT pair_id, score, scanned_at,
           ROW_NUMBER() OVER (PARTITION BY pair_id ORDER BY scanned_at DESC) as rn
    FROM scores
    WHERE timeframe = p_timeframe
  ) s
  WHERE s.rn <= p_limit
  GROUP BY s.pair_id;
$$;
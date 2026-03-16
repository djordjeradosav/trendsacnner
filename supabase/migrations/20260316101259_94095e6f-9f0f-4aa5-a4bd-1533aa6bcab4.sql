
-- Index for fast history queries
CREATE INDEX IF NOT EXISTS idx_scores_history ON scores(pair_id, timeframe, scanned_at DESC);

-- RPC function for market score history
CREATE OR REPLACE FUNCTION get_market_score_history(p_timeframe text, p_limit int DEFAULT 200)
RETURNS TABLE(scan_time timestamptz, avg_score numeric, bullish_count bigint, bearish_count bigint, neutral_count bigint, total_pairs bigint)
LANGUAGE sql STABLE
AS $$
  SELECT 
    date_trunc('hour', scanned_at) as scan_time,
    ROUND(AVG(score)::numeric, 1) as avg_score,
    COUNT(*) FILTER (WHERE trend = 'bullish') as bullish_count,
    COUNT(*) FILTER (WHERE trend = 'bearish') as bearish_count,
    COUNT(*) FILTER (WHERE trend = 'neutral') as neutral_count,
    COUNT(*) as total_pairs
  FROM scores
  WHERE timeframe = p_timeframe
    AND scanned_at > now() - interval '30 days'
  GROUP BY date_trunc('hour', scanned_at)
  ORDER BY scan_time ASC
  LIMIT p_limit;
$$;

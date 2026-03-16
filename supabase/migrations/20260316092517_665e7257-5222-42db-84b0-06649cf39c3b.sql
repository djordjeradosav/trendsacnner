
CREATE INDEX IF NOT EXISTS idx_scores_timeframe_scanned 
  ON scores(timeframe, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_scores_pair_timeframe 
  ON scores(pair_id, timeframe);

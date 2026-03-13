
-- Add unique constraint on candles for upsert (pair_id + timeframe + ts)
ALTER TABLE public.candles ADD CONSTRAINT candles_pair_timeframe_ts_unique UNIQUE (pair_id, timeframe, ts);

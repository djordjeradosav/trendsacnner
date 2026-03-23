
ALTER TABLE pairs 
  ADD COLUMN IF NOT EXISTS finnhub_symbol text,
  ADD COLUMN IF NOT EXISTS display_symbol text;

CREATE INDEX IF NOT EXISTS idx_pairs_finnhub_symbol ON pairs(finnhub_symbol);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pairs_symbol_unique ON pairs(symbol);

# Memory: index.md
Updated: now

Design system constraints, timeframes, and architecture rules for TrendScanner AI

## Timeframes
Only 4 timeframes exist: 15min, 1h, 4h, 1day. 30min removed permanently.

## Architecture
- Pairs auto-discovered from Finnhub OANDA exchange via `sync-pairs` edge function
- `finnhub_symbol` column on `pairs` table stores the OANDA symbol (e.g. `OANDA:EUR_USD`)
- `display_symbol` column stores human-readable format (e.g. `EUR/USD`)
- No hardcoded pair lists or SYMBOL_MAP — fast-scan reads `finnhub_symbol` from DB
- Weekly cron `sync-pairs-weekly` runs Mondays 6am UTC
- `useAllScores(timeframe)` is the primary hook for score data (React Query + realtime)
- `useSectorStats(timeframe)` computes sector stats from useAllScores

## Design tokens
- Bullish: hsl(var(--bullish)) / #00ff7f
- Bearish: hsl(var(--bearish)) / #ff3b3b  
- Neutral: #7a99b0
- Muted timestamp: #3d5a70
- Badge backgrounds: bullish=#0d2b1a, bearish=#2b0d0d, neutral=#1a2635

## Removals
- 1min, 3min, 5min, 30min, 1week timeframes removed permanently
- SYMBOL_MAP hardcoded object removed from fast-scan and fetch-candles

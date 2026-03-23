Design system constraints, timeframes, and architecture rules for TrendScanner AI

## Timeframes
5 timeframes: 5min, 15min, 1h, 4h, 1day. Config at src/config/timeframes.ts.

## Two-Layer Scan System
- **Fast Scan** (button click): Fetches live prices via Finnhub forex/rates + /quote, appends synthetic candle to cached candles, recomputes scores with TF-specific EMA periods. Completes in ~1-2s.
- **Deep Scan** (pg_cron daily): Fetches full candle history from Finnhub for ALL 5 TFs. Batches of 8 with 62s delays.
- Fast scan requires cached candles from deep scan to work.
- EMA periods differ per TF: 5min/15min/1h use 9/21/50, 4h uses 9/21/50/200, 1day uses 20/50/200.

## Pair Filtering
Only forex (USD,EUR,GBP,JPY,AUD,CAD,CHF,NZD), commodities, and equity index futures from Finnhub OANDA. No stocks, crypto, ETFs.

## Architecture
- React Query based score fetching at `src/hooks/useScores.ts` with realtime subscriptions
- `useAllScores(timeframe)` loads scores for a specific TF
- Display utilities duplicated in components (TF_LABELS etc) — canonical source: `src/config/timeframes.ts`
- Scan button fires all 5 TFs in parallel via `useFastScan`

## Design tokens
- Bullish: hsl(var(--bullish)) / #00ff7f
- Bearish: hsl(var(--bearish)) / #ff3b3b  
- Neutral: #7a99b0
- Muted timestamp: #3d5a70
- Badge backgrounds: bullish=#0d2b1a, bearish=#2b0d0d, neutral=#1a2635

## Removals
- 1min, 3min, 30min, 1week timeframes removed permanently
- No hardcoded pair lists for Macro Desk — uses top 8 by score deviation from 50

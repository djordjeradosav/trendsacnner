Design system constraints, timeframes, and architecture rules for TrendScanner AI

## Timeframes
Only 4 timeframes exist: 15min, 1h, 4h, 1day. All others removed permanently.

## Two-Layer Scan System
- **Fast Scan** (button click): Fetches live prices via Finnhub forex/rates + /quote, appends synthetic candle to cached candles, recomputes scores. Completes in ~1-2s.
- **Deep Scan** (pg_cron daily): Fetches full candle history from Finnhub. Runs at 1am (1h), 1:30am (4h), 2am (1day) UTC. Batches of 8 with 60s delays.
- Fast scan requires cached candles from deep scan to work.

## Pair Filtering
Only forex (USD,EUR,GBP,JPY,AUD,CAD,CHF,NZD), commodities, and equity index futures from Finnhub OANDA. No stocks, crypto, ETFs.

## Architecture
- Zustand store at `src/stores/useScoresStore.ts` is the single source of truth for all score data
- Display utilities at `src/lib/display.ts` (trendColor, trendBadgeStyle, timeAgo, PAIR_NAMES, TIMEFRAME_CONFIG)
- `useEnsureFreshData()` hook must be called at top of every page component
- `loadAllTimeframeScores()` loads all 4 TFs into store on boot and after scans
- `subscribeToRealtimeScores()` subscribes to all 4 TFs for live updates
- Store is initialized in Index.tsx (dashboard) with loadPairs + loadAllTimeframeScores + subscribeToRealtimeScores

## Design tokens
- Bullish: hsl(var(--bullish)) / #00ff7f
- Bearish: hsl(var(--bearish)) / #ff3b3b  
- Neutral: #7a99b0
- Muted timestamp: #3d5a70
- Badge backgrounds: bullish=#0d2b1a, bearish=#2b0d0d, neutral=#1a2635

## Removals
- 1min, 3min, 5min, 30min, 1week timeframes removed permanently
- No hardcoded pair lists for Macro Desk — uses top 8 by score deviation from 50

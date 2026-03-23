# Memory: index.md
Updated: now

Design system constraints, timeframes, and architecture rules for TrendScanner AI

## Timeframes
Only 4 timeframes exist: 15min, 1h, 4h, 1day. 30min removed permanently along with 1min, 3min, 5min, 1week.

## Architecture
- Display utilities at `src/lib/display.ts` (trendColor, trendBadgeStyle, timeAgo, PAIR_NAMES, TIMEFRAME_CONFIG)
- `useScores.ts` hook (react-query) is used for score data
- `useTimeframe.ts` has the canonical timeframeOptions array (4 options)

## Design tokens
- Bullish: hsl(var(--bullish)) / #00ff7f
- Bearish: hsl(var(--bearish)) / #ff3b3b  
- Neutral: #7a99b0
- Muted timestamp: #3d5a70
- Badge backgrounds: bullish=#0d2b1a, bearish=#2b0d0d, neutral=#1a2635

## Removals
- 1min, 3min, 5min, 30min, 1week timeframes removed permanently
- No hardcoded pair lists for Macro Desk — uses top 8 by score deviation from 50

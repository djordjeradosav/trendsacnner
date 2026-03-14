TrendScan AI trading dashboard - design system, architecture, and key decisions

## Design System
- Bloomberg Terminal / dark IDE aesthetic
- Backgrounds: base #080c10, surface #0d1117, elevated #131a22, border #1e2d3d
- Primary accent: neon green #00ff7f, dim green #00c46a
- Info/cyan: #00d4ff, caution/orange: #ff6b35, bearish/red: #ff3b3b
- Text: primary #e8f4f8, secondary #7a99b0, tertiary #3d5a70
- Fonts: JetBrains Mono + Fira Code (numbers/tickers), system-ui (body)
- Body: 13px, line-height 1.6
- Cards: no shadows, 0.5px border, 10px radius, hover border #2a3f55
- Custom scrollbar: 4px, thumb #1e2d3d
- Utility classes: .ticker, .font-mono-nums, .section-label

## Architecture
- Supabase tables: pairs, candles, scores, alert_rules, alert_notifications, watchlists
- candles has unique constraint on (pair_id, timeframe, ts) for upsert
- Edge function: fetch-candles (verify_jwt=false) calls Twelve Data API
- Service: src/services/dataService.ts (fetchCandlesForPair, fetchAllPairs, getLatestCandles)
- Auth: email/password, RequireAuth wrapper in src/hooks/useAuth.tsx

## Data
- 73 pairs: 42 forex, 18 commodity, 13 futures
- Twelve Data API key stored as TWELVE_DATA_API_KEY secret
- Forex symbols mapped: EURUSD -> EUR/USD for Twelve Data API

## Layout
- Fixed 220px left sidebar, top header bar
- Debug panel visible only in dev mode (import.meta.env.DEV)

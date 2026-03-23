API provider migration history for candle data fetching

## Current: Twelve Data (since 2026-03-23)
- Free tier: 800 requests/day, 8 requests/minute
- Supports forex, commodities, and index futures natively
- Symbol format: "EUR/USD", "XAU/USD", "DJ30", "NDX", "SPX500"
- Secret: TWELVE_DATA_API_KEY (stored in edge function secrets)

## Previous: Finnhub (2026-03-16 to 2026-03-23)
- Free tier blocked OANDA candle data with 403 errors
- Only daily resolution worked; sub-daily always returned 403
- Replaced due to unreliable data access

## Previous: Twelve Data (before 2026-03-16)
- Original provider, replaced temporarily with Finnhub

## Edge Functions Using Twelve Data
- `fast-scan`: Full market scan with TD_SYMBOL_MAP
- `fetch-candles`: Single pair candle fetch
- Rate limiting: 8 requests per chunk, 62s wait between chunks

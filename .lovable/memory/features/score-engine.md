# Memory: features/score-engine.md
Updated: now

Score engine formula: EMA(0-30) + RSI(0-20) + MACD(0-15) + ADX(0-15) + News(0-12) + Macro(0-8) = 0-100.

## Components
1. EMA Alignment (0-30): 3-EMA (9/21/50) for 5min/15min/1h; 4-EMA (+200) for 4h/1day
2. RSI Momentum (0-20): RSI 14. Sweet spot 60-70 = 20pts. Oversold (<30) = 6 bounce potential.
3. MACD (0-15): Histogram direction + acceleration. Bullish accelerating = 15.
4. ADX Trend Strength (0-15): Combined with EMA direction for confidence. 35+ = 15pts.
5. News Sentiment (0-12): From news_articles table, 24h window. Default 6 if no news.
6. Macro Bias (0-8): From macro_indicators table, base vs quote currency beat/miss ratio. Default 4.

## Thresholds
- Bullish: score ≥ 62
- Bearish: score ≤ 38
- Neutral: 39-61

## Confidence Flags (6 checks)
- emaAligned, rsiInRange (50-70), macdConfirms, trendStrong (ADX>25), newsSupports, macroAligned

## Pair Detail Cards
- Bias card: Bullish/Mild Bull/Neutral/Mild Bear/Bearish
- Technical card: Strong Buy/Buy/Caution Buy/Hold/Strong Sell (from EMA+MACD agreement)
- AI Confidence card: Very High/High/Moderate/Low (from 6 confidence flags)

## Database
- scores table columns: ema_score, rsi_score, macd_score, adx_score, news_score, macro_score

## Files
- src/lib/scoreEngine.ts — client-side scoring (6 components)
- supabase/functions/fast-scan/index.ts — server-side scoring (6 components, loads news+macro once)
- src/pages/PairDetail.tsx — UI with 6-bar breakdown + confidence flags + Bias/Technical/Confidence cards

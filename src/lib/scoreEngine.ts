import {
  calcEMA,
  calcRSI,
  calcMACD,
  calcADX,
  getLatestValue,
} from "./indicators";
import { supabase } from "@/integrations/supabase/client";

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  ts: string;
  timeframe: string;
  pair_id: string;
}

export interface ScoreBreakdown {
  emaScore: number;    // 0-30
  rsiScore: number;    // 0-20
  macdScore: number;   // 0-15
  adxScore: number;    // 0-15
  newsScore: number;   // 0-12
  macroScore: number;  // 0-8
}

export interface ConfidenceFlags {
  emaAligned: boolean;
  rsiInRange: boolean;
  macdConfirms: boolean;
  trendStrong: boolean;
  newsSupports: boolean;
  macroAligned: boolean;
}

export interface EnhancedScoreResult {
  score: number;
  trend: "bullish" | "neutral" | "bearish";
  breakdown: ScoreBreakdown;
  confidenceFlags: ConfidenceFlags;

  // Raw indicator values
  ema20: number;
  ema50: number;
  ema200: number;
  adx: number;
  rsi: number;
  macdHist: number;
  macdHistPrev: number;

  // Legacy compat
  emaScore: number;
  adxScore: number;
  rsiScore: number;
  macdScore: number;
  newsScore: number | null;
  socialScore: number | null;
  macroScore: number;

  // Explanation lines
  explanationLines: string[];
}

export type ScoreResult = EnhancedScoreResult;

// ─── COMPONENT 1: EMA Alignment (0–30) ─────────────────────────────────────
function calcEMAScore(
  price: number, ef: number, em: number, es: number, el: number | null
): { score: number; line: string } {
  if (el !== null) {
    // 4-EMA system (4h, 1day)
    if (price > ef && ef > em && em > es && es > el)
      return { score: 30, line: "✓ EMA: Perfect bull stack (price>9>21>50>200) (+30/30)" };
    if (price > ef && ef > em && em > es)
      return { score: 22, line: "~ EMA: Bull (price>9>21>50) (+22/30)" };
    if (price > ef && ef > em)
      return { score: 16, line: "~ EMA: Price>9>21 (+16/30)" };
    if (price > ef)
      return { score: 10, line: "~ EMA: Price>9 only (+10/30)" };
    if (price < ef && ef < em && em < es && es < el)
      return { score: 0, line: "✗ EMA: Perfect bear stack (+0/30)" };
    if (price < ef && ef < em && em < es)
      return { score: 2, line: "✗ EMA: Bear (price<9<21<50) (+2/30)" };
    if (price < ef)
      return { score: 6, line: "~ EMA: Price below fast EMA (+6/30)" };
    return { score: 8, line: "~ EMA: Mixed/choppy (+8/30)" };
  }
  // 3-EMA system (5min, 15min, 1h)
  if (price > ef && ef > em && em > es)
    return { score: 30, line: "✓ EMA: Perfect bull stack (+30/30)" };
  if (price > ef && ef > em)
    return { score: 22, line: "~ EMA: Price>9>21 (+22/30)" };
  if (price > ef)
    return { score: 14, line: "~ EMA: Price>9 only (+14/30)" };
  if (price < ef && ef < em && em < es)
    return { score: 0, line: "✗ EMA: Perfect bear stack (+0/30)" };
  if (price < ef && ef < em)
    return { score: 6, line: "~ EMA: Partial bear (+6/30)" };
  if (price < ef)
    return { score: 10, line: "~ EMA: Mixed bearish (+10/30)" };
  return { score: 10, line: "~ EMA: Mixed/choppy (+10/30)" };
}

// ─── COMPONENT 2: RSI (0–20) ────────────────────────────────────────────────
function calcRSIScore(rsi: number): { score: number; line: string } {
  let score: number;
  if      (rsi >= 60 && rsi < 70) score = 20;
  else if (rsi >= 70 && rsi < 80) score = 18;
  else if (rsi >= 80)             score = 12;
  else if (rsi >= 55)             score = 16;
  else if (rsi >= 50)             score = 12;
  else if (rsi >= 45)             score = 8;
  else if (rsi >= 40)             score = 5;
  else if (rsi >= 30)             score = 3;
  else                            score = 6; // oversold bounce
  const label = score >= 16 ? "✓" : score >= 8 ? "~" : "✗";
  return { score, line: `${label} RSI ${rsi.toFixed(0)} — (+${score}/20)` };
}

// ─── COMPONENT 3: MACD (0–15) ───────────────────────────────────────────────
function calcMACDScore(histCurr: number, histPrev: number): { score: number; line: string } {
  const accelerating = Math.abs(histCurr) > Math.abs(histPrev);
  let score: number;
  let desc: string;
  if (histCurr > 0 && accelerating)       { score = 15; desc = "bullish & accelerating"; }
  else if (histCurr > 0 && !accelerating) { score = 10; desc = "bullish but weakening"; }
  else if (Math.abs(histCurr) < 0.00001)  { score = 8;  desc = "crossover zone"; }
  else if (histCurr < 0 && accelerating)  { score = 2;  desc = "bearish & accelerating"; }
  else if (histCurr < 0 && !accelerating) { score = 5;  desc = "bearish but improving"; }
  else                                    { score = 7;  desc = "neutral"; }
  const label = score >= 10 ? "✓" : score >= 5 ? "~" : "✗";
  return { score, line: `${label} MACD: ${desc} (+${score}/15)` };
}

// ─── COMPONENT 4: ADX Trend Strength (0–15) ─────────────────────────────────
function calcADXScore(adx: number, emaDir: "bullish" | "bearish" | "neutral"): { score: number; line: string } {
  let score: number;
  if (emaDir === "neutral") {
    score = adx < 15 ? 5 : 8;
  } else {
    if      (adx >= 50) score = 10; // extreme — possible exhaustion
    else if (adx >= 35) score = 15;
    else if (adx >= 25) score = 13;
    else if (adx >= 20) score = 10;
    else if (adx >= 15) score = 7;
    else                score = 3;
  }
  const label = score >= 13 ? "✓" : score >= 7 ? "~" : "✗";
  return { score, line: `${label} ADX ${adx.toFixed(0)} — (+${score}/15)` };
}

// ─── COMPONENT 5: News Sentiment (0–12) ─────────────────────────────────────
function calcNewsScoreFromRaw(rawNewsScore: number | null | undefined): { score: number; line: string } {
  if (rawNewsScore == null) return { score: 6, line: "— News: no data (+6/12 default)" };
  // rawNewsScore is 0-11 from newsSentimentScore.ts, scale to 0-12
  const ratio = rawNewsScore / 11;
  let score: number;
  if      (ratio >= 0.8) score = 12;
  else if (ratio >= 0.65) score = 10;
  else if (ratio >= 0.55) score = 8;
  else if (ratio >= 0.45) score = 6;
  else if (ratio >= 0.35) score = 4;
  else if (ratio >= 0.2) score = 2;
  else                    score = 0;
  const label = score >= 8 ? "✓" : score >= 4 ? "~" : "✗";
  return { score, line: `${label} News sentiment (+${score}/12)` };
}

// ─── COMPONENT 6: Macro Bias (0–8) ──────────────────────────────────────────
const MACRO_CURRENCY_MAP: Record<string, string[]> = {
  USD: ["NFP", "CPI", "INTEREST_RATE"],
  EUR: ["EUR_CPI", "EUR_GDP"],
  GBP: ["GBP_CPI", "GBP_GDP"],
  JPY: ["BOJ_RATE", "JP_CPI"],
  AUD: ["AUD_CPI", "RBA_RATE"],
  CAD: ["CAD_GDP", "BOC_RATE"],
  CHF: ["SNB_RATE"],
  NZD: ["RBNZ_RATE"],
};

interface MacroRow {
  indicator: string;
  beat_miss: string | null;
  release_date: string;
}

function calcCurrencyMacroStrength(indicators: string[], macroData: MacroRow[]): number {
  if (!indicators.length) return 0.5;
  const relevant = macroData
    .filter(r => indicators.includes(r.indicator))
    .sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime())
    .slice(0, 3);
  if (!relevant.length) return 0.5;
  const beats = relevant.filter(r => r.beat_miss === "beat").length;
  return beats / relevant.length;
}

function calcMacroScoreValue(
  baseCurrency: string, quoteCurrency: string, macroData: MacroRow[]
): { score: number; line: string } {
  const baseIndicators = MACRO_CURRENCY_MAP[baseCurrency] ?? [];
  const quoteIndicators = MACRO_CURRENCY_MAP[quoteCurrency] ?? [];
  const baseStrength = calcCurrencyMacroStrength(baseIndicators, macroData);
  const quoteStrength = calcCurrencyMacroStrength(quoteIndicators, macroData);
  const net = baseStrength - quoteStrength; // -1 to +1

  let score: number;
  if      (net >= 0.5)  score = 8;
  else if (net >= 0.2)  score = 6;
  else if (net >= -0.2) score = 4;
  else if (net >= -0.5) score = 2;
  else                  score = 0;

  const label = score >= 6 ? "✓" : score >= 2 ? "~" : "✗";
  return { score, line: `${label} Macro bias ${baseCurrency}/${quoteCurrency}: net=${net.toFixed(2)} (+${score}/8)` };
}

// ─── Composite Score ────────────────────────────────────────────────────────

export function calcTrendScore(
  candles: Candle[],
  newsScore?: number | null,
  socialScore?: number | null,
  timeframe?: string,
  macroData?: MacroRow[],
  symbol?: string,
): EnhancedScoreResult {
  const sorted = [...candles].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );

  const closes = sorted.map(c => c.close);
  const highs = sorted.map(c => c.high);
  const lows = sorted.map(c => c.low);
  const n = closes.length;

  // Timeframe-specific EMA periods
  const useLongEMA = timeframe === "4h" || timeframe === "1day";
  const emaFastP = 9, emaMidP = 21, emaSlowP = 50;
  const emaLongP = useLongEMA ? 200 : null;

  const efArr = calcEMA(closes, emaFastP);
  const emArr = calcEMA(closes, emaMidP);
  const esArr = calcEMA(closes, emaSlowP);
  const elArr = emaLongP ? calcEMA(closes, emaLongP) : null;
  const rsiArr = calcRSI(closes, 14);
  const adxArr = calcADX(highs, lows, closes, 14);
  const { histogram } = calcMACD(closes, 12, 26, 9);

  const price = closes[n - 1];
  const ef = getLatestValue(efArr);
  const em = getLatestValue(emArr);
  const es = getLatestValue(esArr);
  const el = elArr ? getLatestValue(elArr) : null;
  const rsi = getLatestValue(rsiArr);
  const adx = getLatestValue(adxArr);
  const macdHist = getLatestValue(histogram);
  let macdHistPrev = NaN;
  for (let i = histogram.length - 2; i >= 0; i--) {
    if (!isNaN(histogram[i])) { macdHistPrev = histogram[i]; break; }
  }

  // Determine EMA direction for ADX scoring
  const emaDir: "bullish" | "bearish" | "neutral" = (() => {
    if (isNaN(ef) || isNaN(em)) return "neutral";
    if (price > ef && ef > em) return "bullish";
    if (price < ef && ef < em) return "bearish";
    return "neutral";
  })();

  // Component scores
  const ema = (!isNaN(ef) && !isNaN(em) && !isNaN(es))
    ? calcEMAScore(price, ef, em, es, !isNaN(el ?? NaN) ? el : null)
    : { score: 10, line: "~ EMA: insufficient data (+10/30)" };

  const rsiR = !isNaN(rsi)
    ? calcRSIScore(rsi)
    : { score: 12, line: "— RSI: insufficient data (+12/20)" };

  const macdR = (!isNaN(macdHist) && !isNaN(macdHistPrev))
    ? calcMACDScore(macdHist, macdHistPrev)
    : { score: 7, line: "— MACD: insufficient data (+7/15)" };

  const adxR = !isNaN(adx)
    ? calcADXScore(adx, emaDir)
    : { score: 7, line: "— ADX: insufficient data (+7/15)" };

  const newsR = calcNewsScoreFromRaw(newsScore);

  // Macro score
  const sym = symbol ?? (candles[0]?.pair_id ?? "");
  const baseCurrency = sym.slice(0, 3);
  const quoteCurrency = sym.slice(3, 6);
  const macroR = (macroData && macroData.length > 0)
    ? calcMacroScoreValue(baseCurrency, quoteCurrency, macroData)
    : { score: 4, line: "— Macro: no data (+4/8 default)" };

  const total = ema.score + rsiR.score + macdR.score + adxR.score + newsR.score + macroR.score;
  const score = Math.min(100, Math.max(0, Math.round(total)));
  const trend: "bullish" | "neutral" | "bearish" =
    score >= 62 ? "bullish" : score <= 38 ? "bearish" : "neutral";

  const confidenceFlags: ConfidenceFlags = {
    emaAligned: emaDir !== "neutral",
    rsiInRange: rsi >= 50 && rsi <= 70,
    macdConfirms: (macdHist > 0) === (score > 50),
    trendStrong: adx > 25,
    newsSupports: newsR.score >= 8 || newsR.score <= 4,
    macroAligned: macroR.score >= 6 || macroR.score <= 2,
  };

  const explanationLines = [
    `EMA Alignment: ${ema.score}/30`,
    `  ${ema.line}`,
    `RSI Momentum: ${rsiR.score}/20`,
    `  ${rsiR.line}`,
    `MACD: ${macdR.score}/15`,
    `  ${macdR.line}`,
    `ADX Trend Strength: ${adxR.score}/15`,
    `  ${adxR.line}`,
    `News Sentiment: ${newsR.score}/12`,
    `  ${newsR.line}`,
    `Macro Bias: ${macroR.score}/8`,
    `  ${macroR.line}`,
    `TOTAL: ${score}/100 → ${trend}`,
  ];

  return {
    score,
    trend,
    breakdown: {
      emaScore: ema.score,
      rsiScore: rsiR.score,
      macdScore: macdR.score,
      adxScore: adxR.score,
      newsScore: newsR.score,
      macroScore: macroR.score,
    },
    confidenceFlags,
    ema20: isNaN(ef) ? 0 : ef,
    ema50: isNaN(em) ? 0 : em,
    ema200: isNaN(el ?? NaN) ? (isNaN(es) ? 0 : es) : el!,
    adx: isNaN(adx) ? 0 : adx,
    rsi: isNaN(rsi) ? 50 : rsi,
    macdHist: isNaN(macdHist) ? 0 : macdHist,
    macdHistPrev: isNaN(macdHistPrev) ? 0 : macdHistPrev,
    emaScore: ema.score,
    adxScore: adxR.score,
    rsiScore: rsiR.score,
    macdScore: macdR.score,
    newsScore: newsScore ?? null,
    socialScore: socialScore ?? null,
    macroScore: macroR.score,
    explanationLines,
  };
}

// ─── Score & Upsert ─────────────────────────────────────────────────────────

export async function scorePair(
  pairId: string,
  candles: Candle[],
  timeframe: string,
  newsScore?: number | null,
  socialScore?: number | null,
  macroData?: MacroRow[],
  symbol?: string,
): Promise<EnhancedScoreResult> {
  const result = calcTrendScore(candles, newsScore, socialScore, timeframe, macroData, symbol);

  const { error } = await supabase.from("scores").upsert(
    {
      pair_id: pairId,
      timeframe,
      score: result.score,
      trend: result.trend,
      ema_score: result.emaScore,
      adx_score: result.adxScore,
      rsi_score: result.rsiScore,
      macd_score: result.macdScore,
      news_score: result.newsScore,
      social_score: result.socialScore,
      macro_score: result.macroScore,
      ema20: result.ema20,
      ema50: result.ema50,
      ema200: result.ema200,
      adx: result.adx,
      rsi: result.rsi,
      macd_hist: result.macdHist,
      scanned_at: new Date().toISOString(),
    },
    { onConflict: "pair_id,timeframe" }
  );

  if (error) {
    throw new Error(`Score upsert failed: ${error.message}`);
  }

  return result;
}

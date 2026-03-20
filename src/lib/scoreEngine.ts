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
  emaScore: number;       // 0-55
  rsiScore: number;       // 0-30
  newsScore: number;      // 0-15
  // Legacy compat — always 0
  adxScore: number;
  macdScore: number;
  technicalTotal: number;
  fundamentalTotal: number;
  eventRiskScore: number;
  stocktwitsScore: number;
  redditScore: number;
  socialTotal: number;
}

export interface EnhancedScoreResult {
  score: number;
  trend: "bullish" | "neutral" | "bearish";
  breakdown: ScoreBreakdown;

  // Raw indicator values
  ema20: number;
  ema50: number;
  ema200: number;
  adx: number;
  rsi: number;
  macdHist: number;
  macdHistPrev: number;

  // Event risk (legacy)
  eventRiskFlag: boolean;
  upcomingEvent: string | null;
  upcomingEventTime: string | null;
  scoreBeforeEventRisk: number;

  // Data quality
  dataQuality: "full" | "technical-only";
  lastNewsUpdate: string | null;
  lastSocialUpdate: string | null;

  // Legacy compat
  emaScore: number;
  adxScore: number;
  rsiScore: number;
  macdScore: number;
  newsScore: number | null;
  socialScore: number | null;

  // Explanation lines
  explanationLines: string[];

  // Confidence
  confidenceFlags: string[];
}

export type ScoreResult = EnhancedScoreResult;

// ─── EMA Alignment (0–55) ───────────────────────────────────────────────────
function scoreEMA(
  price: number,
  emaFast: number,
  emaMid: number,
  emaSlow: number,
  ema200: number | null,
  timeframe: string,
  emaFastArr?: number[],
  emaMidArr?: number[],
  emaSlowArr?: number[]
): { score: number; line: string } {
  const isLongTF = timeframe === "4h" || timeframe === "1day";
  let base: number;
  let desc: string;

  if (isLongTF && ema200 != null && !isNaN(ema200)) {
    // 4-EMA system
    if (price > emaFast && emaFast > emaMid && emaMid > emaSlow && emaSlow > ema200) {
      base = 55; desc = "Perfect bullish alignment (4-EMA)";
    } else if (price < emaFast && emaFast < emaMid && emaMid < emaSlow && emaSlow < ema200) {
      base = 0; desc = "Perfect bearish alignment (4-EMA)";
    } else if (price > emaFast && emaFast > emaMid && emaMid > emaSlow) {
      base = 40; desc = "Price > Fast > Mid > Slow";
    } else if (price > emaFast && emaFast > emaMid) {
      base = 28; desc = "Price > Fast > Mid";
    } else if (price > emaFast) {
      base = 16; desc = "Price above fast EMA only";
    } else if (price < emaFast && emaFast < emaMid && emaMid < emaSlow) {
      base = 14; desc = "Partial bearish (3-EMA)";
    } else if (price < emaFast && emaFast < emaMid) {
      base = 8; desc = "Price < Fast < Mid";
    } else if (price < emaFast) {
      base = 4; desc = "Price below fast EMA";
    } else {
      base = 22; desc = "Mixed/neutral";
    }
  } else {
    // 3-EMA system for 15M, 30M, 1H
    if (price > emaFast && emaFast > emaMid && emaMid > emaSlow) {
      base = 55; desc = "Full bullish alignment";
    } else if (price < emaFast && emaFast < emaMid && emaMid < emaSlow) {
      base = 0; desc = "Full bearish alignment";
    } else if (price > emaFast && emaFast > emaMid) {
      base = 40; desc = "Price > Fast > Mid";
    } else if (price > emaFast && emaMid > emaSlow) {
      base = 30; desc = "Price > Fast, Mid > Slow";
    } else if (price > emaFast) {
      base = 20; desc = "Price above fast EMA only";
    } else if (price < emaFast && emaFast < emaMid) {
      base = 10; desc = "Partial bearish";
    } else if (price < emaFast) {
      base = 6; desc = "Price below fast EMA";
    } else {
      base = 22; desc = "Mixed/neutral";
    }
  }

  // EMA Direction Bonus: check if all 3 EMAs slope same direction
  let bonus = 0;
  if (emaFastArr && emaMidArr && emaSlowArr) {
    const len = emaFastArr.length;
    if (len >= 4) {
      const fRising = emaFastArr[len - 1] > emaFastArr[len - 4];
      const mRising = emaMidArr[len - 1] > emaMidArr[len - 4];
      const sRising = emaSlowArr[len - 1] > emaSlowArr[len - 4];
      const fFalling = emaFastArr[len - 1] < emaFastArr[len - 4];
      const mFalling = emaMidArr[len - 1] < emaMidArr[len - 4];
      const sFalling = emaSlowArr[len - 1] < emaSlowArr[len - 4];

      if (fRising && mRising && sRising) { bonus = 5; desc += " +slope bonus"; }
      else if (fFalling && mFalling && sFalling) { bonus = -5; desc += " -slope penalty"; }
    }
  }

  const score = Math.max(0, Math.min(55, base + bonus));
  const label = score >= 40 ? "✓" : score <= 10 ? "✗" : "~";
  return { score, line: `${label} EMA: ${desc} (+${score}/55)` };
}

// ─── RSI Bias (0–30) ────────────────────────────────────────────────────────
function scoreRSI(rsi: number, rsiArr?: number[]): { score: number; line: string } {
  let base: number;
  if (rsi >= 70) base = 24;
  else if (rsi >= 60) base = 30;
  else if (rsi >= 55) base = 26;
  else if (rsi >= 50) base = 20;
  else if (rsi >= 45) base = 12;
  else if (rsi >= 40) base = 7;
  else if (rsi >= 30) base = 3;
  else base = 5;

  // RSI momentum bonus
  let bonus = 0;
  if (rsiArr) {
    const len = rsiArr.length;
    if (len >= 4) {
      const rsiLatest = rsiArr[len - 1];
      const rsiPrev = rsiArr[len - 4];
      if (!isNaN(rsiLatest) && !isNaN(rsiPrev)) {
        if (rsi >= 50 && rsiLatest > rsiPrev) bonus = 3;
        else if (rsi < 50 && rsiLatest < rsiPrev) bonus = -3;
      }
    }
  }

  const score = Math.max(0, Math.min(30, base + bonus));
  const label = rsi >= 55 ? "✓" : rsi <= 45 ? "✗" : "~";
  return { score, line: `${label} RSI ${rsi.toFixed(1)} → +${score}/30` };
}

// ─── News Sentiment (0–15) ──────────────────────────────────────────────────
function scaleNewsScore(rawScore: number | null | undefined): { score: number; line: string; hasNews: boolean } {
  if (rawScore == null) return { score: 7, line: "— News: no data (+7/15 default)", hasNews: false };
  // rawScore is 0-11 from legacy, scale to 0-15
  const score = Math.round((rawScore / 11) * 15);
  const clamped = Math.max(0, Math.min(15, score));
  const label = clamped >= 10 ? "✓" : clamped <= 5 ? "✗" : "~";
  return { score: clamped, line: `${label} News sentiment (+${clamped}/15)`, hasNews: true };
}

// ─── Confidence Validator ───────────────────────────────────────────────────
function validateScore(
  score: number,
  trend: string,
  ema20: number,
  ema50: number,
  rsi: number,
  candles: Candle[]
): string[] {
  const warnings: string[] = [];
  if (ema20 == null || ema20 <= 0) warnings.push("EMA20 is null or zero");
  if (ema50 == null || ema50 <= 0) warnings.push("EMA50 is null or zero");
  if (ema20 > 0 && ema50 > 0 && Math.abs(ema20 - ema50) / ema50 > 0.5)
    warnings.push("EMA20 and EMA50 >50% apart — likely wrong data");
  if (rsi < 0 || rsi > 100) warnings.push("RSI out of range: " + rsi);
  if (score < 0 || score > 100) warnings.push("Score out of range: " + score);
  if (candles.length < 55) warnings.push("Only " + candles.length + " candles — EMAs may be unreliable");
  const price = candles[candles.length - 1]?.close;
  if (price && trend === "bullish" && price < ema50) warnings.push("Bullish but price below EMA50");
  if (price && trend === "bearish" && price > ema50) warnings.push("Bearish but price above EMA50");
  return warnings;
}

// ─── Composite ──────────────────────────────────────────────────────────────

export function calcTrendScore(
  candles: Candle[],
  newsScore?: number | null,
  _socialScore?: number | null,
  timeframe?: string
): EnhancedScoreResult {
  const sorted = [...candles].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );

  const closes = sorted.map((c) => c.close);
  const highs = sorted.map((c) => c.high);
  const lows = sorted.map((c) => c.low);

  const tf = timeframe || "1h";

  // EMA periods: 9/21/50 for all timeframes, + 200 for 4h/1day
  const emaFastArr = calcEMA(closes, 9);
  const emaMidArr = calcEMA(closes, 21);
  const emaSlowArr = calcEMA(closes, 50);
  const ema200Arr = calcEMA(closes, 200);
  const rsiArr = calcRSI(closes, 14);

  // Still compute ADX and MACD for display only
  const adxArr = calcADX(highs, lows, closes, 14);
  const { histogram } = calcMACD(closes, 12, 26, 9);

  const price = closes[closes.length - 1];
  const emaFast = getLatestValue(emaFastArr);
  const emaMid = getLatestValue(emaMidArr);
  const emaSlow = getLatestValue(emaSlowArr);
  const ema200Val = getLatestValue(ema200Arr);
  const rsi = getLatestValue(rsiArr);
  const adx = getLatestValue(adxArr);
  const macdHist = getLatestValue(histogram);

  let macdHistPrev = NaN;
  for (let i = histogram.length - 2; i >= 0; i--) {
    if (!isNaN(histogram[i])) { macdHistPrev = histogram[i]; break; }
  }

  const isLongTF = tf === "4h" || tf === "1day";
  const ema200ForScore = isLongTF ? ema200Val : null;

  // Score components
  const ema = !isNaN(emaFast) && !isNaN(emaMid) && !isNaN(emaSlow)
    ? scoreEMA(price, emaFast, emaMid, emaSlow, ema200ForScore, tf, emaFastArr, emaMidArr, emaSlowArr)
    : { score: 22, line: "~ EMA: insufficient data (+22/55)" };

  const rsiR = !isNaN(rsi)
    ? scoreRSI(rsi, rsiArr)
    : { score: 15, line: "— RSI: insufficient data (+15/30)" };

  const newsR = scaleNewsScore(newsScore);

  // Composite: EMA(0-55) + RSI(0-30) + News(0-15) = 0-100
  const rawScore = Math.max(0, Math.min(100, ema.score + rsiR.score + newsR.score));

  const trend: "bullish" | "neutral" | "bearish" =
    rawScore >= 62 ? "bullish" : rawScore <= 38 ? "bearish" : "neutral";

  const dataQuality: "full" | "technical-only" = newsR.hasNews ? "full" : "technical-only";

  // Validate
  const confidenceFlags = validateScore(
    rawScore, trend,
    isNaN(emaFast) ? 0 : emaFast,
    isNaN(emaMid) ? 0 : emaMid,
    isNaN(rsi) ? 50 : rsi,
    sorted
  );
  if (confidenceFlags.length > 0) {
    console.warn("Score warnings:", confidenceFlags);
  }

  const explanationLines = [
    `EMA Alignment: ${ema.score}/55`,
    `  ${ema.line}`,
    `RSI Bias: ${rsiR.score}/30`,
    `  ${rsiR.line}`,
    `News Sentiment: ${newsR.score}/15`,
    `  ${newsR.line}`,
    `Score quality: ${dataQuality === "full" ? "Full score ✓" : "Technical only"}`,
    ...(confidenceFlags.length > 0 ? [`⚠ ${confidenceFlags.length} warning(s)`] : []),
  ];

  return {
    score: rawScore,
    trend,
    breakdown: {
      emaScore: ema.score,
      rsiScore: rsiR.score,
      newsScore: newsR.score,
      adxScore: 0,
      macdScore: 0,
      technicalTotal: ema.score + rsiR.score,
      fundamentalTotal: newsR.score,
      eventRiskScore: 0,
      stocktwitsScore: 0,
      redditScore: 0,
      socialTotal: 0,
    },
    ema20: isNaN(emaFast) ? 0 : emaFast,
    ema50: isNaN(emaMid) ? 0 : emaMid,
    ema200: isNaN(ema200Val) ? 0 : ema200Val,
    adx: isNaN(adx) ? 0 : adx,
    rsi: isNaN(rsi) ? 50 : rsi,
    macdHist: isNaN(macdHist) ? 0 : macdHist,
    macdHistPrev: isNaN(macdHistPrev) ? 0 : macdHistPrev,
    eventRiskFlag: false,
    upcomingEvent: null,
    upcomingEventTime: null,
    scoreBeforeEventRisk: rawScore,
    dataQuality,
    lastNewsUpdate: null,
    lastSocialUpdate: null,
    emaScore: ema.score,
    adxScore: 0,
    rsiScore: rsiR.score,
    macdScore: 0,
    newsScore: newsScore ?? null,
    socialScore: null,
    explanationLines,
    confidenceFlags,
  };
}

// ─── Score & Upsert ─────────────────────────────────────────────────────────

export async function scorePair(
  pairId: string,
  candles: Candle[],
  timeframe: string,
  newsScore?: number | null,
  _socialScore?: number | null
): Promise<EnhancedScoreResult> {
  const result = calcTrendScore(candles, newsScore, null, timeframe);

  const { error } = await supabase.from("scores").upsert(
    {
      pair_id: pairId,
      timeframe,
      score: result.score,
      trend: result.trend,
      ema_score: result.emaScore,
      adx_score: 0,
      rsi_score: result.rsiScore,
      macd_score: 0,
      news_score: result.newsScore,
      social_score: null,
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

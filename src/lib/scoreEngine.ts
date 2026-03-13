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

export interface ScoreResult {
  score: number;
  trend: "bullish" | "neutral" | "bearish";
  emaScore: number;
  adxScore: number;
  rsiScore: number;
  macdScore: number;
  ema20: number;
  ema50: number;
  ema200: number;
  adx: number;
  rsi: number;
  macdHist: number;
  macdHistPrev: number;
}

// ─── EMA Alignment (0–40) ───────────────────────────────────────────────────

function scoreEMA(
  price: number,
  ema20: number,
  ema50: number,
  ema200: number
): number {
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) return 40;
  if (price > ema20 && ema20 > ema50) return 27;
  if (price > ema20) return 13;
  if (price < ema20 && ema20 < ema50 && ema50 < ema200) return 0;
  return 20; // mixed / choppy
}

// ─── ADX Strength (0–20) ────────────────────────────────────────────────────

function scoreADX(adx: number): number {
  if (adx >= 40) return 20;
  if (adx >= 25) return 15;
  if (adx >= 15) return 8;
  return 3;
}

// ─── RSI Bias (0–20) ────────────────────────────────────────────────────────

function scoreRSI(rsi: number): number {
  const raw = ((rsi - 50) / 50) * 20;
  return Math.max(0, Math.min(20, raw));
}

// ─── MACD Momentum (0–20) ───────────────────────────────────────────────────

function scoreMACD(hist: number, histPrev: number): number {
  const increasing = hist > histPrev;
  if (hist > 0 && increasing) return 20;
  if (hist > 0 && !increasing) return 13;
  if (hist <= 0 && increasing) return 7;
  return 0; // negative and decreasing
}

// ─── Composite ──────────────────────────────────────────────────────────────

export function calcTrendScore(candles: Candle[]): ScoreResult {
  // Sort ascending by timestamp
  const sorted = [...candles].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );

  const closes = sorted.map((c) => c.close);
  const highs = sorted.map((c) => c.high);
  const lows = sorted.map((c) => c.low);

  if (closes.length < 200) {
    // Need at least 200 candles for EMA200; compute what we can
  }

  const ema20Arr = calcEMA(closes, 20);
  const ema50Arr = calcEMA(closes, 50);
  const ema200Arr = calcEMA(closes, 200);
  const rsiArr = calcRSI(closes, 14);
  const adxArr = calcADX(highs, lows, closes, 14);
  const { histogram } = calcMACD(closes, 12, 26, 9);

  const price = closes[closes.length - 1];
  const ema20 = getLatestValue(ema20Arr);
  const ema50 = getLatestValue(ema50Arr);
  const ema200 = getLatestValue(ema200Arr);
  const rsi = getLatestValue(rsiArr);
  const adx = getLatestValue(adxArr);
  const macdHist = getLatestValue(histogram);

  // Get previous histogram value
  let macdHistPrev = NaN;
  for (let i = histogram.length - 2; i >= 0; i--) {
    if (!isNaN(histogram[i])) {
      macdHistPrev = histogram[i];
      break;
    }
  }

  // Compute sub-scores (use safe defaults if indicators lack data)
  const emaScore = !isNaN(ema20) && !isNaN(ema50) && !isNaN(ema200)
    ? scoreEMA(price, ema20, ema50, ema200)
    : 20; // neutral if insufficient data

  const adxScore = !isNaN(adx) ? scoreADX(adx) : 3;
  const rsiScore = !isNaN(rsi) ? scoreRSI(rsi) : 10;
  const macdScore =
    !isNaN(macdHist) && !isNaN(macdHistPrev)
      ? scoreMACD(macdHist, macdHistPrev)
      : 10;

  const score = Math.round(
    Math.max(0, Math.min(100, emaScore + adxScore + rsiScore + macdScore))
  );

  const trend: "bullish" | "neutral" | "bearish" =
    score >= 65 ? "bullish" : score <= 35 ? "bearish" : "neutral";

  return {
    score,
    trend,
    emaScore,
    adxScore,
    rsiScore,
    macdScore,
    ema20: isNaN(ema20) ? 0 : ema20,
    ema50: isNaN(ema50) ? 0 : ema50,
    ema200: isNaN(ema200) ? 0 : ema200,
    adx: isNaN(adx) ? 0 : adx,
    rsi: isNaN(rsi) ? 50 : rsi,
    macdHist: isNaN(macdHist) ? 0 : macdHist,
    macdHistPrev: isNaN(macdHistPrev) ? 0 : macdHistPrev,
  };
}

// ─── Score & Upsert ─────────────────────────────────────────────────────────

export async function scorePair(
  pairId: string,
  candles: Candle[],
  timeframe: string
): Promise<ScoreResult> {
  const result = calcTrendScore(candles);

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

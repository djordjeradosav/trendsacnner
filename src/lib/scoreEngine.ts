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
  newsScore: number | null;
  socialScore: number | null;
  ema20: number;
  ema50: number;
  ema200: number;
  adx: number;
  rsi: number;
  macdHist: number;
  macdHistPrev: number;
}

// ─── EMA Alignment (0–35) ───────────────────────────────────────────────────

function scoreEMA(
  price: number,
  ema20: number,
  ema50: number,
  ema200: number
): number {
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) return 35;
  if (price > ema20 && ema20 > ema50) return 24;
  if (price > ema20) return 11;
  if (price < ema20 && ema20 < ema50 && ema50 < ema200) return 0;
  return 17; // mixed / choppy
}

// ─── ADX Strength (0–18) ────────────────────────────────────────────────────

function scoreADX(adx: number): number {
  if (adx >= 40) return 18;
  if (adx >= 25) return 13;
  if (adx >= 15) return 7;
  return 3;
}

// ─── RSI Bias (0–18) ────────────────────────────────────────────────────────

function scoreRSI(rsi: number): number {
  const raw = ((rsi - 50) / 50) * 18;
  return Math.max(0, Math.min(18, raw));
}

// ─── MACD Momentum (0–18) ───────────────────────────────────────────────────

function scoreMACD(hist: number, histPrev: number): number {
  const increasing = hist > histPrev;
  if (hist > 0 && increasing) return 18;
  if (hist > 0 && !increasing) return 12;
  if (hist <= 0 && increasing) return 6;
  return 0; // negative and decreasing
}

// ─── Composite ──────────────────────────────────────────────────────────────

export function calcTrendScore(candles: Candle[], newsScore?: number | null, socialScore?: number | null): ScoreResult {
  const sorted = [...candles].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );

  const closes = sorted.map((c) => c.close);
  const highs = sorted.map((c) => c.high);
  const lows = sorted.map((c) => c.low);

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

  let macdHistPrev = NaN;
  for (let i = histogram.length - 2; i >= 0; i--) {
    if (!isNaN(histogram[i])) {
      macdHistPrev = histogram[i];
      break;
    }
  }

  const emaScore = !isNaN(ema20) && !isNaN(ema50) && !isNaN(ema200)
    ? scoreEMA(price, ema20, ema50, ema200)
    : 17;

  const adxScore = !isNaN(adx) ? scoreADX(adx) : 3;
  const rsiScore = !isNaN(rsi) ? scoreRSI(rsi) : 9;
  const macdScore =
    !isNaN(macdHist) && !isNaN(macdHistPrev)
      ? scoreMACD(macdHist, macdHistPrev)
      : 9;

  // Sentiment score: blend news (0-11) and social (0-11)
  // If both available: news * 0.5 + social * 0.5, scaled to 0-11
  // If only one: use it directly
  const effectiveNewsScore = newsScore != null ? newsScore : 6;
  const effectiveSocialScore = socialScore != null ? socialScore : null;
  
  let sentimentScore: number;
  if (effectiveSocialScore != null) {
    sentimentScore = Math.round(effectiveNewsScore * 0.5 + effectiveSocialScore * 0.5);
  } else {
    sentimentScore = effectiveNewsScore;
  }

  const score = Math.round(
    Math.max(0, Math.min(100, emaScore + adxScore + rsiScore + macdScore + sentimentScore))
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
    newsScore: newsScore ?? null,
    socialScore: socialScore ?? null,
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
  timeframe: string,
  newsScore?: number | null
): Promise<ScoreResult> {
  const result = calcTrendScore(candles, newsScore);

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

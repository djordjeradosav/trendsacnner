import {
  calcEMA,
  calcRSI,
  calcMACD,
  calcADX,
  getLatestValue,
} from "./indicators";
import { supabase } from "@/integrations/supabase/client";
import { getTimeframeConfig, type TimeframeConfig } from "@/config/timeframes";

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
  emaScore: number;
  adxScore: number;
  rsiScore: number;
  macdScore: number;
  technicalTotal: number;
  newsScore: number;
  eventRiskScore: number;
  fundamentalTotal: number;
  stocktwitsScore: number;
  redditScore: number;
  socialTotal: number;
}

export interface EnhancedScoreResult {
  score: number;
  trend: "bullish" | "neutral" | "bearish";
  breakdown: ScoreBreakdown;
  ema20: number;
  ema50: number;
  ema200: number;
  adx: number;
  rsi: number;
  macdHist: number;
  macdHistPrev: number;
  eventRiskFlag: boolean;
  upcomingEvent: string | null;
  upcomingEventTime: string | null;
  scoreBeforeEventRisk: number;
  dataQuality: "full" | "no-social" | "no-news" | "technical-only";
  lastNewsUpdate: string | null;
  lastSocialUpdate: string | null;
  emaScore: number;
  adxScore: number;
  rsiScore: number;
  macdScore: number;
  newsScore: number | null;
  socialScore: number | null;
  explanationLines: string[];
}

export type ScoreResult = EnhancedScoreResult;

// ─── EMA Alignment (0–22) ───────────────────────────────────────────────────
function scoreEMA(price: number, emaFast: number, emaMid: number, emaSlow: number, hasSlowEMA: boolean): { score: number; line: string } {
  if (hasSlowEMA) {
    if (price > emaFast && emaFast > emaMid && emaMid > emaSlow)
      return { score: 22, line: `✓ EMA Stack: Price > Fast > Mid > Slow (+22)` };
    if (price > emaFast && emaFast > emaMid)
      return { score: 15, line: `~ EMA: Price > Fast > Mid (+15)` };
    if (price > emaFast)
      return { score: 8, line: `~ EMA: Price above Fast EMA only (+8)` };
    if (price < emaFast && emaFast < emaMid && emaMid < emaSlow)
      return { score: 0, line: `✗ EMA Stack: Full bearish alignment (+0)` };
    return { score: 11, line: `~ EMA: Mixed/choppy (+11)` };
  } else {
    // Shorter TFs without EMA200: use 3-EMA stack with adjusted scoring
    if (price > emaFast && emaFast > emaMid && emaMid > emaSlow)
      return { score: 20, line: `✓ EMA Stack (short): Full bullish (+20)` };
    if (price > emaFast && emaFast > emaMid)
      return { score: 14, line: `~ EMA: Price > Fast > Mid (+14)` };
    if (price > emaFast)
      return { score: 8, line: `~ EMA: Price above Fast only (+8)` };
    if (price < emaFast && emaFast < emaMid && emaMid < emaSlow)
      return { score: 2, line: `✗ EMA Stack (short): Full bearish (+2)` };
    return { score: 11, line: `~ EMA: Mixed (+11)` };
  }
}

// ─── ADX Strength (0–11) ────────────────────────────────────────────────────
function scoreADX(adx: number): { score: number; line: string } {
  if (adx >= 40) return { score: 11, line: `✓ ADX ${adx.toFixed(0)} — very strong trend (+11)` };
  if (adx >= 25) return { score: 8, line: `✓ ADX ${adx.toFixed(0)} — strong trend (+8)` };
  if (adx >= 15) return { score: 4, line: `~ ADX ${adx.toFixed(0)} — weak trend (+4)` };
  return { score: 2, line: `✗ ADX ${adx.toFixed(0)} — no trend (+2)` };
}

// ─── RSI Bias (0–11) ────────────────────────────────────────────────────────
function scoreRSI(rsi: number): { score: number; line: string } {
  const raw = ((rsi - 50) / 50) * 11;
  const score = Math.max(0, Math.min(11, Math.round(raw)));
  const label = rsi > 60 ? "✓" : rsi < 40 ? "✗" : "~";
  return { score, line: `${label} RSI ${rsi.toFixed(0)} — ${rsi > 60 ? "bullish" : rsi < 40 ? "bearish" : "neutral"} bias (+${score}/11)` };
}

// ─── MACD Momentum (0–11) ───────────────────────────────────────────────────
function scoreMACD(hist: number, histPrev: number): { score: number; line: string } {
  const increasing = hist > histPrev;
  let score: number;
  let desc: string;
  if (hist > 0 && increasing) { score = 11; desc = "positive & rising"; }
  else if (hist > 0 && !increasing) { score = 7; desc = "positive but weakening"; }
  else if (hist <= 0 && increasing) { score = 4; desc = "negative but improving"; }
  else { score = 0; desc = "negative & falling"; }
  const label = score >= 7 ? "✓" : score >= 4 ? "~" : "✗";
  return { score, line: `${label} MACD histogram ${desc} (+${score}/11)` };
}

// ─── News Score (0–13) ──────────────────────────────────────────────────────
function scaleNewsScore(rawScore: number | null | undefined): { score: number; line: string } {
  if (rawScore == null) return { score: 7, line: "— News: no data available (+7/13 default)" };
  const score = Math.round((rawScore / 11) * 13);
  const label = score >= 9 ? "✓" : score <= 4 ? "✗" : "~";
  return { score: Math.max(0, Math.min(13, score)), line: `${label} News sentiment (+${score}/13)` };
}

// ─── Event Risk (0–12) ─────────────────────────────────────────────────────
interface EventRiskInfo {
  score: number;
  flag: boolean;
  eventName: string | null;
  eventTime: string | null;
  multiplier: number;
  line: string;
}

async function calcEventRisk(currency: string): Promise<EventRiskInfo> {
  const now = new Date();
  const fourHoursFromNow = new Date(now.getTime() + 4 * 3600 * 1000);

  const { data: events } = await supabase
    .from("economic_events")
    .select("event_name, scheduled_at, impact")
    .eq("impact", "high")
    .eq("currency", currency)
    .is("actual", null)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", fourHoursFromNow.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1);

  if (!events || events.length === 0) {
    return { score: 12, flag: false, eventName: null, eventTime: null, multiplier: 1.0, line: "✓ No upcoming high-impact events (+12/12)" };
  }

  const evt = events[0];
  const hoursAway = (new Date(evt.scheduled_at).getTime() - now.getTime()) / 3600000;

  let multiplier: number;
  let penalty: number;
  if (hoursAway < 1) { multiplier = 0.6; penalty = 12; }
  else if (hoursAway < 2) { multiplier = 0.7; penalty = 9; }
  else { multiplier = 0.8; penalty = 6; }

  const score = 12 - penalty;
  return {
    score: Math.max(0, score),
    flag: hoursAway < 1,
    eventName: evt.event_name,
    eventTime: evt.scheduled_at,
    multiplier,
    line: `⚠ ${evt.event_name} in ${hoursAway.toFixed(1)}h — uncertainty penalty (-${penalty})`,
  };
}

// ─── Social Scores (0–10 each) ──────────────────────────────────────────────
function scaleSocialScore(rawScore: number | null | undefined, source: string): { score: number; line: string } {
  if (rawScore == null) return { score: 5, line: `— ${source}: no data available (+5/10 default)` };
  const score = Math.round((rawScore / 11) * 10);
  const label = score >= 7 ? "✓" : score <= 3 ? "✗" : "~";
  return { score: Math.max(0, Math.min(10, score)), line: `${label} ${source} sentiment (+${score}/10)` };
}

// ─── Composite (now accepts timeframe config) ───────────────────────────────

export function calcTrendScore(
  candles: Candle[],
  newsScore?: number | null,
  socialScore?: number | null,
  tfConfig?: TimeframeConfig
): EnhancedScoreResult {
  const config = tfConfig ?? getTimeframeConfig("1h");
  const sorted = [...candles].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );

  const closes = sorted.map((c) => c.close);
  const highs = sorted.map((c) => c.high);
  const lows = sorted.map((c) => c.low);

  const emaFastArr = calcEMA(closes, config.emaFast);
  const emaMidArr = calcEMA(closes, config.emaMid);
  const emaSlowArr = calcEMA(closes, config.emaSlow);
  const rsiArr = calcRSI(closes, config.rsiPeriod);
  const adxArr = calcADX(highs, lows, closes, config.adxPeriod);
  const { histogram } = calcMACD(closes, config.macdFast, config.macdSlow, config.macdSignal);

  const price = closes[closes.length - 1];
  const emaFastVal = getLatestValue(emaFastArr);
  const emaMidVal = getLatestValue(emaMidArr);
  const emaSlowVal = getLatestValue(emaSlowArr);
  const rsi = getLatestValue(rsiArr);
  const adx = getLatestValue(adxArr);
  const macdHist = getLatestValue(histogram);

  let macdHistPrev = NaN;
  for (let i = histogram.length - 2; i >= 0; i--) {
    if (!isNaN(histogram[i])) { macdHistPrev = histogram[i]; break; }
  }

  const hasSlowEMA = config.emaSlow >= 100;
  const ema = !isNaN(emaFastVal) && !isNaN(emaMidVal) && !isNaN(emaSlowVal)
    ? scoreEMA(price, emaFastVal, emaMidVal, emaSlowVal, hasSlowEMA)
    : { score: 11, line: "~ EMA: insufficient data (+11)" };
  const adxR = !isNaN(adx) ? scoreADX(adx) : { score: 2, line: "— ADX: insufficient data (+2)" };
  const rsiR = !isNaN(rsi) ? scoreRSI(rsi) : { score: 6, line: "— RSI: insufficient data (+6)" };
  const macdR = !isNaN(macdHist) && !isNaN(macdHistPrev) ? scoreMACD(macdHist, macdHistPrev) : { score: 6, line: "— MACD: insufficient data (+6)" };

  const technicalTotal = ema.score + adxR.score + rsiR.score + macdR.score;

  const newsR = scaleNewsScore(newsScore);
  const eventRiskScore = 12;
  const fundamentalTotal = newsR.score + eventRiskScore;

  const stocktwitsR = scaleSocialScore(socialScore, "StockTwits");
  const redditR = scaleSocialScore(socialScore != null ? Math.max(0, socialScore - 1) : null, "Reddit/Social");
  const socialTotal = stocktwitsR.score + redditR.score;

  const rawScore = Math.round(Math.max(0, Math.min(100, technicalTotal + fundamentalTotal + socialTotal)));

  let dataQuality: "full" | "no-social" | "no-news" | "technical-only" = "full";
  if (newsScore == null && socialScore == null) dataQuality = "technical-only";
  else if (socialScore == null) dataQuality = "no-social";
  else if (newsScore == null) dataQuality = "no-news";

  const trend: "bullish" | "neutral" | "bearish" =
    rawScore >= 65 ? "bullish" : rawScore <= 35 ? "bearish" : "neutral";

  const explanationLines = [
    `Technical signals: ${technicalTotal}/55`,
    `  ${ema.line}`,
    `  ${adxR.line}`,
    `  ${rsiR.line}`,
    `  ${macdR.line}`,
    `Fundamental signals: ${fundamentalTotal}/25`,
    `  ${newsR.line}`,
    `  ✓ No upcoming event risk (+12/12)`,
    `Social signals: ${socialTotal}/20`,
    `  ${stocktwitsR.line}`,
    `  ${redditR.line}`,
    `Score quality: ${dataQuality === "full" ? "Full data ✓" : dataQuality === "no-social" ? "Missing social data" : dataQuality === "no-news" ? "Missing news data" : "Technical only"}`,
  ];

  return {
    score: rawScore,
    trend,
    breakdown: {
      emaScore: ema.score,
      adxScore: adxR.score,
      rsiScore: rsiR.score,
      macdScore: macdR.score,
      technicalTotal,
      newsScore: newsR.score,
      eventRiskScore,
      fundamentalTotal,
      stocktwitsScore: stocktwitsR.score,
      redditScore: redditR.score,
      socialTotal,
    },
    ema20: isNaN(emaFastVal) ? 0 : emaFastVal,
    ema50: isNaN(emaMidVal) ? 0 : emaMidVal,
    ema200: isNaN(emaSlowVal) ? 0 : emaSlowVal,
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
    adxScore: adxR.score,
    rsiScore: rsiR.score,
    macdScore: macdR.score,
    newsScore: newsScore ?? null,
    socialScore: socialScore ?? null,
    explanationLines,
  };
}

// ─── Enhanced Score with Event Risk (async) ─────────────────────────────────

export async function calcEnhancedScore(
  candles: Candle[],
  currency: string,
  newsScore?: number | null,
  socialScore?: number | null,
  tfConfig?: TimeframeConfig
): Promise<EnhancedScoreResult> {
  const base = calcTrendScore(candles, newsScore, socialScore, tfConfig);

  const eventRisk = await calcEventRisk(currency);

  const newsR = scaleNewsScore(newsScore);
  const fundamentalTotal = newsR.score + eventRisk.score;
  const socialTotal = base.breakdown.socialTotal;
  const technicalTotal = base.breakdown.technicalTotal;

  let rawScore = Math.round(Math.max(0, Math.min(100, technicalTotal + fundamentalTotal + socialTotal)));
  const scoreBeforeEventRisk = rawScore;

  if (eventRisk.multiplier < 1.0) {
    rawScore = Math.round(rawScore * eventRisk.multiplier);
  }

  const trend: "bullish" | "neutral" | "bearish" =
    rawScore >= 65 ? "bullish" : rawScore <= 35 ? "bearish" : "neutral";

  const explanationLines = [
    ...base.explanationLines.slice(0, 5),
    `Fundamental signals: ${fundamentalTotal}/25`,
    `  ${base.explanationLines[6]?.replace(/  /, "")}`,
    `  ${eventRisk.line}`,
    ...base.explanationLines.slice(8),
  ];

  if (eventRisk.multiplier < 1.0) {
    explanationLines.push(`⚡ Event risk multiplier: ${eventRisk.multiplier}x applied`);
  }

  return {
    ...base,
    score: rawScore,
    trend,
    scoreBeforeEventRisk,
    eventRiskFlag: eventRisk.flag,
    upcomingEvent: eventRisk.eventName,
    upcomingEventTime: eventRisk.eventTime,
    breakdown: {
      ...base.breakdown,
      eventRiskScore: eventRisk.score,
      fundamentalTotal,
    },
    explanationLines,
  };
}

// ─── Score & Upsert ─────────────────────────────────────────────────────────

export async function scorePair(
  pairId: string,
  candles: Candle[],
  timeframe: string,
  newsScore?: number | null,
  socialScore?: number | null
): Promise<EnhancedScoreResult> {
  const tfConfig = getTimeframeConfig(timeframe);
  const result = calcTrendScore(candles, newsScore, socialScore, tfConfig);

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

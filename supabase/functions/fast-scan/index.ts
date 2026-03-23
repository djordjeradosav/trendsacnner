import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Indicator Math (self-contained, no imports from src/) ──────────────────

function calcEMA(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  result[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

function calcRSI(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change; else avgLoss += Math.abs(change);
  }
  avgGain /= period; avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function calcMACD(closes: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const len = closes.length;
  const macdLine: number[] = new Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i])) macdLine[i] = emaFast[i] - emaSlow[i];
  }
  const validMacd = macdLine.filter((v) => !isNaN(v));
  const signalLine = calcEMA(validMacd, signalPeriod);
  const histogram: number[] = new Array(len).fill(NaN);
  let si = 0;
  for (let i = 0; i < len; i++) {
    if (!isNaN(macdLine[i])) {
      if (!isNaN(signalLine[si])) histogram[i] = macdLine[i] - signalLine[si];
      si++;
    }
  }
  return { histogram };
}

function calcTrueRange(highs: number[], lows: number[], closes: number[]): number[] {
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < highs.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  return tr;
}

function calcADX(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const len = highs.length;
  const result: number[] = new Array(len).fill(NaN);
  if (len < period * 2) return result;
  const plusDM: number[] = [0], minusDM: number[] = [0];
  for (let i = 1; i < len; i++) {
    const up = highs[i] - highs[i - 1], down = lows[i - 1] - lows[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  const tr = calcTrueRange(highs, lows, closes);
  const sTR: number[] = new Array(len).fill(NaN);
  const sPDM: number[] = new Array(len).fill(NaN);
  const sMDM: number[] = new Array(len).fill(NaN);
  let sumTR = 0, sumPDM = 0, sumMDM = 0;
  for (let i = 1; i <= period; i++) { sumTR += tr[i]; sumPDM += plusDM[i]; sumMDM += minusDM[i]; }
  sTR[period] = sumTR; sPDM[period] = sumPDM; sMDM[period] = sumMDM;
  for (let i = period + 1; i < len; i++) {
    sTR[i] = sTR[i-1] - sTR[i-1]/period + tr[i];
    sPDM[i] = sPDM[i-1] - sPDM[i-1]/period + plusDM[i];
    sMDM[i] = sMDM[i-1] - sMDM[i-1]/period + minusDM[i];
  }
  const dx: number[] = new Array(len).fill(NaN);
  for (let i = period; i < len; i++) {
    if (!isNaN(sTR[i]) && sTR[i] !== 0) {
      const pdi = (sPDM[i]/sTR[i])*100, mdi = (sMDM[i]/sTR[i])*100;
      const s = pdi + mdi;
      dx[i] = s === 0 ? 0 : (Math.abs(pdi - mdi)/s)*100;
    }
  }
  const adxStart = period * 2;
  if (adxStart >= len) return result;
  let adxSum = 0;
  for (let i = period; i < adxStart; i++) adxSum += isNaN(dx[i]) ? 0 : dx[i];
  result[adxStart - 1] = adxSum / period;
  for (let i = adxStart; i < len; i++) result[i] = (result[i-1]*(period-1) + (isNaN(dx[i]) ? 0 : dx[i]))/period;
  return result;
}

function latest(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) if (!isNaN(arr[i])) return arr[i];
  return NaN;
}

// ─── Score Engine ───────────────────────────────────────────────────────────

interface CandleData { open: number; high: number; low: number; close: number; volume?: number; }

function scoreEMA(price: number, e20: number, e50: number, e200: number, timeframe?: string): number {
  const isShortTF = timeframe === "15min";
  if (isShortTF) {
    if (price > e20 && e20 > e50 && e50 > e200) return 22;
    if (price < e20 && e20 < e50 && e50 < e200) return 0;
    if (price > e20 && e20 > e50) return 16;
    if (price > e20) return 10;
    if (price < e20 && e20 < e50) return 6;
    return 11;
  }
  if (price > e20 && e20 > e50 && e50 > e200) return 22;
  if (price > e20 && e20 > e50) return 15;
  if (price > e20) return 8;
  if (price < e20 && e20 < e50 && e50 < e200) return 0;
  return 11;
}

function scoreADX(adx: number): number {
  if (adx >= 40) return 11; if (adx >= 25) return 8; if (adx >= 15) return 4; return 2;
}

function scoreRSI(rsi: number): number {
  return Math.max(0, Math.min(11, Math.round(((rsi - 50) / 50) * 11)));
}

function scoreMACD(hist: number, histPrev: number): number {
  if (hist > 0 && hist > histPrev) return 11;
  if (hist > 0) return 7;
  if (hist <= 0 && hist > histPrev) return 4;
  return 0;
}

const TF_CONFIGS: Record<string, { emaFast: number; emaMid: number; emaSlow: number; rsiPeriod: number; adxPeriod: number; macdFast: number; macdSlow: number; macdSignal: number }> = {
  "15min": { emaFast: 9,  emaMid: 21, emaSlow: 50,  rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "1h":    { emaFast: 20, emaMid: 50, emaSlow: 200, rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "4h":    { emaFast: 20, emaMid: 50, emaSlow: 200, rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "1day":  { emaFast: 20, emaMid: 50, emaSlow: 200, rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
};

function getConfig(tf: string) {
  return TF_CONFIGS[tf] || TF_CONFIGS["1h"];
}

function calcTrendScore(candles: CandleData[], timeframe = "1h") {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  const cfg = getConfig(timeframe);

  const emaFastArr = calcEMA(closes, cfg.emaFast);
  const emaMidArr = calcEMA(closes, cfg.emaMid);
  const emaSlowArr = calcEMA(closes, cfg.emaSlow);
  const rsiVal = latest(calcRSI(closes, cfg.rsiPeriod));
  const adxVal = latest(calcADX(highs, lows, closes, cfg.adxPeriod));
  const { histogram } = calcMACD(closes, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
  const macdHist = latest(histogram);
  let macdHistPrev = NaN;
  for (let i = histogram.length - 2; i >= 0; i--) { if (!isNaN(histogram[i])) { macdHistPrev = histogram[i]; break; } }

  const price = closes[closes.length - 1];
  const emaFast = latest(emaFastArr);
  const emaMid = latest(emaMidArr);
  const emaSlow = latest(emaSlowArr);

  const emaS = !isNaN(emaFast) && !isNaN(emaMid) && !isNaN(emaSlow) ? scoreEMA(price, emaFast, emaMid, emaSlow, timeframe) : 11;
  const adxS = !isNaN(adxVal) ? scoreADX(adxVal) : 2;
  const rsiS = !isNaN(rsiVal) ? scoreRSI(rsiVal) : 6;
  const macdS = !isNaN(macdHist) && !isNaN(macdHistPrev) ? scoreMACD(macdHist, macdHistPrev) : 6;

  const technical = emaS + adxS + rsiS + macdS;
  const newsDefault = 7;
  const eventDefault = 12;
  const stocktwitsDefault = 5;
  const redditDefault = 5;

  const rawScore = Math.max(0, Math.min(100, technical + newsDefault + eventDefault + stocktwitsDefault + redditDefault));
  const trend = rawScore >= 65 ? "bullish" : rawScore <= 35 ? "bearish" : "neutral";

  return {
    score: rawScore, trend,
    emaScore: emaS, adxScore: adxS, rsiScore: rsiS, macdScore: macdS,
    ema20: isNaN(emaFast) ? 0 : emaFast,
    ema50: isNaN(emaMid) ? 0 : emaMid,
    ema200: isNaN(emaSlow) ? 0 : emaSlow,
    adx: isNaN(adxVal) ? 0 : adxVal,
    rsi: isNaN(rsiVal) ? 50 : rsiVal,
    macdHist: isNaN(macdHist) ? 0 : macdHist,
  };
}

// ─── Finnhub Symbol & Resolution Mapping ────────────────────────────────────

const SYMBOL_MAP: Record<string, string> = {
  "EURUSD": "OANDA:EUR_USD", "GBPUSD": "OANDA:GBP_USD", "USDJPY": "OANDA:USD_JPY",
  "USDCHF": "OANDA:USD_CHF", "AUDUSD": "OANDA:AUD_USD", "USDCAD": "OANDA:USD_CAD",
  "NZDUSD": "OANDA:NZD_USD", "EURGBP": "OANDA:EUR_GBP", "EURJPY": "OANDA:EUR_JPY",
  "GBPJPY": "OANDA:GBP_JPY", "AUDJPY": "OANDA:AUD_JPY", "CADJPY": "OANDA:CAD_JPY",
  "CHFJPY": "OANDA:CHF_JPY", "NZDJPY": "OANDA:NZD_JPY", "EURCAD": "OANDA:EUR_CAD",
  "EURAUD": "OANDA:EUR_AUD", "EURNZD": "OANDA:EUR_NZD", "EURCHF": "OANDA:EUR_CHF",
  "GBPCAD": "OANDA:GBP_CAD", "GBPAUD": "OANDA:GBP_AUD", "GBPNZD": "OANDA:GBP_NZD",
  "GBPCHF": "OANDA:GBP_CHF", "AUDCAD": "OANDA:AUD_CAD", "AUDNZD": "OANDA:AUD_NZD",
  "AUDCHF": "OANDA:AUD_CHF", "NZDCAD": "OANDA:NZD_CAD", "NZDCHF": "OANDA:NZD_CHF",
  "CADCHF": "OANDA:CAD_CHF",
  // Metals
  "XAUUSD": "OANDA:XAU_USD", "XAGUSD": "OANDA:XAG_USD",
  "XPTUSD": "OANDA:XPT_USD", "XPDUSD": "OANDA:XPD_USD",
  // Commodities & Futures — mapped from DB symbol names
  "USOIL":  "OANDA:WTICO_USD",  "CL1!":  "OANDA:WTICO_USD",
  "UKOIL":  "OANDA:BCO_USD",    "BZ1!":  "OANDA:BCO_USD",
  "NATGAS": "OANDA:NATGAS_USD", "NG1!":  "OANDA:NATGAS_USD",
  "US500":  "OANDA:SPX500_USD", "ES1!":  "OANDA:SPX500_USD",
  "US100":  "OANDA:NAS100_USD", "NQ1!":  "OANDA:NAS100_USD",
  "US30":   "OANDA:US30_USD",   "YM1!":  "OANDA:US30_USD",
};

const RESOLUTION_MAP: Record<string, string> = {
  "15min": "15",
  "1h": "60", "4h": "240", "1day": "D",
};

// Finnhub free tier only supports resolution "60" and above for forex candles.
// For sub-hourly timeframes, we fetch 1H candles and score with the requested
// timeframe's indicator config (shorter EMA periods etc).
const SUPPORTED_RESOLUTIONS = new Set(["60", "240", "D", "W"]);

function getEffectiveResolution(resolution: string): string {
  if (SUPPORTED_RESOLUTIONS.has(resolution)) return resolution;
  // Fallback: use 1H candles for sub-hourly timeframes
  return "60";
}

function getIntervalSeconds(tf: string): number {
  const map: Record<string, number> = {
    "15min": 900,
    "1h": 3600, "4h": 14400, "1day": 86400,
  };
  return map[tf] ?? 3600;
}

function getFinnhubSymbol(symbol: string): string | null {
  if (SYMBOL_MAP[symbol]) return SYMBOL_MAP[symbol];
  if (symbol.length === 6 && !symbol.includes("!")) {
    return `OANDA:${symbol.slice(0, 3)}_${symbol.slice(3)}`;
  }
  return null;
}

type FinnhubCandleResponse = {
  c?: number[]; h?: number[]; l?: number[]; o?: number[]; v?: number[]; t?: number[];
  s: string;
};

const CANDLE_LIMITS: Record<string, number> = {
  "15min": 250,
  "1h": 300, "4h": 300, "1day": 365,
};

const MINIMUM_CANDLES: Record<string, number> = {
  "15min": 55,
  "1h": 60, "4h": 60, "1day": 100,
};

function getCandleLimit(tf: string): number { return CANDLE_LIMITS[tf] || 200; }
function getMinimumCandles(tf: string): number { return MINIMUM_CANDLES[tf] || 50; }

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Main ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("FINNHUB_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "FINNHUB_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const VALID_TFS = ["15min", "1h", "4h", "1day"];
  let timeframe = "1h";
  let pairIds: string[] | undefined;

  if (req.method === "GET") {
    const url = new URL(req.url);
    const raw = (url.searchParams.get("timeframe") || "1h").toLowerCase().trim();
    timeframe = VALID_TFS.includes(raw) ? raw : "1h";
    const ids = url.searchParams.get("pairIds");
    if (ids) pairIds = ids.split(",");
  } else {
    try {
      const body = await req.json();
      const raw = (body.timeframe || "1h").toLowerCase().trim();
      timeframe = VALID_TFS.includes(raw) ? raw : "1h";
      pairIds = body.pairIds;
    } catch { /* use defaults */ }
  }

  console.log(`[SCAN] STARTING for timeframe: ${timeframe}`);

  // Load pairs
  let query = supabase.from("pairs").select("id, symbol, category, base_currency").eq("is_active", true);
  if (pairIds && pairIds.length > 0) {
    query = query.in("id", pairIds);
  }
  const { data: pairs, error: pairsError } = await query.order("symbol");
  if (pairsError || !pairs || pairs.length === 0) {
    return new Response(JSON.stringify({ error: "No pairs found" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const normalisedTimeframe = timeframe.toLowerCase().trim();
  const rawResolution = RESOLUTION_MAP[normalisedTimeframe] || "60";
  // Finnhub free tier: sub-hourly resolutions return 403 for forex.
  // Fall back to 1H candles and score with the requested timeframe's indicator config.
  const resolution = getEffectiveResolution(rawResolution);
  const usedFallback = resolution !== rawResolution;
  // When using fallback resolution, fetch candles based on the fallback (1H) timing
  const effectiveTF = usedFallback ? "1h" : normalisedTimeframe;
  const candleLimit = getCandleLimit(effectiveTF);
  const to = Math.floor(Date.now() / 1000);
  const intervalSec = getIntervalSeconds(effectiveTF);
  const bufferMultiplier = effectiveTF === "15min" ? 2.5 : 1.3;
  const from = to - Math.floor(candleLimit * intervalSec * bufferMultiplier);
  
  if (usedFallback) {
    console.log(`[SCAN] Finnhub free tier: resolution "${rawResolution}" not supported, falling back to "${resolution}" (1H candles) for scoring`);
  }
  console.log(`[SCAN] timeframe="${normalisedTimeframe}" resolution="${resolution}" candleLimit=${candleLimit} minCandles=${getMinimumCandles(normalisedTimeframe)} buffer=${bufferMultiplier} pairs=${pairs.length}`);

  // Finnhub allows 60 calls/min — use chunks of 55 with 1.1s delay
  const CHUNK_SIZE = 55;
  const chunks = chunkArray(pairs, CHUNK_SIZE);
  const total = pairs.length;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      const startMs = Date.now();
      let done = 0;
      let bullish = 0, bearish = 0, neutral = 0;
      const scoreRows: Array<Record<string, unknown>> = [];
      const candleRows: Array<Record<string, unknown>> = [];

      let rateLimited = false;

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];

        const results = await Promise.allSettled(
          chunk.map(async (pair) => {
            if (rateLimited) return null;

            const finnhubSymbol = getFinnhubSymbol(pair.symbol);
            if (!finnhubSymbol) {
              console.warn(`[SCAN] ${pair.symbol}: no Finnhub symbol mapping`);
              return null;
            }

            const abortCtl = new AbortController();
            const timeout = setTimeout(() => abortCtl.abort(), 8000);
            try {
              const url = `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(finnhubSymbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;
              const res = await fetch(url, { signal: abortCtl.signal });

              if (res.status === 429) {
                console.warn(`[SCAN] ${pair.symbol}: rate limited (429), waiting...`);
                rateLimited = true;
                return null;
              }
              if (res.status === 403) {
                console.warn(`[SCAN] ${pair.symbol}: forbidden (403) for resolution=${resolution}`);
                return null;
              }

              const data = (await res.json()) as FinnhubCandleResponse;
              if (data.s !== "ok" || !data.c?.length) {
                console.warn(`[SCAN] ${pair.symbol}: status="${data.s}" candles=0`);
                return null;
              }

              console.log(`[SCAN] ${pair.symbol}: ${data.c.length} candles fetched`);

              return {
                pairId: pair.id,
                symbol: pair.symbol,
                candles: data.c.map((close, i) => ({
                  open: data.o![i],
                  high: data.h![i],
                  low: data.l![i],
                  close,
                  volume: data.v?.[i] ?? 0,
                  ts: new Date(data.t![i] * 1000).toISOString(),
                })),
              };
            } catch {
              return null;
            } finally {
              clearTimeout(timeout);
            }
          })
        );

        // Process results — fall back to cached DB candles when API fails
        for (let ri = 0; ri < results.length; ri++) {
          done++;
          const r = results[ri];
          const pair = chunk[ri];
          let pairCandles: CandleData[] | null = null;
          const pairId = pair.id;
          const symbol = pair.symbol;
          const minCandles = getMinimumCandles(normalisedTimeframe);

          if (r.status === "fulfilled" && r.value && r.value.candles.length >= 20) {
            pairCandles = r.value.candles;
            if (r.value.candles.length < minCandles) {
              console.warn(`[SCAN] ${symbol}: only ${r.value.candles.length} candles (min=${minCandles}), scoring with partial data`);
            }
            // Store candles with the effective timeframe used for fetching
            for (const c of pairCandles) {
              candleRows.push({
                pair_id: pairId,
                timeframe: effectiveTF,
                open: c.open, high: c.high, low: c.low, close: c.close,
                volume: c.volume ?? 0,
                ts: (c as any).ts || new Date().toISOString(),
              });
            }
          } else if (r.status === "fulfilled" && r.value) {
            console.warn(`[SCAN] ${symbol}: fetched ${r.value.candles.length} candles, below minimum 20 — skipping`);
          }

          // Fallback: load cached candles from DB
          if (!pairCandles) {
            // Try the requested timeframe first, then fall back to 1h
            for (const dbTf of [normalisedTimeframe, "1h"]) {
              const { data: dbCandles } = await supabase
                .from("candles")
                .select("open, high, low, close, volume")
                .eq("pair_id", pairId)
                .eq("timeframe", dbTf)
                .order("ts", { ascending: true })
                .limit(candleLimit);

              if (dbCandles && dbCandles.length >= 20) {
                pairCandles = dbCandles.map((c: { open: number; high: number; low: number; close: number; volume: number | null }) => ({
                  open: Number(c.open), high: Number(c.high), low: Number(c.low),
                  close: Number(c.close), volume: c.volume ? Number(c.volume) : 0,
                }));
                if (dbTf !== normalisedTimeframe) {
                  console.log(`[SCAN] ${symbol}: using cached ${dbTf} candles as fallback`);
                }
                break;
              }
            }
          }

          if (pairCandles && pairCandles.length >= 20) {
            // Score with the REQUESTED timeframe's indicator config (shorter EMAs for 15min etc)
            const result = calcTrendScore(pairCandles, normalisedTimeframe);

            if (result.trend === "bullish") bullish++;
            else if (result.trend === "bearish") bearish++;
            else neutral++;

            scoreRows.push({
              pair_id: pairId, timeframe: normalisedTimeframe,
              score: result.score, trend: result.trend,
              ema_score: result.emaScore, adx_score: result.adxScore,
              rsi_score: result.rsiScore, macd_score: result.macdScore,
              ema20: result.ema20, ema50: result.ema50, ema200: result.ema200,
              adx: result.adx, rsi: result.rsi, macd_hist: result.macdHist,
              scanned_at: new Date().toISOString(),
            });

            send({ type: "progress", done, total, pct: Math.round((done/total)*100), symbol });
          } else {
            send({ type: "progress", done, total, pct: Math.round((done/total)*100), symbol });
          }
        }

        // Delay between chunks — only 1.1s needed for Finnhub's 60/min limit
        if (ci < chunks.length - 1) {
          await sleep(1100);
        }
      }

      // Bulk upsert candles in batches of 1000
      for (let i = 0; i < candleRows.length; i += 1000) {
        const batch = candleRows.slice(i, i + 1000);
        await supabase.from("candles").upsert(batch as any, { onConflict: "pair_id,timeframe,ts", ignoreDuplicates: false });
      }

      // Bulk upsert scores
      if (scoreRows.length > 0) {
        console.log(`[SCAN] Upserting ${scoreRows.length} scores with timeframe="${normalisedTimeframe}". Sample:`, JSON.stringify(scoreRows[0]));
        const { error: scoreError } = await supabase.from("scores").upsert(scoreRows as any, { onConflict: "pair_id,timeframe" });
        if (scoreError) console.error("Score upsert error:", scoreError);
        else console.log(`[SCAN] Successfully upserted ${scoreRows.length} scores`);
      } else {
        console.warn(`[SCAN] No scores to upsert for timeframe="${normalisedTimeframe}"`);
      }

      // Store scan history
      try {
        const authHeader = req.headers.get("authorization");
        if (authHeader) {
          const token = authHeader.replace("Bearer ", "");
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user) {
            await supabase.from("scan_history").insert({
              user_id: user.id,
              result: { totalPairs: done, bullish, bearish, neutral, avgScore: scoreRows.length > 0 ? Math.round(scoreRows.reduce((s, r) => s + (r.score as number), 0) / scoreRows.length * 10) / 10 : 0, duration: Math.round((Date.now() - startMs) / 1000) },
              scanned_at: new Date().toISOString(),
            });
          }
        }
      } catch (e) { console.warn("Failed to store scan history:", e); }

      send({
        type: "complete",
        total: done, bullish, bearish, neutral,
        scored: scoreRows.length,
        durationMs: Date.now() - startMs,
        avgScore: scoreRows.length > 0 ? Math.round(scoreRows.reduce((s, r) => s + (r.score as number), 0) / scoreRows.length * 10) / 10 : 0,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});

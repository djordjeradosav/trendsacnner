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
  const isShortTF = ["1min","3min","5min","15min","30min"].includes(timeframe || "");
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
  "1min":  { emaFast: 9,  emaMid: 21, emaSlow: 50,  rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "3min":  { emaFast: 9,  emaMid: 21, emaSlow: 50,  rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "5min":  { emaFast: 9,  emaMid: 21, emaSlow: 50,  rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "15min": { emaFast: 9,  emaMid: 21, emaSlow: 50,  rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "30min": { emaFast: 9,  emaMid: 21, emaSlow: 50,  rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "1h":    { emaFast: 20, emaMid: 50, emaSlow: 200, rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "4h":    { emaFast: 20, emaMid: 50, emaSlow: 200, rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "1day":  { emaFast: 20, emaMid: 50, emaSlow: 200, rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "1week": { emaFast: 20, emaMid: 50, emaSlow: 200, rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
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

// ─── Alpha Vantage Candle Fetch ─────────────────────────────────────────────

const AV_INTERVAL_MAP: Record<string, { fn: string; interval?: string }> = {
  "1min":  { fn: "FX_INTRADAY", interval: "1min" },
  "5min":  { fn: "FX_INTRADAY", interval: "5min" },
  "15min": { fn: "FX_INTRADAY", interval: "15min" },
  "30min": { fn: "FX_INTRADAY", interval: "30min" },
  "1h":    { fn: "FX_INTRADAY", interval: "60min" },
  "4h":    { fn: "FX_INTRADAY", interval: "60min" }, // aggregate 4x
  "1day":  { fn: "FX_DAILY" },
  "1week": { fn: "FX_WEEKLY" },
};

function getAVForexPair(symbol: string): { from: string; to: string } | null {
  const forexLike = [
    "EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD",
    "EURGBP","EURJPY","GBPJPY","AUDJPY","CADJPY","CHFJPY","NZDJPY",
    "EURCAD","EURAUD","EURNZD","EURCHF","GBPCAD","GBPAUD","GBPNZD",
    "GBPCHF","AUDCAD","AUDNZD","AUDCHF","NZDCAD","NZDCHF","CADCHF",
    "XAUUSD","XAGUSD","XPTUSD","XPDUSD",
  ];
  if (forexLike.includes(symbol) || (symbol.length === 6 && !symbol.includes("!"))) {
    return { from: symbol.slice(0, 3), to: symbol.slice(3) };
  }
  return null;
}

async function fetchAVCandles(
  from: string, to: string, timeframe: string, apiKey: string, outputsize = 300
): Promise<CandleData[] | null> {
  const avConfig = AV_INTERVAL_MAP[timeframe];
  if (!avConfig) return null;

  const params = new URLSearchParams({
    function: avConfig.fn,
    from_symbol: from,
    to_symbol: to,
    apikey: apiKey,
    outputsize: outputsize > 100 ? "full" : "compact",
  });
  if (avConfig.interval) params.set("interval", avConfig.interval);

  const url = `https://www.alphavantage.co/query?${params}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);

  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;
    const data = await res.json();

    if (data["Note"] || data["Information"] || data["Error Message"]) {
      console.warn(`AV limit/error: ${data["Note"] || data["Information"] || data["Error Message"]}`);
      return null;
    }

    const tsKey = Object.keys(data).find(k => k.startsWith("Time Series"));
    if (!tsKey) return null;

    const series = data[tsKey];
    const entries = Object.entries(series) as [string, Record<string, string>][];
    entries.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    const sliced = entries.slice(-outputsize);

    let candles: CandleData[] = sliced.map(([, vals]) => ({
      open: parseFloat(vals["1. open"]),
      high: parseFloat(vals["2. high"]),
      low: parseFloat(vals["3. low"]),
      close: parseFloat(vals["4. close"]),
    }));

    // Aggregate for 4h
    if (timeframe === "4h" && candles.length >= 4) {
      const agg: CandleData[] = [];
      for (let i = 0; i <= candles.length - 4; i += 4) {
        const chunk = candles.slice(i, i + 4);
        agg.push({
          open: chunk[0].open,
          high: Math.max(...chunk.map(c => c.high)),
          low: Math.min(...chunk.map(c => c.low)),
          close: chunk[3].close,
        });
      }
      candles = agg;
    }

    return candles;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Finnhub Fallback ───────────────────────────────────────────────────────

const FINNHUB_MAP: Record<string, string> = {
  "CL1!": "OANDA:WTICO_USD", "BZ1!": "OANDA:BCO_USD", "NG1!": "OANDA:NATGAS_USD",
  "ES1!": "OANDA:SPX500_USD", "NQ1!": "OANDA:NAS100_USD", "YM1!": "OANDA:US30_USD",
  "USOIL": "OANDA:WTICO_USD", "UKOIL": "OANDA:BCO_USD", "NATGAS": "OANDA:NATGAS_USD",
  "US500": "OANDA:SPX500_USD", "US100": "OANDA:NAS100_USD", "US30": "OANDA:US30_USD",
};

const FINNHUB_RES: Record<string, string> = {
  "1min": "1", "5min": "5", "15min": "15", "30min": "30",
  "1h": "60", "4h": "240", "1day": "D", "1week": "W",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const CANDLE_LIMITS: Record<string, number> = {
  "1min": 120, "5min": 150, "15min": 250, "30min": 250,
  "1h": 300, "4h": 300, "1day": 365, "1week": 200,
};

const MINIMUM_CANDLES: Record<string, number> = {
  "1min": 60, "5min": 80, "15min": 50, "30min": 50,
  "1h": 50, "4h": 30, "1day": 50, "1week": 20,
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

  const avKey = Deno.env.get("ALPHA_VANTAGE_KEY");
  const finnhubKey = Deno.env.get("FINNHUB_API_KEY");

  if (!avKey && !finnhubKey) {
    return new Response(JSON.stringify({ error: "No API keys configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let timeframe = "1h";
  let pairIds: string[] | undefined;

  if (req.method === "GET") {
    const url = new URL(req.url);
    timeframe = url.searchParams.get("timeframe") || "1h";
    const ids = url.searchParams.get("pairIds");
    if (ids) pairIds = ids.split(",");
  } else {
    try {
      const body = await req.json();
      timeframe = body.timeframe || "1h";
      pairIds = body.pairIds;
    } catch { /* use defaults */ }
  }

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

  const candleLimit = getCandleLimit(timeframe);
  const total = pairs.length;

  // Alpha Vantage: 5 requests/min → batch of 5 with 62s delay
  // Separate forex pairs (AV) from futures (Finnhub)
  const forexPairs = pairs.filter(p => !!getAVForexPair(p.symbol));
  const futuresPairs = pairs.filter(p => !getAVForexPair(p.symbol));

  const AV_BATCH = 4; // slightly under 5/min to be safe
  const AV_DELAY = 62_000; // 62 seconds between batches
  const forexChunks = chunkArray(forexPairs, AV_BATCH);
  const futuresChunks = chunkArray(futuresPairs, 10);

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
      let avRateLimited = false;

      // ── Phase 1: Forex/metals via Alpha Vantage ──
      for (let ci = 0; ci < forexChunks.length; ci++) {
        const chunk = forexChunks[ci];

        const results = await Promise.allSettled(
          chunk.map(async (pair) => {
            if (avRateLimited) return null;

            const avPair = getAVForexPair(pair.symbol);
            if (!avPair || !avKey) return null;

            const candles = await fetchAVCandles(avPair.from, avPair.to, timeframe, avKey, candleLimit);
            if (!candles) {
              // Check if rate limited
              return null;
            }
            return { pairId: pair.id, symbol: pair.symbol, candles };
          })
        );

        for (let ri = 0; ri < results.length; ri++) {
          done++;
          const r = results[ri];
          const pair = chunk[ri];
          let pairCandles: CandleData[] | null = null;

          if (r.status === "fulfilled" && r.value && r.value.candles.length >= getMinimumCandles(timeframe)) {
            pairCandles = r.value.candles;
          }

          // Fallback: load cached candles from DB
          if (!pairCandles) {
            const { data: dbCandles } = await supabase
              .from("candles")
              .select("open, high, low, close, volume")
              .eq("pair_id", pair.id)
              .eq("timeframe", timeframe)
              .order("ts", { ascending: true })
              .limit(candleLimit);

            if (dbCandles && dbCandles.length >= getMinimumCandles(timeframe)) {
              pairCandles = dbCandles.map((c: { open: number; high: number; low: number; close: number; volume: number | null }) => ({
                open: Number(c.open), high: Number(c.high), low: Number(c.low),
                close: Number(c.close), volume: c.volume ? Number(c.volume) : 0,
              }));
            }
          }

          if (pairCandles && pairCandles.length >= getMinimumCandles(timeframe)) {
            const result = calcTrendScore(pairCandles, timeframe);

            if (result.trend === "bullish") bullish++;
            else if (result.trend === "bearish") bearish++;
            else neutral++;

            scoreRows.push({
              pair_id: pair.id, timeframe,
              score: result.score, trend: result.trend,
              ema_score: result.emaScore, adx_score: result.adxScore,
              rsi_score: result.rsiScore, macd_score: result.macdScore,
              ema20: result.ema20, ema50: result.ema50, ema200: result.ema200,
              adx: result.adx, rsi: result.rsi, macd_hist: result.macdHist,
              scanned_at: new Date().toISOString(),
            });
          }

          send({ type: "progress", done, total, pct: Math.round((done / total) * 100), symbol: pair.symbol });
        }

        // Rate limit delay between AV batches (skip after last)
        if (ci < forexChunks.length - 1 && !avRateLimited) {
          send({ type: "progress", done, total, pct: Math.round((done / total) * 100), symbol: "⏳ Rate limit cooldown..." });
          await sleep(AV_DELAY);
        }
      }

      // ── Phase 2: Futures/commodities via Finnhub or DB cache ──
      for (let ci = 0; ci < futuresChunks.length; ci++) {
        const chunk = futuresChunks[ci];

        for (const pair of chunk) {
          done++;
          let pairCandles: CandleData[] | null = null;

          // Try Finnhub
          if (finnhubKey && FINNHUB_MAP[pair.symbol]) {
            const finnhubSym = FINNHUB_MAP[pair.symbol];
            const resolution = FINNHUB_RES[timeframe];
            if (finnhubSym && resolution) {
              const to = Math.floor(Date.now() / 1000);
              const intervalSec: Record<string, number> = {
                "1min": 60, "5min": 300, "15min": 900, "30min": 1800,
                "1h": 3600, "4h": 14400, "1day": 86400, "1week": 604800,
              };
              const from = to - Math.floor(candleLimit * (intervalSec[timeframe] ?? 3600) * 1.3);
              try {
                const url = `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(finnhubSym)}&resolution=${resolution}&from=${from}&to=${to}&token=${finnhubKey}`;
                const ctl = new AbortController();
                const timer = setTimeout(() => ctl.abort(), 8000);
                const res = await fetch(url, { signal: ctl.signal });
                clearTimeout(timer);
                if (res.ok) {
                  const data = await res.json();
                  if (data.s === "ok" && data.c?.length >= getMinimumCandles(timeframe)) {
                    pairCandles = data.c.map((close: number, i: number) => ({
                      open: data.o[i], high: data.h[i], low: data.l[i], close,
                      volume: data.v?.[i] ?? 0,
                    }));
                  }
                }
              } catch { /* fallback to DB */ }
            }
          }

          // Fallback: DB cache
          if (!pairCandles) {
            const { data: dbCandles } = await supabase
              .from("candles")
              .select("open, high, low, close, volume")
              .eq("pair_id", pair.id)
              .eq("timeframe", timeframe)
              .order("ts", { ascending: true })
              .limit(candleLimit);

            if (dbCandles && dbCandles.length >= getMinimumCandles(timeframe)) {
              pairCandles = dbCandles.map((c: { open: number; high: number; low: number; close: number; volume: number | null }) => ({
                open: Number(c.open), high: Number(c.high), low: Number(c.low),
                close: Number(c.close), volume: c.volume ? Number(c.volume) : 0,
              }));
            }
          }

          if (pairCandles && pairCandles.length >= getMinimumCandles(timeframe)) {
            const result = calcTrendScore(pairCandles, timeframe);

            if (result.trend === "bullish") bullish++;
            else if (result.trend === "bearish") bearish++;
            else neutral++;

            scoreRows.push({
              pair_id: pair.id, timeframe,
              score: result.score, trend: result.trend,
              ema_score: result.emaScore, adx_score: result.adxScore,
              rsi_score: result.rsiScore, macd_score: result.macdScore,
              ema20: result.ema20, ema50: result.ema50, ema200: result.ema200,
              adx: result.adx, rsi: result.rsi, macd_hist: result.macdHist,
              scanned_at: new Date().toISOString(),
            });
          }

          send({ type: "progress", done, total, pct: Math.round((done / total) * 100), symbol: pair.symbol });
        }
      }

      // Bulk upsert scores
      if (scoreRows.length > 0) {
        const { error: scoreError } = await supabase.from("scores").upsert(scoreRows as any, { onConflict: "pair_id,timeframe" });
        if (scoreError) console.error("Score upsert error:", scoreError);
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

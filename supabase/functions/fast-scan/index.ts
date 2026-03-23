import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Twelve Data Symbol Map ─────────────────────────────────────────────────

const TD_SYMBOL_MAP: Record<string, string> = {
  // Forex Majors
  "EURUSD": "EUR/USD", "GBPUSD": "GBP/USD", "USDJPY": "USD/JPY",
  "USDCHF": "USD/CHF", "AUDUSD": "AUD/USD", "USDCAD": "USD/CAD",
  "NZDUSD": "NZD/USD",
  // Forex Minors
  "EURGBP": "EUR/GBP", "EURJPY": "EUR/JPY", "EURCHF": "EUR/CHF",
  "EURCAD": "EUR/CAD", "EURAUD": "EUR/AUD", "EURNZD": "EUR/NZD",
  "GBPJPY": "GBP/JPY", "GBPCHF": "GBP/CHF", "GBPCAD": "GBP/CAD",
  "GBPAUD": "GBP/AUD", "GBPNZD": "GBP/NZD",
  "AUDJPY": "AUD/JPY", "AUDCAD": "AUD/CAD", "AUDCHF": "AUD/CHF",
  "AUDNZD": "AUD/NZD",
  "CADJPY": "CAD/JPY", "CADCHF": "CAD/CHF", "CHFJPY": "CHF/JPY",
  "NZDJPY": "NZD/JPY", "NZDCAD": "NZD/CAD", "NZDCHF": "NZD/CHF",
  // Metals
  "XAUUSD": "XAU/USD", "XAGUSD": "XAG/USD",
  "XPTUSD": "XPT/USD", "XPDUSD": "XPD/USD",
  // Energy
  "USOIL": "WTI/USD", "UKOIL": "BRENT/USD",
  "XTIUSD": "WTI/USD", "XBRUSD": "BRENT/USD",
  "WTICOUSD": "WTI/USD", "BCOUSD": "BRENT/USD",
  "NATGASUSD": "NATGAS/USD", "NGAS": "NATGAS/USD",
  // Agricultural
  "CORNUSD": "CORN/USD", "WHEATUSD": "WHEAT/USD",
  "SOYBNUSD": "SOYBEAN/USD", "SUGARUSD": "SUGAR/USD",
  // Index Futures
  "US30USD": "DJ30", "NAS100USD": "NDX", "SPX500USD": "SPX500",
  "US2000USD": "RUT",
  "UK100GBP": "UK100", "GER40EUR": "GER40", "AUS200AUD": "AUS200",
  "JP225USD": "JPN225", "EU50EUR": "EU50", "FR40EUR": "FRA40",
  "HK33HKD": "HK50", "CHINA50USD": "CN50USD",
};

const TD_INTERVAL_MAP: Record<string, string> = {
  "5min": "5min", "15min": "15min", "1h": "1h", "4h": "4h", "1day": "1day",
};

const CANDLE_LIMITS: Record<string, number> = {
  "5min": 120, "15min": 200, "1h": 300, "4h": 300, "1day": 365,
};

const MINIMUM_CANDLES: Record<string, number> = {
  "5min": 40, "15min": 55, "1h": 60, "4h": 60, "1day": 100,
};

// ─── Indicator Math ─────────────────────────────────────────────────────────

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

interface CandleData { open: number; high: number; low: number; close: number; volume?: number; ts?: string; }

function scoreEMA(price: number, e20: number, e50: number, e200: number, timeframe?: string): number {
  const isShortTF = timeframe === "5min" || timeframe === "15min";
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
  "5min":  { emaFast: 9,  emaMid: 21, emaSlow: 50,  rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "15min": { emaFast: 9,  emaMid: 21, emaSlow: 50,  rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "1h":    { emaFast: 20, emaMid: 50, emaSlow: 200, rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "4h":    { emaFast: 20, emaMid: 50, emaSlow: 200, rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  "1day":  { emaFast: 20, emaMid: 50, emaSlow: 200, rsiPeriod: 14, adxPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
};

function calcTrendScore(candles: CandleData[], timeframe = "1h") {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const cfg = TF_CONFIGS[timeframe] || TF_CONFIGS["1h"];

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

// ─── Twelve Data Fetch ──────────────────────────────────────────────────────

async function fetchTwelveDataCandles(
  symbol: string,
  tdSymbol: string,
  interval: string,
  outputsize: number,
  apiKey: string,
): Promise<CandleData[]> {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}&format=JSON&order=ASC`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();

    if (data.status === "error") {
      console.warn(`[TD] ${symbol}: ${data.message}`);
      return [];
    }

    if (!data.values?.length) {
      console.warn(`[TD] ${symbol}: no values returned`);
      return [];
    }

    return data.values.map((v: any) => ({
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: v.volume ? parseFloat(v.volume) : 0,
      ts: new Date(v.datetime.includes("T") ? v.datetime : v.datetime + "T00:00:00Z").toISOString(),
    }));
  } catch (err) {
    console.warn(`[TD] ${symbol}: fetch error:`, err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

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

  const tdKey = Deno.env.get("TWELVE_DATA_API_KEY");
  if (!tdKey) {
    return new Response(JSON.stringify({ error: "TWELVE_DATA_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const VALID_TFS = ["5min", "15min", "1h", "4h", "1day"];
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

  console.log(`[SCAN] START | TF: ${timeframe} | Source: Twelve Data`);

  // Load pairs
  let query = supabase.from("pairs").select("id, symbol, category, display_symbol").eq("is_active", true);
  if (pairIds && pairIds.length > 0) {
    query = query.in("id", pairIds);
  }
  const { data: pairs, error: pairsError } = await query.order("symbol");
  if (pairsError || !pairs || pairs.length === 0) {
    return new Response(JSON.stringify({ error: "No pairs found" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Filter to pairs with a Twelve Data symbol mapping
  const scannable = pairs.filter((p: any) => TD_SYMBOL_MAP[p.symbol]);
  const skipped = pairs.filter((p: any) => !TD_SYMBOL_MAP[p.symbol]);

  if (skipped.length > 0) {
    console.warn(`[SCAN] Skipping ${skipped.length} pairs with no TD mapping:`, skipped.map((p: any) => p.symbol).join(", "));
  }

  const interval = TD_INTERVAL_MAP[timeframe] || "1h";
  const outputsize = CANDLE_LIMITS[timeframe] || 200;
  const minCandles = MINIMUM_CANDLES[timeframe] || 50;

  console.log(`[SCAN] Scanning ${scannable.length} pairs | interval=${interval} | outputsize=${outputsize}`);

  // Twelve Data free tier: 8 requests/minute
  // Batch into groups of 8, wait 62s between batches
  const CHUNK_SIZE = 8;
  const chunks = chunkArray(scannable, CHUNK_SIZE);

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

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        console.log(`[SCAN] Chunk ${ci + 1}/${chunks.length} | ${chunk.map((p: any) => p.symbol).join(",")}`);

        const results = await Promise.allSettled(
          chunk.map((pair: any) => {
            const tdSymbol = TD_SYMBOL_MAP[pair.symbol];
            return fetchTwelveDataCandles(pair.symbol, tdSymbol, interval, outputsize, tdKey);
          })
        );

        for (let ri = 0; ri < results.length; ri++) {
          done++;
          const r = results[ri];
          const pair = chunk[ri] as any;
          let pairCandles: CandleData[] | null = null;

          if (r.status === "fulfilled" && r.value && r.value.length >= minCandles) {
            pairCandles = r.value;
            // Store candles in DB
            for (const c of pairCandles) {
              candleRows.push({
                pair_id: pair.id,
                timeframe,
                open: c.open, high: c.high, low: c.low, close: c.close,
                volume: c.volume ?? 0,
                ts: c.ts || new Date().toISOString(),
              });
            }
            console.log(`[SCAN] ${pair.symbol}: ${pairCandles.length} candles from TD`);
          } else if (r.status === "fulfilled" && r.value && r.value.length > 0) {
            console.warn(`[SCAN] ${pair.symbol}: only ${r.value.length} candles, need ${minCandles}`);
            // Still try to use what we got if > 20
            if (r.value.length >= 20) {
              pairCandles = r.value;
              for (const c of pairCandles) {
                candleRows.push({
                  pair_id: pair.id, timeframe,
                  open: c.open, high: c.high, low: c.low, close: c.close,
                  volume: c.volume ?? 0, ts: c.ts || new Date().toISOString(),
                });
              }
            }
          }

          // Fallback: load cached candles from DB
          if (!pairCandles || pairCandles.length < 20) {
            for (const dbTf of [timeframe, "1day", "1h", "4h"]) {
              const { data: dbCandles } = await supabase
                .from("candles")
                .select("open, high, low, close, volume")
                .eq("pair_id", pair.id)
                .eq("timeframe", dbTf)
                .order("ts", { ascending: true })
                .limit(365);

              if (dbCandles && dbCandles.length >= 20) {
                pairCandles = dbCandles.map((c: any) => ({
                  open: Number(c.open), high: Number(c.high),
                  low: Number(c.low), close: Number(c.close),
                  volume: c.volume ? Number(c.volume) : 0,
                }));
                console.log(`[SCAN] ${pair.symbol}: using ${dbCandles.length} cached ${dbTf} candles`);
                break;
              }
            }
          }

          if (pairCandles && pairCandles.length >= 20) {
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

            console.log(`[SCAN] ${pair.symbol} (${pair.category}): score=${result.score} trend=${result.trend}`);
          }

          send({ type: "progress", done, total: scannable.length, pct: Math.round((done / scannable.length) * 100), symbol: pair.symbol });
        }

        // Bulk upsert candles after each chunk
        if (candleRows.length > 0) {
          for (let i = 0; i < candleRows.length; i += 1000) {
            const batch = candleRows.slice(i, i + 1000);
            await supabase.from("candles").upsert(batch as any, { onConflict: "pair_id,timeframe,ts", ignoreDuplicates: false });
          }
          candleRows.length = 0;
        }

        // Bulk upsert scores after each chunk
        if (scoreRows.length > 0) {
          console.log(`[SCAN] Upserting ${scoreRows.length} scores for TF="${timeframe}"`);
          const { error: scoreError } = await supabase.from("scores").upsert(scoreRows as any, { onConflict: "pair_id,timeframe" });
          if (scoreError) console.error("[SCAN] Score upsert error:", scoreError);
          else console.log(`[SCAN] Successfully upserted ${scoreRows.length} scores`);
          scoreRows.length = 0;
        }

        // Rate limit: wait 62s between chunks (Twelve Data free: 8/min)
        if (ci < chunks.length - 1) {
          console.log(`[SCAN] Waiting 62s for rate limit (chunk ${ci + 1}/${chunks.length})...`);
          send({ type: "waiting", chunk: ci + 1, totalChunks: chunks.length, waitMs: 62000 });
          await sleep(62000);
        }
      }

      // Store scan history
      try {
        const authHeader = req.headers.get("authorization");
        if (authHeader) {
          const token = authHeader.replace("Bearer ", "");
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user) {
            const allScoreRows = scoreRows; // already flushed, use summary counts
            await supabase.from("scan_history").insert({
              user_id: user.id,
              result: {
                totalPairs: done, bullish, bearish, neutral,
                avgScore: done > 0 ? Math.round(((bullish * 75 + bearish * 25 + neutral * 50) / Math.max(1, bullish + bearish + neutral)) * 10) / 10 : 0,
                duration: Math.round((Date.now() - startMs) / 1000),
              },
              scanned_at: new Date().toISOString(),
            });
          }
        }
      } catch (e) { console.warn("[SCAN] Failed to store scan history:", e); }

      send({
        type: "complete",
        total: done, bullish, bearish, neutral,
        scored: bullish + bearish + neutral,
        durationMs: Date.now() - startMs,
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

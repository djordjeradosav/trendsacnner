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

function scoreEMA(price: number, e20: number, e50: number, e200: number): number {
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

function calcTrendScore(candles: CandleData[]) {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  const ema20 = latest(calcEMA(closes, 20));
  const ema50 = latest(calcEMA(closes, 50));
  const ema200 = latest(calcEMA(closes, 200));
  const rsi = latest(calcRSI(closes, 14));
  const adx = latest(calcADX(highs, lows, closes, 14));
  const { histogram } = calcMACD(closes, 12, 26, 9);
  const macdHist = latest(histogram);
  let macdHistPrev = NaN;
  for (let i = histogram.length - 2; i >= 0; i--) { if (!isNaN(histogram[i])) { macdHistPrev = histogram[i]; break; } }

  const price = closes[closes.length - 1];
  const emaS = !isNaN(ema20) && !isNaN(ema50) && !isNaN(ema200) ? scoreEMA(price, ema20, ema50, ema200) : 11;
  const adxS = !isNaN(adx) ? scoreADX(adx) : 2;
  const rsiS = !isNaN(rsi) ? scoreRSI(rsi) : 6;
  const macdS = !isNaN(macdHist) && !isNaN(macdHistPrev) ? scoreMACD(macdHist, macdHistPrev) : 6;

  // Technical 0-55, defaults for news/social
  const technical = emaS + adxS + rsiS + macdS;
  const newsDefault = 7; // 0-13
  const eventDefault = 12; // 0-12
  const stocktwitsDefault = 5; // 0-10
  const redditDefault = 5; // 0-10

  const rawScore = Math.max(0, Math.min(100, technical + newsDefault + eventDefault + stocktwitsDefault + redditDefault));
  const trend = rawScore >= 65 ? "bullish" : rawScore <= 35 ? "bearish" : "neutral";

  return {
    score: rawScore, trend,
    emaScore: emaS, adxScore: adxS, rsiScore: rsiS, macdScore: macdS,
    ema20: isNaN(ema20) ? 0 : ema20,
    ema50: isNaN(ema50) ? 0 : ema50,
    ema200: isNaN(ema200) ? 0 : ema200,
    adx: isNaN(adx) ? 0 : adx,
    rsi: isNaN(rsi) ? 50 : rsi,
    macdHist: isNaN(macdHist) ? 0 : macdHist,
  };
}

// ─── Symbol Mapping ─────────────────────────────────────────────────────────

const futuresMap: Record<string, string> = {
  "CL1!":"CL","BZ1!":"BZ","NG1!":"NG","HO1!":"HO","RB1!":"RB",
  "ZC1!":"ZC","ZW1!":"ZW","ZS1!":"ZS","ZM1!":"ZM","ZL1!":"ZL",
  "CC1!":"CC","KC1!":"KC","CT1!":"CT","SB1!":"SB",
  "ES1!":"ES","NQ1!":"NQ","YM1!":"YM","RTY1!":"RTY","VX1!":"VX","Z1!":"Z",
  "ZB1!":"ZB","ZN1!":"ZN","ZF1!":"ZF","ZT1!":"ZT",
  "FDAX1!":"FDAX","NK1!":"NK","HSI1!":"HSI",
};

function getTwelveDataSymbol(symbol: string): string {
  if (symbol.includes("/")) return symbol;
  if (futuresMap[symbol]) return futuresMap[symbol];
  if (symbol.includes("!")) return symbol.replace("!", "").replace(/1$/, "");
  if (symbol.length === 6) return `${symbol.slice(0,3)}/${symbol.slice(3)}`;
  return symbol;
}

const CANDLE_LIMITS: Record<string, number> = {
  "1min": 120, "3min": 120, "5min": 150,
  "15min": 250, "30min": 250,
  "1h": 300, "4h": 300, "1day": 365, "1week": 200,
};

const MINIMUM_CANDLES: Record<string, number> = {
  "1min": 60, "3min": 60, "5min": 80,
  "15min": 100, "30min": 100,
  "1h": 100, "4h": 100, "1day": 100, "1week": 50,
};

function getCandleLimit(tf: string): number {
  return CANDLE_LIMITS[tf] || 200;
}

function getMinimumCandles(tf: string): number {
  return MINIMUM_CANDLES[tf] || 50;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

  const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "TWELVE_DATA_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let timeframe = "1h";
  let pairIds: string[] | undefined;

  // Support both GET (SSE) and POST
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
  const CHUNK_SIZE = 20;
  const chunks = chunkArray(pairs, CHUNK_SIZE);
  const total = pairs.length;

  // SSE stream
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

        // Fetch all in parallel
        const results = await Promise.allSettled(
          chunk.map(async (pair) => {
            const tdSymbol = getTwelveDataSymbol(pair.symbol);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            try {
              const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${timeframe}&outputsize=${candleLimit}&apikey=${apiKey}`;
              const res = await fetch(url, { signal: controller.signal });
              if (res.status === 429) return null;
              const data = await res.json();
              if (!data.values || !Array.isArray(data.values) || data.values.length === 0) return null;
              return {
                pairId: pair.id,
                symbol: pair.symbol,
                candles: data.values.map((v: { datetime: string; open: string; high: string; low: string; close: string; volume?: string }) => ({
                  open: parseFloat(v.open),
                  high: parseFloat(v.high),
                  low: parseFloat(v.low),
                  close: parseFloat(v.close),
                  volume: v.volume ? parseFloat(v.volume) : 0,
                  ts: v.datetime,
                })),
              };
            } catch {
              return null;
            } finally {
              clearTimeout(timeout);
            }
          })
        );

        // Process results
        for (const r of results) {
          done++;
          if (r.status === "fulfilled" && r.value && r.value.candles.length >= 20) {
            const { pairId, symbol, candles } = r.value;
            const result = calcTrendScore(candles);

            if (result.trend === "bullish") bullish++;
            else if (result.trend === "bearish") bearish++;
            else neutral++;

            scoreRows.push({
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
            });

            // Also store candles
            const pair = chunk.find(p => p.id === pairId);
            if (pair) {
              for (const c of candles) {
                candleRows.push({
                  pair_id: pairId,
                  timeframe,
                  open: c.open,
                  high: c.high,
                  low: c.low,
                  close: c.close,
                  volume: c.volume,
                  ts: new Date(c.ts).toISOString(),
                });
              }
            }

            send({ type: "progress", done, total, pct: Math.round((done/total)*100), symbol });
          } else {
            send({ type: "progress", done, total, pct: Math.round((done/total)*100), symbol: chunk[results.indexOf(r)]?.symbol || "" });
          }
        }

        // Delay between chunks (skip last)
        if (ci < chunks.length - 1) {
          await sleep(1200);
        }
      }

      // Bulk upsert candles in batches of 1000
      for (let i = 0; i < candleRows.length; i += 1000) {
        const batch = candleRows.slice(i, i + 1000);
        await supabase.from("candles").upsert(batch as any, { onConflict: "pair_id,timeframe,ts", ignoreDuplicates: false });
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
        total: done,
        bullish, bearish, neutral,
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

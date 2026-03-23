import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIMEFRAMES = ["5min", "15min", "1h", "4h", "1day"];
const RESOLUTION: Record<string, string> = { "5min": "5", "15min": "15", "1h": "60", "4h": "240", "1day": "D" };
const CANDLE_LIMITS: Record<string, number> = { "5min": 200, "15min": 250, "1h": 300, "4h": 300, "1day": 365 };
const INTERVAL_SEC: Record<string, number> = { "5min": 300, "15min": 900, "1h": 3600, "4h": 14400, "1day": 86400 };
const MIN_CANDLES: Record<string, number> = { "5min": 35, "15min": 55, "1h": 60, "4h": 60, "1day": 100 };
const EMA_PERIODS: Record<string, { fast: number; mid: number; slow: number; long: number | null }> = {
  "5min":  { fast: 9,  mid: 21, slow: 50,  long: null },
  "15min": { fast: 9,  mid: 21, slow: 50,  long: null },
  "1h":    { fast: 9,  mid: 21, slow: 50,  long: null },
  "4h":    { fast: 9,  mid: 21, slow: 50,  long: 200  },
  "1day":  { fast: 20, mid: 50, slow: 200, long: null },
};

const INDEX_ETF_MAP: Record<string, string> = {
  "US30USD": "DIA", "NAS100USD": "QQQ", "SPX500USD": "SPY", "US2000USD": "IWM",
};

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Indicator Math ─────────────────────────────────────────────────────────

function ema(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let e = closes[0];
  return closes.map((v) => { e = v * k + e * (1 - k); return e; });
}

function calcScore(
  candles: { open: number; high: number; low: number; close: number }[],
  periods: { fast: number; mid: number; slow: number; long: number | null }
) {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const n = closes.length;
  if (n < 30) return null;

  const efArr = ema(closes, periods.fast);
  const emArr = ema(closes, periods.mid);
  const esArr = ema(closes, periods.slow);
  const elArr = periods.long ? ema(closes, periods.long) : null;

  const ef = efArr[n - 1], em = emArr[n - 1], es = esArr[n - 1];
  const el = elArr ? elArr[n - 1] : null;
  const price = closes[n - 1];

  let emaScore = 22;
  if (el !== null) {
    if (price > ef && ef > em && em > es && es > el) emaScore = 55;
    else if (price < ef && ef < em && em < es && es < el) emaScore = 0;
    else if (price > ef && ef > em && em > es) emaScore = 40;
    else if (price > ef && ef > em) emaScore = 28;
    else if (price > ef) emaScore = 16;
    else if (price < ef && ef < em && em < es) emaScore = 14;
    else if (price < ef && ef < em) emaScore = 8;
    else emaScore = 4;
  } else {
    if (price > ef && ef > em && em > es) emaScore = 55;
    else if (price < ef && ef < em && em < es) emaScore = 0;
    else if (price > ef && ef > em) emaScore = 40;
    else if (price > ef) emaScore = 22;
    else if (price < ef && ef < em) emaScore = 10;
    else emaScore = 6;
  }

  // RSI
  if (n < 15) return null;
  let avgG = 0, avgL = 0;
  for (let i = 1; i <= 14; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgG += d; else avgL -= d;
  }
  avgG /= 14; avgL /= 14;
  for (let i = 15; i < n; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * 13 + (d > 0 ? d : 0)) / 14;
    avgL = (avgL * 13 + (d < 0 ? -d : 0)) / 14;
  }
  const rsi = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  let rsiScore = 15;
  if (rsi >= 60 && rsi < 70) rsiScore = 30;
  else if (rsi >= 70) rsiScore = 24;
  else if (rsi >= 55) rsiScore = 22;
  else if (rsi >= 50) rsiScore = 18;
  else if (rsi >= 45) rsiScore = 12;
  else if (rsi >= 40) rsiScore = 7;
  else if (rsi >= 30) rsiScore = 3;
  else rsiScore = 5;

  // ADX
  const tr: number[] = [], dmp: number[] = [], dmm: number[] = [];
  for (let i = 1; i < n; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    const up = highs[i] - highs[i - 1], dn = lows[i - 1] - lows[i];
    dmp.push(up > dn && up > 0 ? up : 0);
    dmm.push(dn > up && dn > 0 ? dn : 0);
  }
  const sm = (a: number[]) => {
    let s = a.slice(0, 14).reduce((x, y) => x + y, 0);
    const r = [s];
    for (let i = 14; i < a.length; i++) { s = s - s / 14 + a[i]; r.push(s); }
    return r;
  };
  const st = sm(tr), sp = sm(dmp), sn = sm(dmm);
  const dip = sp.map((v, i) => st[i] > 0 ? v / st[i] * 100 : 0);
  const dim = sn.map((v, i) => st[i] > 0 ? v / st[i] * 100 : 0);
  const dx = dip.map((p, i) => { const s = p + dim[i]; return s > 0 ? Math.abs(p - dim[i]) / s * 100 : 0; });
  let adxVal = dx.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
  for (let i = 14; i < dx.length; i++) adxVal = (adxVal * 13 + dx[i]) / 14;

  // MACD
  const e12 = ema(closes, 12), e26 = ema(closes, 26);
  const macdLine = e12.map((v, i) => v - e26[i]);
  const sigLine = ema(macdLine, 9);
  const hist = macdLine[n - 1] - sigLine[n - 1];

  const composite = Math.min(100, Math.max(0, emaScore + rsiScore + 7));
  return {
    score: Math.round(composite),
    trend: composite >= 62 ? "bullish" as const : composite <= 38 ? "bearish" as const : "neutral" as const,
    emaScore, rsiScore,
    emaFast: parseFloat(ef.toFixed(6)),
    emaMid: parseFloat(em.toFixed(6)),
    emaLong: el ? parseFloat(el.toFixed(6)) : null,
    rsi: parseFloat(rsi.toFixed(2)),
    adx: parseFloat(adxVal.toFixed(2)),
    macdHist: parseFloat(hist.toFixed(6)),
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("FINNHUB_API_KEY") ?? "";
  const avKey = Deno.env.get("ALPHA_VANTAGE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let tfsToScan = TIMEFRAMES;
  try {
    const body = await req.json();
    if (body.timeframe && TIMEFRAMES.includes(body.timeframe)) {
      tfsToScan = [body.timeframe];
    }
  } catch { /* scan all */ }

  console.log("[DEEP-SCAN] START | TFs:", tfsToScan);

  const { data: pairs, error } = await supabase
    .from("pairs")
    .select("id, symbol, finnhub_symbol, category")
    .eq("is_active", true)
    .not("finnhub_symbol", "is", null)
    .order("symbol");

  if (error || !pairs?.length) {
    return new Response(JSON.stringify({ error: "No pairs" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[DEEP-SCAN]", pairs.length, "pairs");

  const CHUNK_SIZE = 8;
  let totalCandles = 0, successCount = 0, errorCount = 0;

  for (const tf of tfsToScan) {
    console.log(`--- TF: ${tf} ---`);
    const resolution = RESOLUTION[tf];
    const candleLimit = CANDLE_LIMITS[tf];
    const intSec = INTERVAL_SEC[tf];
    const minCandles = MIN_CANDLES[tf];
    const emaPeriods = EMA_PERIODS[tf];
    const now = Math.floor(Date.now() / 1000);
    const from = now - Math.floor(candleLimit * intSec * 2.5);

    const chunks: typeof pairs[] = [];
    for (let i = 0; i < pairs.length; i += CHUNK_SIZE) {
      chunks.push(pairs.slice(i, i + CHUNK_SIZE));
    }

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      console.log(`[${tf}] Batch ${ci + 1}/${chunks.length}`);

      const results = await Promise.allSettled(
        chunk.map(async (pair) => {
          const etfSym = INDEX_ETF_MAP[pair.symbol];

          // Index futures via Alpha Vantage (daily only)
          if (etfSym) {
            if (!avKey) return null;
            if (tf !== "1day") return null; // AV only has daily data
            try {
              const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${etfSym}&outputsize=compact&apikey=${avKey}`;
              const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
              if (!res.ok) return null;
              const json = await res.json();
              const ts = json["Time Series (Daily)"];
              if (!ts) return null;
              const candles = Object.entries(ts)
                .map(([date, vals]: [string, any]) => ({
                  pair_id: pair.id, timeframe: tf,
                  open: parseFloat(vals["1. open"]), high: parseFloat(vals["2. high"]),
                  low: parseFloat(vals["3. low"]), close: parseFloat(vals["4. close"]),
                  volume: parseFloat(vals["5. volume"] || "0"),
                  ts: new Date(date + "T00:00:00Z").toISOString(),
                }))
                .sort((a, b) => a.ts.localeCompare(b.ts));
              return { symbol: pair.symbol, candles };
            } catch { return null; }
          }

          // Forex/commodities via Finnhub
          try {
            const url = `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(pair.finnhub_symbol)}&resolution=${resolution}&from=${from}&to=${now}&token=${apiKey}`;
            let res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (res.status === 429) {
              await sleep(3000);
              res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            }
            if (!res.ok) { console.warn(`[${tf}] ${pair.symbol}: HTTP ${res.status}`); return null; }
            const data = await res.json();
            if (data.s !== "ok" || !data.c?.length) return null;
            const candles = data.c.map((close: number, i: number) => ({
              pair_id: pair.id, timeframe: tf,
              open: data.o[i], high: data.h[i], low: data.l[i], close,
              volume: data.v?.[i] ?? 0,
              ts: new Date(data.t[i] * 1000).toISOString(),
            }));
            return { symbol: pair.symbol, candles };
          } catch (e) {
            console.warn(`[${tf}] ${pair.symbol}: error`, e);
            return null;
          }
        })
      );

      const candleRows: any[] = [];
      const scoreRows: any[] = [];

      for (const r of results) {
        if (r.status !== "fulfilled" || !r.value) { errorCount++; continue; }
        const { symbol, candles } = r.value;
        successCount++;
        totalCandles += candles.length;
        candleRows.push(...candles);

        if (candles.length >= minCandles) {
          const score = calcScore(candles, emaPeriods);
          if (score) {
            const pairObj = chunk.find((p) => p.symbol === symbol);
            scoreRows.push({
              pair_id: pairObj!.id,
              timeframe: tf,
              score: score.score,
              trend: score.trend,
              ema_score: score.emaScore,
              rsi_score: score.rsiScore,
              news_score: 7,
              ema20: score.emaFast,
              ema50: score.emaMid,
              ema200: score.emaLong ?? null,
              rsi: score.rsi,
              adx: score.adx,
              macd_hist: score.macdHist,
              scanned_at: new Date().toISOString(),
            });
          }
        }
      }

      // Bulk upsert candles
      if (candleRows.length > 0) {
        for (let i = 0; i < candleRows.length; i += 1000) {
          const batch = candleRows.slice(i, i + 1000);
          const { error: ue } = await supabase.from("candles").upsert(batch, {
            onConflict: "pair_id,timeframe,ts", ignoreDuplicates: false,
          });
          if (ue) console.error(`[${tf}] candle upsert error:`, ue.message);
        }
      }

      // Bulk upsert scores
      if (scoreRows.length > 0) {
        const { error: se } = await supabase.from("scores").upsert(scoreRows, {
          onConflict: "pair_id,timeframe",
        });
        if (se) console.error(`[${tf}] score upsert error:`, se.message);
        else console.log(`[${tf}] saved ${scoreRows.length} scores`);
      }

      // Rate limit between batches
      if (ci < chunks.length - 1) {
        console.log(`[${tf}] waiting 62s...`);
        await sleep(62000);
      }
    }
    console.log(`[${tf}] complete`);
  }

  const duration = Math.round((Date.now() - Date.now()) / 1000);
  console.log(`[DEEP-SCAN] DONE | ${successCount} pairs, ${totalCandles} candles`);

  return new Response(JSON.stringify({
    success: true, tfs: tfsToScan, pairsProcessed: successCount,
    totalCandles, errors: errorCount,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

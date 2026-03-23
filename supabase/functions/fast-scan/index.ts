import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── TF-specific config ─────────────────────────────────────────────────────

const VALID_TFS = ["5min", "15min", "1h", "4h", "1day"];

const EMA_PERIODS: Record<string, { fast: number; mid: number; slow: number; long: number | null }> = {
  "5min":  { fast: 9,  mid: 21, slow: 50,  long: null },
  "15min": { fast: 9,  mid: 21, slow: 50,  long: null },
  "1h":    { fast: 9,  mid: 21, slow: 50,  long: null },
  "4h":    { fast: 9,  mid: 21, slow: 50,  long: 200  },
  "1day":  { fast: 20, mid: 50, slow: 200, long: null },
};

const MIN_CANDLES: Record<string, number> = {
  "5min": 35, "15min": 55, "1h": 60, "4h": 60, "1day": 100,
};

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

  const FINNHUB_KEY = Deno.env.get("FINNHUB_API_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let timeframe = "1h";
  if (req.method === "GET") {
    const url = new URL(req.url);
    const raw = (url.searchParams.get("timeframe") || "1h").toLowerCase().trim();
    timeframe = VALID_TFS.includes(raw) ? raw : "1h";
  } else {
    try {
      const body = await req.json();
      const raw = (body.timeframe || "1h").toLowerCase().trim();
      timeframe = VALID_TFS.includes(raw) ? raw : "1h";
    } catch { /* defaults */ }
  }

  console.log("FAST SCAN START | TF:", timeframe);
  const startTime = Date.now();

  // Step 1 — Load all active pairs
  const { data: pairs, error: pairsError } = await supabase
    .from("pairs")
    .select("id, symbol, finnhub_symbol, category")
    .eq("is_active", true);

  if (pairsError || !pairs?.length) {
    return new Response(JSON.stringify({ error: "No pairs" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 2 — Fetch ALL live forex prices in bulk
  const livePrices: Record<string, number> = {};
  const bases = ["USD", "EUR", "GBP", "AUD", "CAD", "CHF", "NZD", "JPY"];

  const rateResults = await Promise.allSettled(
    bases.map(async (base) => {
      try {
        const url = `https://finnhub.io/api/v1/forex/rates?base=${base}&token=${FINNHUB_KEY}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.quote) return;
        for (const [quote, rate] of Object.entries(data.quote as Record<string, number>)) {
          livePrices[base + quote] = rate;
        }
      } catch { /* skip */ }
    })
  );
  console.log("Live forex prices fetched:", Object.keys(livePrices).length);

  // For commodities/futures
  const nonForex = pairs.filter((p) => p.category !== "forex");
  await Promise.allSettled(
    nonForex.map(async (pair) => {
      try {
        const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(pair.finnhub_symbol)}&token=${FINNHUB_KEY}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const data = await res.json();
        if (data.c && data.c > 0) livePrices[pair.symbol] = data.c;
      } catch { /* skip */ }
    })
  );
  console.log("Total live prices:", Object.keys(livePrices).length, "| Fetch time:", Date.now() - startTime, "ms");

  // Step 3 — Load stored candles for THIS SPECIFIC TIMEFRAME
  const { data: allCandles } = await supabase
    .from("candles")
    .select("pair_id, open, high, low, close, volume, ts")
    .in("pair_id", pairs.map((p) => p.id))
    .eq("timeframe", timeframe)  // ← CRITICAL: filter by timeframe
    .order("ts", { ascending: false })
    .limit(350 * pairs.length);

  // Group candles by pair_id
  const candlesByPair: Record<string, any[]> = {};
  allCandles?.forEach((c) => {
    if (!candlesByPair[c.pair_id]) candlesByPair[c.pair_id] = [];
    candlesByPair[c.pair_id].push(c);
  });

  // Sort each pair's candles ASC
  Object.keys(candlesByPair).forEach((pid) => {
    candlesByPair[pid].sort(
      (a: any, b: any) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );
  });

  const emaPeriods = EMA_PERIODS[timeframe];
  const minRequired = MIN_CANDLES[timeframe] ?? 55;

  // Step 4 — Score each pair using TF-specific candles + EMA periods
  const scoreRows: any[] = [];
  let bullish = 0, bearish = 0, neutral = 0;

  for (const pair of pairs) {
    const livePrice = livePrices[pair.symbol];
    const storedCandles = (candlesByPair[pair.id] ?? []).map((c: any) => ({
      open: Number(c.open), high: Number(c.high), low: Number(c.low),
      close: Number(c.close), volume: Number(c.volume ?? 0),
    }));

    if (storedCandles.length < minRequired) continue;

    // Append live price as synthetic latest candle
    const lastCandle = storedCandles[storedCandles.length - 1];
    const candles = livePrice
      ? [
          ...storedCandles,
          {
            open: lastCandle.close,
            high: Math.max(livePrice, lastCandle.close),
            low: Math.min(livePrice, lastCandle.close),
            close: livePrice,
            volume: 0,
          },
        ]
      : storedCandles;

    // Score uses TF-specific EMA periods → different result per TF
    const result = calcScore(candles, emaPeriods);
    if (!result) continue;

    if (result.trend === "bullish") bullish++;
    else if (result.trend === "bearish") bearish++;
    else neutral++;

    scoreRows.push({
      pair_id: pair.id,
      timeframe,
      score: result.score,
      trend: result.trend,
      ema_score: result.emaScore,
      rsi_score: result.rsiScore,
      news_score: 7,
      ema20: result.emaFast,
      ema50: result.emaMid,
      ema200: result.emaLong ?? null,
      rsi: result.rsi,
      adx: result.adx,
      macd_hist: result.macdHist,
      scanned_at: new Date().toISOString(),
    });
  }

  console.log("Computed", scoreRows.length, "scores for TF:", timeframe);

  // Step 5 — Bulk upsert scores
  if (scoreRows.length > 0) {
    const { error } = await supabase
      .from("scores")
      .upsert(scoreRows, { onConflict: "pair_id,timeframe" });
    if (error) console.error("Score upsert error:", error.message);
  }

  const duration = Date.now() - startTime;
  console.log("FAST SCAN COMPLETE |", scoreRows.length, "pairs scored |", duration, "ms");

  // Store scan history
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        await supabase.from("scan_history").insert({
          user_id: user.id,
          result: {
            totalPairs: pairs.length, bullish, bearish, neutral,
            avgScore: scoreRows.length > 0 ? Math.round(scoreRows.reduce((s: number, r: any) => s + r.score, 0) / scoreRows.length * 10) / 10 : 0,
            duration: Math.round(duration / 1000),
          },
          scanned_at: new Date().toISOString(),
        });
      }
    }
  } catch (e) { console.warn("Failed to store scan history:", e); }

  return new Response(JSON.stringify({
    success: true,
    scored: scoreRows.length,
    total: pairs.length,
    timeframe,
    bullish, bearish, neutral,
    avgScore: scoreRows.length > 0 ? Math.round(scoreRows.reduce((s: number, r: any) => s + r.score, 0) / scoreRows.length * 10) / 10 : 0,
    durationMs: duration,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Indicator Math ─────────────────────────────────────────────────────────

function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result = [closes[0]];
  for (let i = 1; i < closes.length; i++) {
    result.push(closes[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}

function calcADX(highs: number[], lows: number[], closes: number[], period = 14): number {
  const n = closes.length;
  if (n < period * 2) return 25;
  const tr: number[] = [], dmp: number[] = [], dmm: number[] = [];
  for (let i = 1; i < n; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    const up = highs[i] - highs[i - 1], dn = lows[i - 1] - lows[i];
    dmp.push(up > dn && up > 0 ? up : 0);
    dmm.push(dn > up && dn > 0 ? dn : 0);
  }
  const smooth = (arr: number[]) => {
    let s = arr.slice(0, period).reduce((a, b) => a + b, 0);
    const r = [s];
    for (let i = period; i < arr.length; i++) { s = s - s / period + arr[i]; r.push(s); }
    return r;
  };
  const st = smooth(tr), sp = smooth(dmp), sm = smooth(dmm);
  const dip = sp.map((v, i) => st[i] > 0 ? v / st[i] * 100 : 0);
  const dim = sm.map((v, i) => st[i] > 0 ? v / st[i] * 100 : 0);
  const dx = dip.map((p, i) => { const s = p + dim[i]; return s > 0 ? Math.abs(p - dim[i]) / s * 100 : 0; });
  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) adx = (adx * (period - 1) + dx[i]) / period;
  return adx;
}

function calcTrendScore(candles: any[], timeframe: string, isLongTF: boolean) {
  const closes = candles.map((c: any) => c.close);
  const highs = candles.map((c: any) => c.high);
  const lows = candles.map((c: any) => c.low);
  const n = closes.length;
  if (n < 30) return null;

  const ef = calcEMA(closes, 9)[n - 1];
  const em = calcEMA(closes, 21)[n - 1];
  const es = calcEMA(closes, 50)[n - 1];
  const e200 = isLongTF ? calcEMA(closes, 200)[n - 1] : null;
  const price = closes[n - 1];
  const rsi = calcRSI(closes, 14);
  const adx = calcADX(highs, lows, closes, 14);

  // EMA score 0-55
  let emaScore = 22;
  if (isLongTF && e200) {
    if (price > ef && ef > em && em > es && es > e200) emaScore = 55;
    else if (price < ef && ef < em && em < es && es < e200) emaScore = 0;
    else if (price > ef && ef > em && em > es) emaScore = 40;
    else if (price > ef && ef > em) emaScore = 28;
    else if (price > ef) emaScore = 16;
    else if (price < ef && ef < em && em < es) emaScore = 14;
    else if (price < ef && ef < em) emaScore = 8;
    else if (price < ef) emaScore = 4;
  } else {
    if (price > ef && ef > em && em > es) emaScore = 55;
    else if (price < ef && ef < em && em < es) emaScore = 0;
    else if (price > ef && ef > em) emaScore = 40;
    else if (price > ef) emaScore = 22;
    else if (price < ef && ef < em) emaScore = 10;
    else if (price < ef) emaScore = 6;
  }

  // RSI score 0-30
  let rsiScore = 15;
  if (rsi >= 60 && rsi < 70) rsiScore = 30;
  else if (rsi >= 70) rsiScore = 24;
  else if (rsi >= 55) rsiScore = 22;
  else if (rsi >= 50) rsiScore = 18;
  else if (rsi >= 45) rsiScore = 12;
  else if (rsi >= 40) rsiScore = 7;
  else if (rsi >= 30) rsiScore = 3;
  else rsiScore = 5;

  const composite = Math.min(100, Math.max(0, emaScore + rsiScore + 7));
  const trend = composite >= 62 ? "bullish" : composite <= 38 ? "bearish" : "neutral";

  // MACD histogram for display
  const m12 = calcEMA(closes, 12);
  const m26 = calcEMA(closes, 26);
  const macd = m12[n - 1] - m26[n - 1];
  const sig = calcEMA(m12.map((v, i) => v - m26[i]), 9)[n - 1];

  return {
    score: composite, trend, emaScore, rsiScore,
    ema20: parseFloat(ef.toFixed(6)),
    ema50: parseFloat(em.toFixed(6)),
    ema200: e200 ? parseFloat(e200.toFixed(6)) : null,
    rsi: parseFloat(rsi.toFixed(2)),
    adx: parseFloat(adx.toFixed(2)),
    macdHist: parseFloat((macd - sig).toFixed(6)),
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

  const VALID_TFS = ["15min", "1h", "4h", "1day"];
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
    } catch { /* use defaults */ }
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
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 2 — Fetch ALL live forex prices in bulk (one call per base currency)
  const livePrices: Record<string, number> = {};
  const bases = ["USD", "EUR", "GBP", "AUD", "CAD", "CHF", "NZD", "JPY"];

  // Fetch all base rates in parallel — 8 calls total, all free tier
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

  // For commodities/futures — use Finnhub /quote (free for all instruments)
  const nonForex = pairs.filter((p) => p.category !== "forex");
  const quoteResults = await Promise.allSettled(
    nonForex.map(async (pair) => {
      try {
        const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(pair.finnhub_symbol)}&token=${FINNHUB_KEY}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const data = await res.json();
        if (data.c && data.c > 0) {
          livePrices[pair.symbol] = data.c;
        }
      } catch { /* skip */ }
    })
  );
  console.log("Total live prices:", Object.keys(livePrices).length, "| Fetch time:", Date.now() - startTime, "ms");

  // Step 3 — Load ALL stored candles in ONE query
  const { data: allCandles } = await supabase
    .from("candles")
    .select("pair_id, open, high, low, close, volume, ts")
    .in("pair_id", pairs.map((p) => p.id))
    .eq("timeframe", timeframe)
    .order("ts", { ascending: false })
    .limit(400 * pairs.length);

  // Group candles by pair_id
  const candlesByPair: Record<string, any[]> = {};
  allCandles?.forEach((c) => {
    if (!candlesByPair[c.pair_id]) candlesByPair[c.pair_id] = [];
    candlesByPair[c.pair_id].push(c);
  });

  const MINIMUM_CANDLES: Record<string, number> = {
    "15min": 50, "1h": 55, "4h": 55, "1day": 80,
  };

  // Step 4 — Score each pair
  const scoreRows: any[] = [];
  let bullish = 0, bearish = 0, neutral = 0;
  const isLongTF = ["4h", "1day"].includes(timeframe);

  for (const pair of pairs) {
    const livePrice = livePrices[pair.symbol];
    const storedCandles = (candlesByPair[pair.id] ?? [])
      .sort((a: any, b: any) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
      .map((c: any) => ({
        open: Number(c.open), high: Number(c.high), low: Number(c.low),
        close: Number(c.close), volume: Number(c.volume ?? 0),
      }));

    if (!storedCandles.length) continue;

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

    const minRequired = MINIMUM_CANDLES[timeframe] ?? 55;
    if (candles.length < minRequired) continue;

    const result = calcTrendScore(candles, timeframe, isLongTF);
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
      ema20: result.ema20,
      ema50: result.ema50,
      ema200: result.ema200 ?? null,
      rsi: result.rsi,
      adx: result.adx,
      macd_hist: result.macdHist,
      scanned_at: new Date().toISOString(),
    });
  }

  console.log("Computed", scoreRows.length, "scores");

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

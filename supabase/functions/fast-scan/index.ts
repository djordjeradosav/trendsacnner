import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// ─── ETF/stock symbol map for Finnhub free tier ─────────────────────────────
// Finnhub free tier supports US stock/ETF quotes — map our pairs to ETFs
const ETF_MAP: Record<string, string> = {
  // Index futures → ETF proxies
  "US30USD": "DIA", "NAS100USD": "QQQ", "SPX500USD": "SPY", "US2000USD": "IWM",
  "UK100GBP": "EWU", "JP225USD": "EWJ", "EU50EUR": "FEZ",
  "GER40EUR": "EWG", "FR40EUR": "EWQ", "AUS200AUD": "EWA",
  "HK33HKD": "EWH", "CN50USD": "FXI",
  // Commodities → ETF proxies
  "XAUUSD": "GLD", "XAGUSD": "SLV", "XPTUSD": "PPLT", "XPDUSD": "PALL",
  "WTICOUSD": "USO", "BCOUSD": "BNO", "NATGASUSD": "UNG",
  "CORNUSD": "CORN", "WHEATUSD": "WEAT", "SOYBNUSD": "SOYB",
  "SUGARUSD": "CANE",
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

// ─── Quote-based scoring (from Finnhub /quote data) ─────────────────────────

interface QuoteData {
  c: number; h: number; l: number; o: number; pc: number; d: number; dp: number;
}

function calcQuoteScore(q: QuoteData) {
  if (!q || !q.c || q.c <= 0) return null;

  const price = q.c;
  const open = q.o || price;
  const high = q.h || price;
  const low = q.l || price;
  const prevClose = q.pc || open;
  const changePct = q.dp ?? ((price - prevClose) / prevClose * 100);

  const range = high - low;
  const position = range > 0 ? (price - low) / range : 0.5;
  const clampedChange = Math.max(-3, Math.min(3, changePct));
  const dirScore = Math.round(((clampedChange + 3) / 6) * 55);
  const intradayPct = ((price - open) / open) * 100;
  const clampedIntraday = Math.max(-2, Math.min(2, intradayPct));
  const momentumScore = Math.round(((clampedIntraday + 2) / 4) * 30);
  const rawScore = dirScore * 0.5 + momentumScore * 0.3 + position * 20;
  const score = Math.round(Math.max(5, Math.min(95, rawScore)));
  const pseudoRsi = Math.max(15, Math.min(85, 50 + changePct * 8));
  const pseudoAdx = Math.min(60, Math.max(10, (range / price * 100) * 50));

  return {
    score,
    trend: score >= 62 ? "bullish" as const : score <= 38 ? "bearish" as const : "neutral" as const,
    emaScore: Math.round(score * 0.55),
    rsiScore: Math.round(score * 0.3),
    emaFast: price,
    emaMid: open,
    emaLong: prevClose,
    rsi: parseFloat(pseudoRsi.toFixed(2)),
    adx: parseFloat(pseudoAdx.toFixed(2)),
    macdHist: parseFloat((price - prevClose).toFixed(6)),
  };
}

// ─── Forex rate-based scoring (from exchange rate data) ─────────────────────

function calcForexScore(rate: number, prevRate: number | null) {
  if (!rate || rate <= 0) return null;
  const prev = prevRate ?? rate;
  const changePct = ((rate - prev) / prev) * 100;
  const clampedChange = Math.max(-1.5, Math.min(1.5, changePct));
  const score = Math.round(50 + clampedChange * 20);
  const finalScore = Math.max(10, Math.min(90, score));
  const pseudoRsi = Math.max(20, Math.min(80, 50 + changePct * 15));

  return {
    score: finalScore,
    trend: finalScore >= 62 ? "bullish" as const : finalScore <= 38 ? "bearish" as const : "neutral" as const,
    emaScore: Math.round(finalScore * 0.55),
    rsiScore: Math.round(finalScore * 0.3),
    emaFast: rate,
    emaMid: prev,
    emaLong: null,
    rsi: parseFloat(pseudoRsi.toFixed(2)),
    adx: parseFloat(Math.abs(changePct * 20).toFixed(2)),
    macdHist: parseFloat((rate - prev).toFixed(6)),
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

  // Step 2A — Fetch forex exchange rates from free API
  const forexRates: Record<string, Record<string, number>> = {};
  const bases = ["USD", "EUR", "GBP", "AUD", "CAD", "CHF", "NZD", "JPY"];
  await Promise.allSettled(
    bases.map(async (base) => {
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.rates) forexRates[base] = data.rates;
      } catch { /* skip */ }
    })
  );
  console.log("Forex rate bases fetched:", Object.keys(forexRates).length);

  // Step 2B — Fetch ETF/stock quotes from Finnhub for commodities + indexes
  const etfQuotes: Record<string, QuoteData> = {};
  const etfPairs = pairs.filter((p) => ETF_MAP[p.symbol]);
  const BATCH_SIZE = 10;
  for (let i = 0; i < etfPairs.length; i += BATCH_SIZE) {
    const batch = etfPairs.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (pair) => {
        const etfSym = ETF_MAP[pair.symbol];
        if (!etfSym) return;
        try {
          const url = `https://finnhub.io/api/v1/quote?symbol=${etfSym}&token=${FINNHUB_KEY}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (!res.ok) return;
          const data = await res.json();
          if (data.c && data.c > 0) etfQuotes[pair.symbol] = data;
        } catch { /* skip */ }
      })
    );
  }
  console.log("ETF quotes fetched:", Object.keys(etfQuotes).length, "| Time:", Date.now() - startTime, "ms");

  // Step 2C — Load previous scores for comparison (forex rate scoring)
  const { data: prevScores } = await supabase
    .from("scores")
    .select("pair_id, ema20")
    .in("pair_id", pairs.map((p) => p.id))
    .eq("timeframe", timeframe);
  const prevPriceMap: Record<string, number> = {};
  prevScores?.forEach((s) => { if (s.ema20) prevPriceMap[s.pair_id] = Number(s.ema20); });

  // Step 3 — Load stored candles for THIS SPECIFIC TIMEFRAME
  const { data: allCandles } = await supabase
    .from("candles")
    .select("pair_id, open, high, low, close, volume, ts")
    .in("pair_id", pairs.map((p) => p.id))
    .eq("timeframe", timeframe)
    .order("ts", { ascending: false })
    .limit(350 * pairs.length);

  const candlesByPair: Record<string, any[]> = {};
  allCandles?.forEach((c) => {
    if (!candlesByPair[c.pair_id]) candlesByPair[c.pair_id] = [];
    candlesByPair[c.pair_id].push(c);
  });
  Object.keys(candlesByPair).forEach((pid) => {
    candlesByPair[pid].sort((a: any, b: any) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  });

  const emaPeriods = EMA_PERIODS[timeframe];
  const minRequired = MIN_CANDLES[timeframe] ?? 55;

  // Step 4 — Score each pair
  const scoreRows: any[] = [];
  let bullish = 0, bearish = 0, neutral = 0;
  let candleScored = 0, quoteScored = 0, rateScored = 0;

  for (const pair of pairs) {
    let result: any = null;

    // LAYER 1: Full indicator scoring if we have enough candles
    const storedCandles = (candlesByPair[pair.id] ?? []).map((c: any) => ({
      open: Number(c.open), high: Number(c.high), low: Number(c.low),
      close: Number(c.close), volume: Number(c.volume ?? 0),
    }));
    if (storedCandles.length >= minRequired) {
      result = calcScore(storedCandles, emaPeriods);
      if (result) candleScored++;
    }

    // LAYER 2: ETF quote scoring for commodities + indexes
    if (!result && etfQuotes[pair.symbol]) {
      result = calcQuoteScore(etfQuotes[pair.symbol]);
      if (result) quoteScored++;
    }

    // LAYER 3: Exchange rate scoring for forex pairs
    if (!result && pair.category === "forex") {
      const base = pair.symbol.slice(0, 3);
      const quote = pair.symbol.slice(3);
      const rates = forexRates[base];
      if (rates && rates[quote]) {
        const rate = rates[quote];
        const prevRate = prevPriceMap[pair.id] ?? null;
        result = calcForexScore(rate, prevRate);
        if (result) rateScored++;
      }
    }

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

  console.log("Scored:", scoreRows.length, "| Candle:", candleScored, "| ETF-quote:", quoteScored, "| Rate:", rateScored);

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
            candleScored, quoteScored, rateScored,
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
    candleScored, quoteScored, rateScored,
    bullish, bearish, neutral,
    avgScore: scoreRows.length > 0 ? Math.round(scoreRows.reduce((s: number, r: any) => s + r.score, 0) / scoreRows.length * 10) / 10 : 0,
    durationMs: duration,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

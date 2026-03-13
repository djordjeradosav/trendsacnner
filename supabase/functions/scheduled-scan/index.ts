import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 8;
const BATCH_DELAY_MS = 61_000;

async function fetchWithRetry(url: string, retries = 1): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchWithRetry(url, retries - 1);
    }
    throw err;
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  if (!apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "TWELVE_DATA_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let timeframe = "1h";
  try {
    const body = await req.json();
    if (body?.timeframe) timeframe = body.timeframe;
  } catch { /* default timeframe */ }

  try {
    // Load all active pairs
    const { data: pairs, error: pairsErr } = await supabase
      .from("pairs")
      .select("id, symbol")
      .eq("is_active", true)
      .order("symbol");

    if (pairsErr || !pairs) {
      throw new Error(`Failed to load pairs: ${pairsErr?.message}`);
    }

    let bullish = 0, bearish = 0, neutral = 0, totalScore = 0, scored = 0;
    const startTime = Date.now();

    for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
      const batch = pairs.slice(i, i + BATCH_SIZE);

      // Fetch candles for batch in parallel
      await Promise.allSettled(
        batch.map(async (pair) => {
          try {
            let tdSymbol = pair.symbol;
            if (!pair.symbol.includes("!") && !pair.symbol.includes("/") && pair.symbol.length === 6) {
              tdSymbol = pair.symbol.slice(0, 3) + "/" + pair.symbol.slice(3);
            }

            const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${timeframe}&outputsize=200&apikey=${apiKey}`;
            const res = await fetchWithRetry(url);

            if (res.status === 429) {
              console.warn(`Rate limited for ${pair.symbol}, skipping`);
              return;
            }

            const data = await res.json();
            if (data.status === "error" || data.code >= 400 || !data.values) {
              console.warn(`No data for ${pair.symbol}: ${data.message || "unknown"}`);
              return;
            }

            // Map and upsert candles
            const candles = data.values.map((v: any) => ({
              pair_id: pair.id,
              timeframe,
              open: parseFloat(v.open),
              high: parseFloat(v.high),
              low: parseFloat(v.low),
              close: parseFloat(v.close),
              volume: v.volume ? parseFloat(v.volume) : 0,
              ts: new Date(v.datetime).toISOString(),
            }));

            const batchSize = 500;
            for (let b = 0; b < candles.length; b += batchSize) {
              await supabase.from("candles").upsert(
                candles.slice(b, b + batchSize),
                { onConflict: "pair_id,timeframe,ts", ignoreDuplicates: false }
              );
            }

            // Compute score from candles
            const closes = candles
              .sort((a: any, b: any) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
              .map((c: any) => c.close);
            const highs = candles
              .sort((a: any, b: any) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
              .map((c: any) => c.high);
            const lows = candles
              .sort((a: any, b: any) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
              .map((c: any) => c.low);

            if (closes.length >= 26) {
              // Inline minimal scoring (we can't import from src/)
              const score = computeSimpleScore(closes, highs, lows);

              const trend = score >= 65 ? "bullish" : score <= 35 ? "bearish" : "neutral";

              await supabase.from("scores").upsert({
                pair_id: pair.id,
                timeframe,
                score,
                trend,
                scanned_at: new Date().toISOString(),
              }, { onConflict: "pair_id,timeframe" });

              totalScore += score;
              if (trend === "bullish") bullish++;
              else if (trend === "bearish") bearish++;
              else neutral++;
              scored++;
            }
          } catch (err) {
            console.warn(`Error processing ${pair.symbol}:`, err);
          }
        })
      );

      // Rate limit delay
      if (i + BATCH_SIZE < pairs.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const avgScore = scored > 0 ? Math.round((totalScore / scored) * 10) / 10 : 0;

    const result = {
      totalPairs: pairs.length,
      bullish,
      bearish,
      neutral,
      avgScore,
      duration,
      scannedAt: new Date().toISOString(),
    };

    console.log("Scheduled scan complete:", result);

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Scheduled scan error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Minimal inline EMA + RSI + MACD scoring (can't import from src/)
function calcEMA(closes: number[], period: number): number[] {
  const r = new Array(closes.length).fill(NaN);
  if (closes.length < period) return r;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  r[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < closes.length; i++) r[i] = closes[i] * k + r[i - 1] * (1 - k);
  return r;
}

function last(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) if (!isNaN(arr[i])) return arr[i];
  return NaN;
}

function computeSimpleScore(closes: number[], highs: number[], lows: number[]): number {
  const price = closes[closes.length - 1];
  const e20 = last(calcEMA(closes, 20));
  const e50 = last(calcEMA(closes, 50));
  const e200 = last(calcEMA(closes, 200));

  // EMA score (0-40)
  let emaS = 20;
  if (!isNaN(e20) && !isNaN(e50) && !isNaN(e200)) {
    if (price > e20 && e20 > e50 && e50 > e200) emaS = 40;
    else if (price > e20 && e20 > e50) emaS = 27;
    else if (price > e20) emaS = 13;
    else if (price < e20 && e20 < e50 && e50 < e200) emaS = 0;
  }

  // RSI score (0-20)
  let rsiS = 10;
  if (closes.length >= 15) {
    let avgG = 0, avgL = 0;
    for (let i = 1; i <= 14; i++) {
      const ch = closes[i] - closes[i - 1];
      if (ch > 0) avgG += ch; else avgL += Math.abs(ch);
    }
    avgG /= 14; avgL /= 14;
    for (let i = 15; i < closes.length; i++) {
      const ch = closes[i] - closes[i - 1];
      avgG = (avgG * 13 + (ch > 0 ? ch : 0)) / 14;
      avgL = (avgL * 13 + (ch < 0 ? Math.abs(ch) : 0)) / 14;
    }
    const rsi = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
    rsiS = Math.max(0, Math.min(20, ((rsi - 50) / 50) * 20));
  }

  // MACD score (0-20)
  let macdS = 10;
  const eFast = calcEMA(closes, 12);
  const eSlow = calcEMA(closes, 26);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(eFast[i]) && !isNaN(eSlow[i])) macdLine.push(eFast[i] - eSlow[i]);
  }
  if (macdLine.length >= 10) {
    const sig = calcEMA(macdLine, 9);
    const hist = macdLine.map((v, i) => !isNaN(sig[i]) ? v - sig[i] : NaN);
    const h = last(hist);
    let hp = NaN;
    for (let i = hist.length - 2; i >= 0; i--) if (!isNaN(hist[i])) { hp = hist[i]; break; }
    if (!isNaN(h) && !isNaN(hp)) {
      if (h > 0 && h > hp) macdS = 20;
      else if (h > 0) macdS = 13;
      else if (h <= 0 && h > hp) macdS = 7;
      else macdS = 0;
    }
  }

  return Math.max(0, Math.min(100, Math.round(emaS + 3 + rsiS + macdS)));
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESOLUTION_MAP: Record<string, string> = {
  "15min": "15", "1h": "60", "4h": "240", "1day": "D",
};

function getIntervalSeconds(tf: string): number {
  const map: Record<string, number> = { "15min": 900, "1h": 3600, "4h": 14400, "1day": 86400 };
  return map[tf] ?? 3600;
}

const CANDLE_LIMITS: Record<string, number> = {
  "15min": 250, "1h": 300, "4h": 300, "1day": 365,
};

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ─── Index ETF proxy for Alpha Vantage ──────────────────────────────────────
const INDEX_ETF_MAP: Record<string, string> = {
  "US30USD": "DIA", "NAS100USD": "QQQ", "SPX500USD": "SPY", "US2000USD": "IWM",
};

type FinnhubCandleResponse = {
  c?: number[]; h?: number[]; l?: number[]; o?: number[]; v?: number[]; t?: number[];
  s: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("FINNHUB_API_KEY") ?? "";
  const avKey = Deno.env.get("ALPHA_VANTAGE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const VALID_TFS = ["15min", "1h", "4h", "1day"];
  let timeframe = "1h";

  try {
    const body = await req.json();
    const raw = (body.timeframe || "1h").toLowerCase().trim();
    timeframe = VALID_TFS.includes(raw) ? raw : "1h";
  } catch { /* defaults */ }

  console.log(`[DEEP-SCAN] START | TF: ${timeframe}`);
  const startTime = Date.now();

  // Load all active pairs
  const { data: pairs, error } = await supabase
    .from("pairs")
    .select("id, symbol, finnhub_symbol, category")
    .eq("is_active", true)
    .not("finnhub_symbol", "is", null)
    .order("symbol");

  if (error || !pairs?.length) {
    return new Response(JSON.stringify({ error: "No pairs" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resolution = RESOLUTION_MAP[timeframe] || "60";
  const candleLimit = CANDLE_LIMITS[timeframe] || 300;
  const to = Math.floor(Date.now() / 1000);
  const intervalSec = getIntervalSeconds(timeframe);
  const from = to - Math.floor(candleLimit * intervalSec * 1.3);

  console.log(`[DEEP-SCAN] ${pairs.length} pairs, resolution=${resolution}, from=${new Date(from * 1000).toISOString()}`);

  // Process in batches of 8, 60s between batches (safe for free tier)
  const CHUNK_SIZE = 8;
  const chunks = chunkArray(pairs, CHUNK_SIZE);
  let totalCandles = 0;
  let successCount = 0;
  let errorCount = 0;

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    console.log(`[DEEP-SCAN] Batch ${ci + 1}/${chunks.length} (${chunk.map((p: any) => p.symbol).join(", ")})`);

    const results = await Promise.allSettled(
      chunk.map(async (pair: any) => {
        const etfSym = INDEX_ETF_MAP[pair.symbol];

        // Index futures: use Alpha Vantage daily
        if (etfSym) {
          if (!avKey) {
            console.warn(`[DEEP-SCAN] ${pair.symbol}: no ALPHA_VANTAGE_KEY, skipping`);
            return null;
          }
          try {
            const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${etfSym}&outputsize=compact&apikey=${avKey}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) return null;
            const json = await res.json();
            const ts = json["Time Series (Daily)"];
            if (!ts) return null;

            const candles = Object.entries(ts)
              .map(([date, vals]: [string, any]) => ({
                pair_id: pair.id, timeframe: "1day",
                open: parseFloat(vals["1. open"]), high: parseFloat(vals["2. high"]),
                low: parseFloat(vals["3. low"]), close: parseFloat(vals["4. close"]),
                volume: parseFloat(vals["5. volume"] || "0"),
                ts: new Date(date + "T00:00:00Z").toISOString(),
              }))
              .sort((a, b) => a.ts.localeCompare(b.ts));
            return { symbol: pair.symbol, candles };
          } catch { return null; }
        }

        // Forex/commodities: use Finnhub candles
        try {
          const url = `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(pair.finnhub_symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;
          let res = await fetch(url, { signal: AbortSignal.timeout(15000) });

          if (res.status === 429) {
            await sleep(3000);
            res = await fetch(url, { signal: AbortSignal.timeout(15000) });
          }
          if (!res.ok) {
            console.warn(`[DEEP-SCAN] ${pair.symbol}: HTTP ${res.status}`);
            return null;
          }

          const data = (await res.json()) as FinnhubCandleResponse;
          if (data.s !== "ok" || !data.c?.length) {
            console.warn(`[DEEP-SCAN] ${pair.symbol}: status="${data.s}" candles=0`);
            return null;
          }

          const candles = data.c.map((close, i) => ({
            pair_id: pair.id, timeframe,
            open: data.o![i], high: data.h![i], low: data.l![i], close,
            volume: data.v?.[i] ?? 0,
            ts: new Date(data.t![i] * 1000).toISOString(),
          }));
          return { symbol: pair.symbol, candles };
        } catch (e) {
          console.warn(`[DEEP-SCAN] ${pair.symbol}: fetch error:`, e);
          return null;
        }
      })
    );

    // Store candles
    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value) { errorCount++; continue; }
      const { symbol, candles } = r.value;
      successCount++;
      totalCandles += candles.length;
      console.log(`[DEEP-SCAN] ${symbol}: ${candles.length} candles`);

      // Upsert in batches of 1000
      for (let i = 0; i < candles.length; i += 1000) {
        const batch = candles.slice(i, i + 1000);
        const { error: upsertError } = await supabase
          .from("candles")
          .upsert(batch as any, { onConflict: "pair_id,timeframe,ts", ignoreDuplicates: false });
        if (upsertError) console.error(`[DEEP-SCAN] ${symbol} upsert error:`, upsertError.message);
      }
    }

    // Wait 60s between batches (except last)
    if (ci < chunks.length - 1) {
      console.log(`[DEEP-SCAN] Waiting 60s before next batch...`);
      await sleep(60000);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`[DEEP-SCAN] COMPLETE | ${successCount} pairs, ${totalCandles} candles, ${errorCount} errors, ${duration}s`);

  return new Response(JSON.stringify({
    success: true,
    timeframe,
    pairsProcessed: successCount,
    totalCandles,
    errors: errorCount,
    durationSeconds: duration,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

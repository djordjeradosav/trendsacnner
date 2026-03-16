import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Alpha Vantage Timeframe Mapping ────────────────────────────────────────

const AV_INTERVAL_MAP: Record<string, { fn: string; interval?: string }> = {
  "1min":  { fn: "FX_INTRADAY", interval: "1min" },
  "5min":  { fn: "FX_INTRADAY", interval: "5min" },
  "15min": { fn: "FX_INTRADAY", interval: "15min" },
  "30min": { fn: "FX_INTRADAY", interval: "30min" },
  "1h":    { fn: "FX_INTRADAY", interval: "60min" },
  "4h":    { fn: "FX_INTRADAY", interval: "60min" }, // aggregate 4x1h
  "1day":  { fn: "FX_DAILY" },
  "1week": { fn: "FX_WEEKLY" },
};

// Symbols that use Alpha Vantage forex API (base/quote split)
function getAVForexPair(symbol: string): { from: string; to: string } | null {
  // Standard 6-char forex pairs
  const forexPairs = [
    "EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD",
    "EURGBP","EURJPY","GBPJPY","AUDJPY","CADJPY","CHFJPY","NZDJPY",
    "EURCAD","EURAUD","EURNZD","EURCHF","GBPCAD","GBPAUD","GBPNZD",
    "GBPCHF","AUDCAD","AUDNZD","AUDCHF","NZDCAD","NZDCHF","CADCHF",
    "XAUUSD","XAGUSD","XPTUSD","XPDUSD",
  ];
  if (forexPairs.includes(symbol) || (symbol.length === 6 && !symbol.includes("!"))) {
    return { from: symbol.slice(0, 3), to: symbol.slice(3) };
  }
  return null;
}

// Commodity/futures aliases for Finnhub fallback
const FINNHUB_SYMBOL_MAP: Record<string, string> = {
  "CL1!": "OANDA:WTICO_USD", "BZ1!": "OANDA:BCO_USD", "NG1!": "OANDA:NATGAS_USD",
  "ES1!": "OANDA:SPX500_USD", "NQ1!": "OANDA:NAS100_USD", "YM1!": "OANDA:US30_USD",
  "USOIL": "OANDA:WTICO_USD", "UKOIL": "OANDA:BCO_USD", "NATGAS": "OANDA:NATGAS_USD",
  "US500": "OANDA:SPX500_USD", "US100": "OANDA:NAS100_USD", "US30": "OANDA:US30_USD",
};

const FINNHUB_RESOLUTION_MAP: Record<string, string> = {
  "1min": "1", "5min": "5", "15min": "15", "30min": "30",
  "1h": "60", "4h": "240", "1day": "D", "1week": "W",
};

interface CandleRow {
  pair_id: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ts: string;
}

// ─── Alpha Vantage Fetch ────────────────────────────────────────────────────

async function fetchFromAlphaVantage(
  from: string, to: string, timeframe: string, apiKey: string, outputsize = 200
): Promise<CandleRow[] | null> {
  const avConfig = AV_INTERVAL_MAP[timeframe];
  if (!avConfig) return null;

  const actualTf = timeframe === "4h" ? "1h" : timeframe;
  const params = new URLSearchParams({
    function: avConfig.fn,
    from_symbol: from,
    to_symbol: to,
    apikey: apiKey,
    outputsize: outputsize > 100 ? "full" : "compact",
  });
  if (avConfig.interval) params.set("interval", avConfig.interval);

  const url = `https://www.alphavantage.co/query?${params}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;

    const data = await res.json();

    // Check for rate limit or error
    if (data["Note"] || data["Information"] || data["Error Message"]) {
      console.warn(`AV rate limit or error for ${from}/${to}:`, data["Note"] || data["Information"] || data["Error Message"]);
      return null;
    }

    // Find the time series key
    const tsKey = Object.keys(data).find(k => k.startsWith("Time Series"));
    if (!tsKey) return null;

    const series = data[tsKey];
    const entries = Object.entries(series) as [string, Record<string, string>][];
    
    // Sort ascending by timestamp
    entries.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

    // Take last N entries
    const sliced = entries.slice(-outputsize);

    const candles: Omit<CandleRow, "pair_id" | "timeframe">[] = sliced.map(([timestamp, vals]) => ({
      open: parseFloat(vals["1. open"]),
      high: parseFloat(vals["2. high"]),
      low: parseFloat(vals["3. low"]),
      close: parseFloat(vals["4. close"]),
      volume: 0,
      ts: new Date(timestamp + (timestamp.includes("T") ? "" : " UTC")).toISOString(),
    }));

    // If 4h timeframe, aggregate 1h candles into 4h
    if (timeframe === "4h") {
      return aggregateCandles(candles, 4) as any;
    }

    return candles as any;
  } catch (err) {
    console.warn(`AV fetch failed for ${from}/${to}:`, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function aggregateCandles(
  candles: Array<{ open: number; high: number; low: number; close: number; volume: number; ts: string }>,
  period: number
) {
  const result: typeof candles = [];
  for (let i = 0; i <= candles.length - period; i += period) {
    const chunk = candles.slice(i, i + period);
    result.push({
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, c) => s + c.volume, 0),
      ts: chunk[0].ts,
    });
  }
  return result;
}

// ─── Finnhub Fetch (fallback for futures/commodities) ───────────────────────

async function fetchFromFinnhub(
  symbol: string, timeframe: string, finnhubKey: string, outputsize = 200
): Promise<Array<{ open: number; high: number; low: number; close: number; volume: number; ts: string }> | null> {
  const finnhubSymbol = FINNHUB_SYMBOL_MAP[symbol];
  if (!finnhubSymbol) return null;

  const resolution = FINNHUB_RESOLUTION_MAP[timeframe];
  if (!resolution) return null;

  const to = Math.floor(Date.now() / 1000);
  const intervalSec: Record<string, number> = {
    "1min": 60, "5min": 300, "15min": 900, "30min": 1800,
    "1h": 3600, "4h": 14400, "1day": 86400, "1week": 604800,
  };
  const from = to - Math.floor(outputsize * (intervalSec[timeframe] ?? 3600) * 1.3);

  const url = `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(finnhubSymbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${finnhubKey}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.status === 429 || res.status === 403) return null;
    const data = await res.json();
    if (data.s !== "ok" || !data.c?.length) return null;

    return data.c.map((close: number, i: number) => ({
      open: data.o[i], high: data.h[i], low: data.l[i], close,
      volume: data.v?.[i] ?? 0,
      ts: new Date(data.t[i] * 1000).toISOString(),
    }));
  } catch {
    return null;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pair_symbol, timeframe = "1h", outputsize = 200 } = await req.json();

    if (!pair_symbol) {
      return new Response(
        JSON.stringify({ success: false, error: "pair_symbol is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const avKey = Deno.env.get("ALPHA_VANTAGE_KEY");
    const finnhubKey = Deno.env.get("FINNHUB_API_KEY");

    if (!avKey && !finnhubKey) {
      throw new Error("No API keys configured (ALPHA_VANTAGE_KEY or FINNHUB_API_KEY)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up pair_id
    const { data: pairRow, error: pairError } = await supabase
      .from("pairs")
      .select("id")
      .eq("symbol", pair_symbol)
      .single();

    if (pairError || !pairRow) {
      return new Response(
        JSON.stringify({ success: false, error: `Pair '${pair_symbol}' not found` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let rawCandles: Array<{ open: number; high: number; low: number; close: number; volume: number; ts: string }> | null = null;

    // Try Alpha Vantage first for forex/metals
    const avPair = getAVForexPair(pair_symbol);
    if (avPair && avKey) {
      console.log(`Fetching ${pair_symbol} via Alpha Vantage (${timeframe})`);
      rawCandles = await fetchFromAlphaVantage(avPair.from, avPair.to, timeframe, avKey, outputsize) as any;
    }

    // Fallback to Finnhub for futures/commodities
    if (!rawCandles && finnhubKey) {
      console.log(`Fetching ${pair_symbol} via Finnhub fallback (${timeframe})`);
      rawCandles = await fetchFromFinnhub(pair_symbol, timeframe, finnhubKey, outputsize);
    }

    if (!rawCandles || rawCandles.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: `No candle data available for ${pair_symbol}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map to DB schema
    const candles = rawCandles.map(c => ({
      pair_id: pairRow.id,
      timeframe,
      open: c.open, high: c.high, low: c.low, close: c.close,
      volume: c.volume,
      ts: c.ts,
    }));

    // Upsert in batches of 500
    let upserted = 0;
    for (let i = 0; i < candles.length; i += 500) {
      const batch = candles.slice(i, i + 500);
      const { error: upsertError } = await supabase
        .from("candles")
        .upsert(batch, { onConflict: "pair_id,timeframe,ts", ignoreDuplicates: false });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        throw new Error(`Upsert failed: ${upsertError.message}`);
      }
      upserted += batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, count: upserted, pair: pair_symbol, timeframe }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-candles error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

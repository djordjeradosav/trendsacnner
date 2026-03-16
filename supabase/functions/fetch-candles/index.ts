import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Finnhub Symbol & Resolution Mapping ────────────────────────────────────

const SYMBOL_MAP: Record<string, string> = {
  // Forex
  "EURUSD": "OANDA:EUR_USD", "GBPUSD": "OANDA:GBP_USD", "USDJPY": "OANDA:USD_JPY",
  "USDCHF": "OANDA:USD_CHF", "AUDUSD": "OANDA:AUD_USD", "USDCAD": "OANDA:USD_CAD",
  "NZDUSD": "OANDA:NZD_USD", "EURGBP": "OANDA:EUR_GBP", "EURJPY": "OANDA:EUR_JPY",
  "GBPJPY": "OANDA:GBP_JPY", "AUDJPY": "OANDA:AUD_JPY", "CADJPY": "OANDA:CAD_JPY",
  "CHFJPY": "OANDA:CHF_JPY", "NZDJPY": "OANDA:NZD_JPY", "EURCAD": "OANDA:EUR_CAD",
  "EURAUD": "OANDA:EUR_AUD", "EURNZD": "OANDA:EUR_NZD", "EURCHF": "OANDA:EUR_CHF",
  "GBPCAD": "OANDA:GBP_CAD", "GBPAUD": "OANDA:GBP_AUD", "GBPNZD": "OANDA:GBP_NZD",
  "GBPCHF": "OANDA:GBP_CHF", "AUDCAD": "OANDA:AUD_CAD", "AUDNZD": "OANDA:AUD_NZD",
  "AUDCHF": "OANDA:AUD_CHF", "NZDCAD": "OANDA:NZD_CAD", "NZDCHF": "OANDA:NZD_CHF",
  "CADCHF": "OANDA:CAD_CHF",
  // Metals
  "XAUUSD": "OANDA:XAU_USD", "XAGUSD": "OANDA:XAG_USD",
  "XPTUSD": "OANDA:XPT_USD", "XPDUSD": "OANDA:XPD_USD",
  // Commodities & Futures
  "CL1!": "OANDA:WTICO_USD", "BZ1!": "OANDA:BCO_USD", "NG1!": "OANDA:NATGAS_USD",
  "ES1!": "OANDA:SPX500_USD", "NQ1!": "OANDA:NAS100_USD", "YM1!": "OANDA:US30_USD",
};

const RESOLUTION_MAP: Record<string, string> = {
  "1min": "1", "3min": "3", "5min": "5", "15min": "15", "30min": "30",
  "1h": "60", "4h": "240", "1day": "D", "1week": "W",
};

function getIntervalSeconds(tf: string): number {
  const map: Record<string, number> = {
    "1min": 60, "3min": 180, "5min": 300, "15min": 900, "30min": 1800,
    "1h": 3600, "4h": 14400, "1day": 86400, "1week": 604800,
  };
  return map[tf] ?? 3600;
}

function getFinnhubSymbol(pairSymbol: string): string | null {
  // Direct map lookup
  if (SYMBOL_MAP[pairSymbol]) return SYMBOL_MAP[pairSymbol];
  // Try auto-converting 6-char forex pairs
  if (pairSymbol.length === 6 && !pairSymbol.includes("!")) {
    const base = pairSymbol.slice(0, 3);
    const quote = pairSymbol.slice(3);
    return `OANDA:${base}_${quote}`;
  }
  return null;
}

type FinnhubCandleResponse = {
  c?: number[];
  h?: number[];
  l?: number[];
  o?: number[];
  v?: number[];
  t?: number[];
  s: string;
};

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

    const apiKey = Deno.env.get("FINNHUB_API_KEY");
    if (!apiKey) {
      throw new Error("FINNHUB_API_KEY is not configured");
    }

    const finnhubSymbol = getFinnhubSymbol(pair_symbol);
    if (!finnhubSymbol) {
      return new Response(
        JSON.stringify({ success: false, error: `No Finnhub mapping for symbol: ${pair_symbol}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resolution = RESOLUTION_MAP[timeframe];
    if (!resolution) {
      return new Response(
        JSON.stringify({ success: false, error: `Unsupported timeframe: ${timeframe}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate from/to timestamps
    const to = Math.floor(Date.now() / 1000);
    const intervalSec = getIntervalSeconds(timeframe);
    const from = to - Math.floor(outputsize * intervalSec * 1.3);

    const url = `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(finnhubSymbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;

    console.log(`Fetching ${pair_symbol} → ${finnhubSymbol} (${timeframe})`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (res.status === 429) {
      return new Response(
        JSON.stringify({ success: false, error: "Rate limit hit. Try again later.", rate_limited: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (res.status === 403) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Finnhub API key" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = (await res.json()) as FinnhubCandleResponse;

    if (data.s !== "ok" || !data.c?.length) {
      return new Response(
        JSON.stringify({ success: false, error: data.s === "no_data" ? "No data for this symbol/range" : "No valid data returned from Finnhub" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up pair_id
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: pairRow, error: pairError } = await supabase
      .from("pairs")
      .select("id")
      .eq("symbol", pair_symbol)
      .single();

    if (pairError || !pairRow) {
      return new Response(
        JSON.stringify({ success: false, error: `Pair '${pair_symbol}' not found in database` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map Finnhub candles to our schema
    const candles = data.c!.map((close, i) => ({
      pair_id: pairRow.id,
      timeframe,
      open: data.o![i],
      high: data.h![i],
      low: data.l![i],
      close,
      volume: data.v?.[i] ?? 0,
      ts: new Date(data.t![i] * 1000).toISOString(),
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

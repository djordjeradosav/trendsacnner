import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TD_SYMBOL_MAP: Record<string, string> = {
  "EURUSD": "EUR/USD", "GBPUSD": "GBP/USD", "USDJPY": "USD/JPY",
  "USDCHF": "USD/CHF", "AUDUSD": "AUD/USD", "USDCAD": "USD/CAD",
  "NZDUSD": "NZD/USD",
  "EURGBP": "EUR/GBP", "EURJPY": "EUR/JPY", "EURCHF": "EUR/CHF",
  "EURCAD": "EUR/CAD", "EURAUD": "EUR/AUD", "EURNZD": "EUR/NZD",
  "GBPJPY": "GBP/JPY", "GBPCHF": "GBP/CHF", "GBPCAD": "GBP/CAD",
  "GBPAUD": "GBP/AUD", "GBPNZD": "GBP/NZD",
  "AUDJPY": "AUD/JPY", "AUDCAD": "AUD/CAD", "AUDCHF": "AUD/CHF",
  "AUDNZD": "AUD/NZD",
  "CADJPY": "CAD/JPY", "CADCHF": "CAD/CHF", "CHFJPY": "CHF/JPY",
  "NZDJPY": "NZD/JPY", "NZDCAD": "NZD/CAD", "NZDCHF": "NZD/CHF",
  "XAUUSD": "XAU/USD", "XAGUSD": "XAG/USD",
  "XPTUSD": "XPT/USD", "XPDUSD": "XPD/USD",
  "USOIL": "WTI/USD", "UKOIL": "BRENT/USD",
  "XTIUSD": "WTI/USD", "XBRUSD": "BRENT/USD",
  "WTICOUSD": "WTI/USD", "BCOUSD": "BRENT/USD",
  "NATGASUSD": "NATGAS/USD", "NGAS": "NATGAS/USD",
  "CORNUSD": "CORN/USD", "WHEATUSD": "WHEAT/USD",
  "SOYBNUSD": "SOYBEAN/USD", "SUGARUSD": "SUGAR/USD",
  "US30USD": "DJ30", "NAS100USD": "NDX", "SPX500USD": "SPX500",
  "US2000USD": "RUT",
  "UK100GBP": "UK100", "GER40EUR": "GER40", "AUS200AUD": "AUS200",
  "JP225USD": "JPN225", "EU50EUR": "EU50", "FR40EUR": "FRA40",
  "HK33HKD": "HK50", "CN50USD": "CN50USD",
};

const TD_INTERVAL_MAP: Record<string, string> = {
  "5min": "5min", "15min": "15min", "1h": "1h", "4h": "4h", "1day": "1day",
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

    const tdKey = Deno.env.get("TWELVE_DATA_API_KEY");
    if (!tdKey) {
      throw new Error("TWELVE_DATA_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up pair from DB
    const { data: pairRow, error: pairError } = await supabase
      .from("pairs")
      .select("id, symbol")
      .eq("symbol", pair_symbol)
      .single();

    if (pairError || !pairRow) {
      return new Response(
        JSON.stringify({ success: false, error: `Pair '${pair_symbol}' not found` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tdSymbol = TD_SYMBOL_MAP[pairRow.symbol];
    if (!tdSymbol) {
      return new Response(
        JSON.stringify({ success: false, error: `No Twelve Data symbol for ${pair_symbol}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const interval = TD_INTERVAL_MAP[timeframe] || "1h";

    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${tdKey}&format=JSON&order=ASC`;

    console.log(`Fetching ${pair_symbol} → ${tdSymbol} (${timeframe})`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    const data = await res.json();

    if (data.status === "error") {
      return new Response(
        JSON.stringify({ success: false, error: data.message || "Twelve Data error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data.values?.length) {
      return new Response(
        JSON.stringify({ success: false, error: "No data returned from Twelve Data" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map to our schema
    const candles = data.values.map((v: any) => ({
      pair_id: pairRow.id,
      timeframe,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: v.volume ? parseFloat(v.volume) : 0,
      ts: new Date(v.datetime.includes("T") ? v.datetime : v.datetime + "T00:00:00Z").toISOString(),
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESOLUTION_MAP: Record<string, string> = {
  "15min": "15",
  "1h": "60", "4h": "240", "1day": "D",
};

const SUPPORTED_RESOLUTIONS = new Set(["60", "240", "D", "W"]);

function getIntervalSeconds(tf: string): number {
  const map: Record<string, number> = {
    "15min": 900,
    "1h": 3600, "4h": 14400, "1day": 86400,
  };
  return map[tf] ?? 3600;
}

type FinnhubCandleResponse = {
  c?: number[]; h?: number[]; l?: number[]; o?: number[]; v?: number[]; t?: number[];
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up pair from DB — get finnhub_symbol directly
    const { data: pairRow, error: pairError } = await supabase
      .from("pairs")
      .select("id, finnhub_symbol")
      .eq("symbol", pair_symbol)
      .single();

    if (pairError || !pairRow) {
      return new Response(
        JSON.stringify({ success: false, error: `Pair '${pair_symbol}' not found in database` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finnhubSymbol = pairRow.finnhub_symbol;
    if (!finnhubSymbol) {
      return new Response(
        JSON.stringify({ success: false, error: `No Finnhub symbol for ${pair_symbol}. Run sync-pairs first.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawResolution = RESOLUTION_MAP[timeframe];
    if (!rawResolution) {
      return new Response(
        JSON.stringify({ success: false, error: `Unsupported timeframe: ${timeframe}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Finnhub free tier: fall back to 1H for sub-hourly resolutions
    const resolution = SUPPORTED_RESOLUTIONS.has(rawResolution) ? rawResolution : "60";
    const effectiveTF = resolution !== rawResolution ? "1h" : timeframe;

    const to = Math.floor(Date.now() / 1000);
    const intervalSec = getIntervalSeconds(effectiveTF);
    const bufferMultiplier = effectiveTF === "15min" ? 2.5 : 1.3;
    const from = to - Math.floor(outputsize * intervalSec * bufferMultiplier);

    const url = `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(finnhubSymbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;

    console.log(`Fetching ${pair_symbol} → ${finnhubSymbol} (${timeframe}, resolution=${resolution})`);

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
        JSON.stringify({ success: false, error: "Finnhub free tier does not support this resolution." }),
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

    // Map Finnhub candles to our schema
    const candles = data.c!.map((close, i) => ({
      pair_id: pairRow.id,
      timeframe: effectiveTF,
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
      JSON.stringify({ success: true, count: upserted, pair: pair_symbol, timeframe: effectiveTF }),
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

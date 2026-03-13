import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function fetchWithRetry(
  url: string,
  retries = 1,
  delayMs = 1000,
): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    if (retries > 0) {
      console.log(`Fetch failed, retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
      return fetchWithRetry(url, retries - 1, delayMs);
    }
    throw err;
  }
}

type TwelveDataResponse = {
  code?: number;
  status?: string;
  message?: string;
  values?: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }>;
  meta?: Record<string, unknown>;
};

const futuresMap: Record<string, string> = {
  // Energy
  "CL1!": "CL",
  "BZ1!": "BZ",
  "NG1!": "NG",
  "HO1!": "HO",
  "RB1!": "RB",
  // Grains
  "ZC1!": "ZC",
  "ZW1!": "ZW",
  "ZS1!": "ZS",
  "ZM1!": "ZM",
  "ZL1!": "ZL",
  // Softs
  "CC1!": "CC",
  "KC1!": "KC",
  "CT1!": "CT",
  "SB1!": "SB",
  // Indices
  "ES1!": "ES",
  "NQ1!": "NQ",
  "YM1!": "YM",
  "RTY1!": "RTY",
  "VX1!": "VX",
  "Z1!": "Z",
  // Bonds
  "ZB1!": "ZB",
  "ZN1!": "ZN",
  "ZF1!": "ZF",
  "ZT1!": "ZT",
  // International
  "FDAX1!": "FDAX",
  "NK1!": "NK",
  "HSI1!": "HSI",
};

function dedupeSymbols(symbols: string[]): string[] {
  return [...new Set(symbols.filter(Boolean))];
}

function getTwelveDataCandidates(pairSymbol: string): string[] {
  if (pairSymbol.includes("/")) return [pairSymbol];

  if (pairSymbol.includes("!")) {
    const mappedRoot = futuresMap[pairSymbol] ?? pairSymbol.replace("!", "").replace(/1$/, "");
    // Try futures-like candidates first, then root fallback
    return dedupeSymbols([`${mappedRoot}1`, `${mappedRoot}=F`, mappedRoot]);
  }

  if (pairSymbol.length === 6) {
    // Forex/metals style: EURUSD -> EUR/USD
    return [`${pairSymbol.slice(0, 3)}/${pairSymbol.slice(3)}`];
  }

  return [pairSymbol];
}

async function fetchTimeSeriesWithCandidates({
  pairSymbol,
  timeframe,
  outputsize,
  apiKey,
  candidates,
}: {
  pairSymbol: string;
  timeframe: string;
  outputsize: number;
  apiKey: string;
  candidates: string[];
}): Promise<{
  data?: TwelveDataResponse;
  usedSymbol?: string;
  rateLimited?: boolean;
  lastError?: TwelveDataResponse;
}> {
  let lastError: TwelveDataResponse | undefined;

  for (const candidate of candidates) {
    console.log(`Fetching ${pairSymbol} → ${candidate} (${timeframe})`);
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(candidate)}&interval=${timeframe}&outputsize=${outputsize}&apikey=${apiKey}`;
    const res = await fetchWithRetry(url);

    if (res.status === 429) {
      return { rateLimited: true };
    }

    const data = (await res.json()) as TwelveDataResponse;
    if (Array.isArray(data.values) && data.values.length > 0) {
      return { data, usedSymbol: candidate };
    }

    lastError = data;
    console.warn(
      `Candidate failed for ${pairSymbol} (${candidate}): ${data.message ?? "Unknown Twelve Data error"}`,
    );
  }

  return { lastError };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pair_symbol, timeframe = "1h", outputsize = 200 } =
      await req.json();

    if (!pair_symbol) {
      return new Response(
        JSON.stringify({ success: false, error: "pair_symbol is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
    if (!apiKey) {
      throw new Error("TWELVE_DATA_API_KEY is not configured");
    }

    // Map our symbol format to Twelve Data format
    // Forex: EURUSD -> EUR/USD
    // Metals: XAUUSD -> XAU/USD
    // Futures with "!" (TradingView notation) -> Twelve Data equivalents
    const futuresMap: Record<string, string> = {
      // Energy
      "CL1!": "CL", "BZ1!": "BZ", "NG1!": "NG", "HO1!": "HO", "RB1!": "RB",
      // Grains
      "ZC1!": "ZC", "ZW1!": "ZW", "ZS1!": "ZS", "ZM1!": "ZM", "ZL1!": "ZL",
      // Softs
      "CC1!": "CC", "KC1!": "KC", "CT1!": "CT", "SB1!": "SB",
      // Indices
      "ES1!": "ES", "NQ1!": "NQ", "YM1!": "YM", "RTY1!": "RTY",
      "VX1!": "VX", "Z1!": "Z",
      // Bonds
      "ZB1!": "ZB", "ZN1!": "ZN", "ZF1!": "ZF", "ZT1!": "ZT",
      // International
      "FDAX1!": "FDAX", "NK1!": "NK", "HSI1!": "HSI",
    };

    let tdSymbol = pair_symbol;
    if (futuresMap[pair_symbol]) {
      // Futures — use the mapped symbol
      tdSymbol = futuresMap[pair_symbol];
    } else if (
      !pair_symbol.includes("/") &&
      pair_symbol.length === 6 &&
      !pair_symbol.includes("!")
    ) {
      // Forex pairs: EURUSD -> EUR/USD, also handles XAUUSD -> XAU/USD
      tdSymbol = pair_symbol.slice(0, 3) + "/" + pair_symbol.slice(3);
    }

    console.log(`Fetching ${pair_symbol} → ${tdSymbol} (${timeframe})`);
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${timeframe}&outputsize=${outputsize}&apikey=${apiKey}`;

    const res = await fetchWithRetry(url);

    if (res.status === 429) {
      console.warn("Twelve Data rate limit hit (429). Skipping.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Rate limit hit. Try again later.",
          rate_limited: true,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    // Twelve Data error response
    if (data.code && data.code >= 400) {
      return new Response(
        JSON.stringify({
          success: false,
          error: data.message || "Twelve Data API error",
          td_code: data.code,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (data.status === "error") {
      return new Response(
        JSON.stringify({
          success: false,
          error: data.message || "Unknown Twelve Data error",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data.values || !Array.isArray(data.values)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No data returned from Twelve Data",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the pair_id from our pairs table
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
        JSON.stringify({
          success: false,
          error: `Pair '${pair_symbol}' not found in database`,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map Twelve Data values to our candles schema
    const candles = data.values.map(
      (v: {
        datetime: string;
        open: string;
        high: string;
        low: string;
        close: string;
        volume?: string;
      }) => ({
        pair_id: pairRow.id,
        timeframe,
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: v.volume ? parseFloat(v.volume) : 0,
        ts: new Date(v.datetime).toISOString(),
      })
    );

    // Upsert in batches of 500
    const batchSize = 500;
    let upserted = 0;
    for (let i = 0; i < candles.length; i += batchSize) {
      const batch = candles.slice(i, i + batchSize);
      const { error: upsertError } = await supabase
        .from("candles")
        .upsert(batch, {
          onConflict: "pair_id,timeframe,ts",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        throw new Error(`Upsert failed: ${upsertError.message}`);
      }
      upserted += batch.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: upserted,
        pair: pair_symbol,
        timeframe,
        meta: data.meta,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-candles error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

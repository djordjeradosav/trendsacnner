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
    // For known futures, use a single best candidate first to avoid consuming extra API credits.
    if (futuresMap[pairSymbol]) {
      return [futuresMap[pairSymbol]];
    }

    const stripped = pairSymbol.replace("!", "").replace(/1$/, "");
    // Unknown symbols: attempt a conservative fallback chain.
    return dedupeSymbols([stripped, `${stripped}1`, `${stripped}=F`]);
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
      return { rateLimited: true, lastError: { code: 429, message: "Rate limit hit. Try again later." } };
    }

    const data = (await res.json()) as TwelveDataResponse;
    if (Array.isArray(data.values) && data.values.length > 0) {
      return { data, usedSymbol: candidate };
    }

    lastError = data;

    // Stop immediately on provider limit/plan errors; trying next candidate only burns more credits.
    if (data.code === 429) {
      return { lastError };
    }
    if (typeof data.message === "string" && data.message.includes("available starting with the Grow or Venture plan")) {
      return { lastError };
    }

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

    const symbolCandidates = getTwelveDataCandidates(pair_symbol);
    const {
      data,
      usedSymbol,
      rateLimited,
      lastError,
    } = await fetchTimeSeriesWithCandidates({
      pairSymbol: pair_symbol,
      timeframe,
      outputsize,
      apiKey,
      candidates: symbolCandidates,
    });

    if (rateLimited) {
      console.warn("Twelve Data rate limit hit (429). Skipping.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Rate limit hit. Try again later.",
          rate_limited: true,
          td_code: 429,
          attempted_symbols: symbolCandidates,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!data || !Array.isArray(data.values) || data.values.length === 0) {
      const errorMessage =
        lastError?.message ||
        "No valid data returned from Twelve Data for any symbol candidate";

      // Symbol misses are expected for some instruments; return 200 so the scanner can skip gracefully.
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          td_code: lastError?.code,
          attempted_symbols: symbolCandidates,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (usedSymbol && usedSymbol !== pair_symbol) {
      console.log(`Resolved ${pair_symbol} using candidate ${usedSymbol}`);
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

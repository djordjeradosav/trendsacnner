import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FRED_SERIES: Record<string, { id: string; unit: string; lowerIsBetter: boolean }> = {
  NFP:           { id: "PAYEMS",   unit: "K",  lowerIsBetter: false },
  CPI:           { id: "CPIAUCSL", unit: "%",  lowerIsBetter: true },
  CORE_CPI:      { id: "CPILFESL", unit: "%",  lowerIsBetter: true },
  PCE:           { id: "PCEPI",    unit: "%",  lowerIsBetter: true },
  CORE_PCE:      { id: "PCEPILFE", unit: "%",  lowerIsBetter: true },
  UNEMPLOYMENT:  { id: "UNRATE",   unit: "%",  lowerIsBetter: true },
  INTEREST_RATE: { id: "FEDFUNDS", unit: "%",  lowerIsBetter: false },
};

async function fetchFRED(seriesId: string, apiKey: string, limit = 60): Promise<any[]> {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", String(limit));

  console.log(`Fetching FRED series: ${seriesId}`);
  const res = await fetch(url.toString());

  if (!res.ok) {
    const body = await res.text();
    console.error(`FRED API error ${res.status} for ${seriesId}: ${body}`);
    return [];
  }

  const json = await res.json();
  if (json.error_message) {
    console.error(`FRED error for ${seriesId}: ${json.error_message}`);
    return [];
  }

  const obs = (json.observations ?? []).filter((o: any) => o.value !== "." && o.value !== "");
  console.log(`Got ${obs.length} observations for ${seriesId}`);
  return obs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FRED_API_KEY = Deno.env.get("FRED_API_KEY");
    if (!FRED_API_KEY) {
      console.error("FRED_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "FRED_API_KEY not configured", keyMissing: true }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const requestedIndicator = body?.indicator as string | undefined;

    const seriesToFetch = requestedIndicator
      ? { [requestedIndicator]: FRED_SERIES[requestedIndicator] }
      : FRED_SERIES;

    if (requestedIndicator && !FRED_SERIES[requestedIndicator]) {
      return new Response(
        JSON.stringify({ error: `Unknown indicator: ${requestedIndicator}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows: any[] = [];
    const errors: string[] = [];

    for (const [key, config] of Object.entries(seriesToFetch)) {
      try {
        const obs = await fetchFRED(config.id, FRED_API_KEY);

        for (let i = 0; i < obs.length; i++) {
          const current = obs[i];
          const previous = obs[i + 1];
          const actual = parseFloat(current.value);
          const prev = previous ? parseFloat(previous.value) : null;

          if (isNaN(actual)) continue;

          rows.push({
            indicator: key,
            country: "US",
            actual,
            previous: prev,
            forecast: null,
            surprise: null,
            beat_miss: "pending",
            release_date: current.date,
            unit: config.unit,
            source: "FRED",
          });
        }
      } catch (err) {
        const msg = `Failed to fetch ${key}: ${String(err)}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    console.log(`Total rows to upsert: ${rows.length}`);

    if (rows.length > 0) {
      const { error } = await supabase.from("macro_indicators").upsert(rows, {
        onConflict: "indicator,release_date,country",
        ignoreDuplicates: false,
      });

      if (error) {
        console.error("Upsert error:", error);
        return new Response(
          JSON.stringify({ error: error.message, count: 0 }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: rows.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

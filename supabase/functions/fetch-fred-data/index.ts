import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FRED_SERIES: Record<string, { id: string; unit: string; lowerIsBetter: boolean }> = {
  NFP:           { id: "PAYEMS",   unit: "K",  lowerIsBetter: false },
  CPI:           { id: "CPIAUCSL", unit: "%",  lowerIsBetter: true },
  CORE_CPI:      { id: "CPILFESL", unit: "%",  lowerIsBetter: true },
  PCE:           { id: "PCEPI",    unit: "%",  lowerIsBetter: true },
  CORE_PCE:      { id: "PCEPILFE", unit: "%",  lowerIsBetter: true },
  UNEMPLOYMENT:  { id: "UNRATE",   unit: "%",  lowerIsBetter: true },
  INTEREST_RATE: { id: "FEDFUNDS", unit: "%",  lowerIsBetter: false },
  PPI:           { id: "PPIACO",   unit: "%",  lowerIsBetter: true },
  GDP:           { id: "GDP",      unit: "B",  lowerIsBetter: false },
  RETAIL_SALES:  { id: "RSAFS",    unit: "M",  lowerIsBetter: false },
};

const EVENT_NAME_MAP: Record<string, string> = {
  NFP: "nonfarm",
  CPI: "CPI",
  CORE_CPI: "Core CPI",
  PCE: "PCE",
  CORE_PCE: "Core PCE",
  UNEMPLOYMENT: "Unemployment",
  INTEREST_RATE: "Fed",
  PPI: "PPI",
  GDP: "GDP",
  RETAIL_SALES: "Retail Sales",
};

async function fetchSeries(seriesId: string, apiKey: string, limit = 60) {
  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${seriesId}` +
    `&api_key=${apiKey}` +
    `&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`FRED API error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return (data.observations ?? []).filter((o: any) => o.value !== ".");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FRED_API_KEY = Deno.env.get("FRED_API_KEY");
    if (!FRED_API_KEY) {
      return new Response(
        JSON.stringify({ error: "FRED_API_KEY not configured" }),
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

    const results: any[] = [];

    for (const [key, config] of Object.entries(seriesToFetch)) {
      try {
        const obs = await fetchSeries(config.id, FRED_API_KEY, 60);

        for (let i = 0; i < obs.length; i++) {
          const current = obs[i];
          const previous = obs[i + 1];
          const actual = parseFloat(current.value);
          const prev = previous ? parseFloat(previous.value) : null;

          // Try to get forecast from economic_events table
          let forecast: number | null = null;
          try {
            const eventName = EVENT_NAME_MAP[key] ?? key;
            const { data: event } = await supabase
              .from("economic_events")
              .select("forecast")
              .ilike("event_name", `%${eventName}%`)
              .eq("currency", "USD")
              .lte("scheduled_at", current.date + "T23:59:59Z")
              .gte("scheduled_at", current.date + "T00:00:00Z")
              .limit(1)
              .maybeSingle();

            if (event?.forecast) {
              forecast = parseFloat(event.forecast.replace(/[^0-9.\-]/g, ""));
              if (isNaN(forecast)) forecast = null;
            }
          } catch {
            // No matching event found, forecast stays null
          }

          const surprise =
            forecast != null && !isNaN(actual) ? actual - forecast : null;

          let beatMiss = "pending";
          if (surprise != null) {
            if (Math.abs(surprise) < 0.01) {
              beatMiss = "inline";
            } else if (config.lowerIsBetter) {
              beatMiss = surprise < 0 ? "beat" : "miss";
            } else {
              beatMiss = surprise > 0 ? "beat" : "miss";
            }
          }

          results.push({
            indicator: key,
            country: "US",
            actual: isNaN(actual) ? null : actual,
            previous: prev,
            forecast,
            surprise,
            beat_miss: beatMiss,
            release_date: current.date,
            unit: config.unit,
            source: "FRED",
          });
        }
      } catch (err) {
        console.error(`Failed to fetch ${key}:`, err);
      }
    }

    if (results.length > 0) {
      const { error } = await supabase.from("macro_indicators").upsert(results, {
        onConflict: "indicator,release_date,country",
        ignoreDuplicates: false,
      });
      if (error) {
        console.error("Upsert error:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: results.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-fred-data error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AV_FUNCTIONS: Record<string, string> = {
  cpi: "CPI",
  "nonfarm payrolls": "NONFARM_PAYROLL",
  "non-farm": "NONFARM_PAYROLL",
  nonfarm: "NONFARM_PAYROLL",
  unemployment: "UNEMPLOYMENT",
  "retail sales": "RETAIL_SALES",
  "federal funds": "FEDERAL_FUNDS_RATE",
  "interest rate": "FEDERAL_FUNDS_RATE",
  "treasury yield": "TREASURY_YIELD",
  "real gdp": "REAL_GDP",
  gdp: "REAL_GDP",
};

function findAVFunction(eventName: string): string | null {
  const lower = eventName.toLowerCase();
  for (const [key, fn] of Object.entries(AV_FUNCTIONS)) {
    if (lower.includes(key)) return fn;
  }
  return null;
}

function generateSyntheticHistory(
  eventName: string,
  currency: string,
  forecast: string | null,
  previous: string | null
): Array<{ date: string; value: string }> {
  const baseStr = previous || forecast || "0.0";
  const base = parseFloat(baseStr.replace(/[^0-9.\-]/g, "")) || 0;
  const suffix = baseStr.replace(/[0-9.\-]/g, "").trim();
  const results: Array<{ date: string; value: string }> = [];
  let current = base;

  for (let i = 1; i <= 24; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    d.setDate(1);
    const step = (Math.random() - 0.5) * 0.2 * Math.max(Math.abs(base), 0.1);
    current = current - step;
    const val = suffix ? `${current.toFixed(1)}${suffix}` : current.toFixed(1);
    results.push({ date: d.toISOString().split("T")[0], value: val });
  }

  return results.reverse();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_name, currency, forecast, previous } = await req.json();
    if (!event_name) {
      return new Response(JSON.stringify({ error: "event_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if we already have historical data
    const { count } = await supabase
      .from("economic_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", event_name)
      .eq("currency", currency || "")
      .eq("is_historical", true);

    if ((count || 0) >= 6) {
      return new Response(JSON.stringify({ status: "already_backfilled", count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let dataPoints: Array<{ date: string; value: string }> = [];
    let isSynthetic = false;

    // Try Alpha Vantage first
    const avFunction = findAVFunction(event_name);
    const avKey = Deno.env.get("ALPHA_VANTAGE_KEY");

    if (avFunction && avKey) {
      try {
        const url = `https://www.alphavantage.co/query?function=${avFunction}&apikey=${avKey}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.data && Array.isArray(json.data)) {
          dataPoints = json.data
            .slice(0, 24)
            .map((d: { date: string; value: string }) => ({
              date: d.date,
              value: d.value,
            }));
        }
      } catch (e) {
        console.error("Alpha Vantage fetch failed:", e);
      }
    }

    // Fallback to synthetic data
    if (dataPoints.length < 6) {
      dataPoints = generateSyntheticHistory(event_name, currency || "", forecast, previous);
      isSynthetic = true;
    }

    // Upsert into economic_events
    const rows = dataPoints.map((dp) => ({
      event_name,
      currency: currency || null,
      scheduled_at: new Date(dp.date).toISOString(),
      actual: dp.value,
      impact: "low",
      is_historical: true,
      is_synthetic: isSynthetic,
    }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from("economic_events")
        .upsert(rows, { onConflict: "event_name,scheduled_at,currency" });

      if (error) {
        console.error("Upsert error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ status: "ok", count: rows.length, is_synthetic: isSynthetic }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Backfill error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

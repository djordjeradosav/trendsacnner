import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twelveKey = Deno.env.get("TWELVE_DATA_API_KEY") || "";

    const sb = createClient(supabaseUrl, serviceKey);

    let events: any[] = [];

    // Try Twelve Data first
    if (twelveKey) {
      try {
        const res = await fetch(
          `https://api.twelvedata.com/economic_calendar?apikey=${twelveKey}`
        );
        if (res.ok) {
          const json = await res.json();
          if (json?.data) {
            events = json.data.map((e: any) => ({
              event_name: e.event || e.title || "Unknown",
              country: e.country || null,
              impact: ["high", "medium", "low"].includes(
                (e.importance || e.impact || "low").toLowerCase()
              )
                ? (e.importance || e.impact || "low").toLowerCase()
                : "low",
              scheduled_at: e.date || e.datetime || new Date().toISOString(),
              actual: e.actual ?? null,
              forecast: e.estimate ?? e.forecast ?? null,
              previous: e.previous ?? null,
              currency: e.currency_code || e.currency || null,
            }));
          }
        }
      } catch (err) {
        console.error("Twelve Data calendar failed:", err);
      }
    }

    // Fallback to ForexFactory feed
    if (events.length === 0) {
      try {
        const res = await fetch(
          "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
        );
        if (res.ok) {
          const json = await res.json();
          events = (json || []).map((e: any) => ({
            event_name: e.title || "Unknown",
            country: e.country || null,
            impact: ["high", "medium", "low"].includes(
              (e.impact || "low").toLowerCase()
            )
              ? (e.impact || "low").toLowerCase()
              : "low",
            scheduled_at: e.date || new Date().toISOString(),
            actual: e.actual ?? null,
            forecast: e.forecast ?? null,
            previous: e.previous ?? null,
            currency: e.country || null,
          }));
        }
      } catch (err) {
        console.error("ForexFactory feed failed:", err);
      }
    }

    if (events.length > 0) {
      const { error } = await sb
        .from("economic_events")
        .upsert(events, { onConflict: "event_name,scheduled_at,currency", ignoreDuplicates: false });
      if (error) console.error("Upsert error:", error);
    }

    return new Response(
      JSON.stringify({ fetched: events.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

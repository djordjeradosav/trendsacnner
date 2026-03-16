import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FF_URLS = [
  "https://nfs.faireconomy.media/ff_calendar_lastweek.json",
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
];

function nullIfEmpty(val: string | null | undefined): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

function normalizeImpact(impact: string): string {
  const lower = (impact || "low").toLowerCase();
  if (["high", "medium", "low", "holiday"].includes(lower)) return lower;
  if (lower.includes("holiday") || lower.includes("non-economic")) return "holiday";
  return "low";
}

interface FFEvent {
  title?: string;
  country?: string;
  currency?: string;
  impact?: string;
  date?: string;
  time?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch all 3 feeds in parallel with timeouts
    const responses = await Promise.allSettled(
      FF_URLS.map((url) =>
        fetch(url, {
          headers: { Accept: "application/json", "User-Agent": "TrendScanApp/1.0" },
          signal: AbortSignal.timeout(8000),
        }).then((r) => r.json())
      )
    );

    const allRaw: FFEvent[] = [];
    for (const res of responses) {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        allRaw.push(...res.value);
      }
    }

    console.log(`Fetched ${allRaw.length} events from ForexFactory`);

    // Deduplicate and map
    const seen = new Set<string>();
    const events: Record<string, unknown>[] = [];

    for (const ev of allRaw) {
      // Determine tentative: explicit "Tentative"/"All Day" in time field,
      // OR if the ISO date has midnight exactly (T00:00 or T12:00 with no real time)
      const timeField = (ev.time || "").trim();
      const explicitTentative = timeField === "Tentative" || timeField === "All Day";
      // If date has a "T" with a real non-midnight time, it's NOT tentative
      const hasRealTime = ev.date && ev.date.includes("T") && !ev.date.includes("T00:00") && !ev.date.includes("T12:00:00");
      const isTentative = explicitTentative || (!timeField && !hasRealTime);
      let scheduledAt: string | null = null;

      if (ev.date) {
        // FF feed dates are ISO with EDT/EST offset: "2026-03-15T17:30:00-04:00"
        if (ev.date.includes("T")) {
          // Direct ISO parse — JS handles the offset correctly
          const d = new Date(ev.date);
          if (!isNaN(d.getTime())) {
            scheduledAt = d.toISOString();
          }
        } else {
          // Fallback: MM-DD-YYYY format
          const parts = ev.date.split("-");
          if (parts.length === 3) {
            const month = parseInt(parts[0], 10) - 1;
            const day = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            scheduledAt = new Date(Date.UTC(year, month, day, 12, 0)).toISOString();
          }
        }
      }

      if (!scheduledAt) continue;

      // Use empty string for null currency in dedup key to match DB unique index
      const currency = nullIfEmpty(ev.country) || nullIfEmpty(ev.currency) || "";
      const key = `${(ev.title || "").trim()}|${scheduledAt}|${currency}`;
      if (seen.has(key)) continue;
      seen.add(key);

      events.push({
        event_name: (ev.title || "Unknown Event").trim(),
        country: nullIfEmpty(ev.country),
        currency: currency || null,
        impact: normalizeImpact(ev.impact || "low"),
        scheduled_at: scheduledAt,
        forecast: nullIfEmpty(ev.forecast),
        previous: nullIfEmpty(ev.previous),
        actual: nullIfEmpty(ev.actual),
        is_tentative: isTentative,
      });
    }

    console.log(`Deduped to ${events.length} events`);

    // Use raw SQL upsert via the service client to handle COALESCE index
    let upserted = 0;
    if (events.length > 0) {
      for (let i = 0; i < events.length; i += 200) {
        const chunk = events.slice(i, i + 200);
        // Use INSERT ... ON CONFLICT with the COALESCE index
        for (const ev of chunk) {
          const { error } = await sb.from("economic_events").upsert(
            {
              event_name: ev.event_name,
              country: ev.country,
              currency: ev.currency,
              impact: ev.impact,
              scheduled_at: ev.scheduled_at,
              forecast: ev.forecast,
              previous: ev.previous,
              actual: ev.actual,
              is_tentative: ev.is_tentative,
            } as any,
            { onConflict: "event_name,scheduled_at,currency", ignoreDuplicates: false }
          );
          if (error) {
            // If upsert fails (null currency conflict), try insert-or-skip
            // Check if already exists
            const { data: existing } = await sb
              .from("economic_events")
              .select("id")
              .eq("event_name", ev.event_name as string)
              .eq("scheduled_at", ev.scheduled_at as string)
              .is("currency", ev.currency === null ? null : undefined)
              .limit(1);
            
            if (existing && existing.length > 0) {
              // Update the existing row
              await sb
                .from("economic_events")
                .update({
                  forecast: ev.forecast,
                  previous: ev.previous,
                  actual: ev.actual,
                  impact: ev.impact,
                } as any)
                .eq("id", existing[0].id);
            } else {
              // Insert new
              await sb.from("economic_events").insert(ev as any);
            }
          }
          upserted++;
        }
      }
    }

    return new Response(
      JSON.stringify({ fetched: allRaw.length, deduped: events.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-ff-calendar error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

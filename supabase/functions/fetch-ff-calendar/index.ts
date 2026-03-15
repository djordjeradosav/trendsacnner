import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FF_URLS = [
  "https://nfs.faireconomy.media/ff_calendar_lastweek.json",
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
];

function isDST(date: Date): boolean {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  const stdOffset = Math.max(jan, jul);
  return date.getTimezoneOffset() < stdOffset;
}

function parseFFDateTime(dateStr: string, timeStr: string): { scheduledAt: string; isTentative: boolean } {
  // dateStr: "2026-03-15T21:00:00-04:00" or similar ISO from FF
  // timeStr: "10:30pm", "1:15am", "All Day", "Tentative", ""
  
  if (!timeStr || timeStr === "All Day" || timeStr === "Tentative" || timeStr === "") {
    // Use the date part only, set to midnight UTC
    const d = new Date(dateStr);
    return { scheduledAt: d.toISOString(), isTentative: !timeStr || timeStr === "Tentative" };
  }

  // Parse the date portion
  const baseDate = new Date(dateStr);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();

  // Parse time like "10:30pm", "1:15am"
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!match) {
    return { scheduledAt: baseDate.toISOString(), isTentative: true };
  }

  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const ampm = match[3].toLowerCase();

  if (ampm === "pm" && hours !== 12) hours += 12;
  if (ampm === "am" && hours === 12) hours = 0;

  // FF times are US/Eastern. Determine offset.
  const estDate = new Date(year, month, day, hours, mins);
  const offsetHours = isDST(estDate) ? 4 : 5; // EDT = UTC-4, EST = UTC-5
  
  // Create UTC time by adding the offset
  const utc = new Date(Date.UTC(year, month, day, hours + offsetHours, mins));

  return { scheduledAt: utc.toISOString(), isTentative: false };
}

function normalizeImpact(impact: string): string {
  const lower = (impact || "low").toLowerCase();
  if (["high", "medium", "low", "holiday"].includes(lower)) return lower;
  // Map "Non-Economic" or other values
  if (lower.includes("holiday") || lower.includes("non-economic")) return "holiday";
  return "low";
}

function nullIfEmpty(val: string | null | undefined): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch all 3 feeds in parallel
    const responses = await Promise.allSettled(
      FF_URLS.map((url) => fetch(url).then((r) => r.json()))
    );

    const allRaw: any[] = [];
    for (const res of responses) {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        allRaw.push(...res.value);
      }
    }

    // Deduplicate by title+date+currency
    const seen = new Set<string>();
    const events: any[] = [];

    for (const item of allRaw) {
      const { scheduledAt, isTentative } = parseFFDateTime(item.date, item.time);
      const key = `${item.title}|${scheduledAt}|${item.currency || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      events.push({
        event_name: item.title || "Unknown",
        country: nullIfEmpty(item.country),
        currency: nullIfEmpty(item.currency),
        impact: normalizeImpact(item.impact),
        scheduled_at: scheduledAt,
        forecast: nullIfEmpty(item.forecast),
        previous: nullIfEmpty(item.previous),
        actual: nullIfEmpty(item.actual),
        is_tentative: isTentative,
      });
    }

    let upserted = 0;
    if (events.length > 0) {
      // Batch in chunks of 500
      for (let i = 0; i < events.length; i += 500) {
        const chunk = events.slice(i, i + 500);
        const { error } = await sb
          .from("economic_events")
          .upsert(chunk, {
            onConflict: "event_name,scheduled_at,currency",
            ignoreDuplicates: false,
          });
        if (error) console.error("Upsert error:", error);
        else upserted += chunk.length;
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

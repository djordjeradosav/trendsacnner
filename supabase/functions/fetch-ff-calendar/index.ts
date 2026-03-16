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

// Is a given date in US Eastern Daylight Time?
function isEDT(date: Date): boolean {
  const year = date.getFullYear();
  // EDT starts: 2nd Sunday of March at 2am
  const march = new Date(year, 2, 1);
  const firstSundayMarch = (7 - march.getDay()) % 7;
  const edtStart = new Date(year, 2, firstSundayMarch + 8, 2, 0, 0);
  // EDT ends: 1st Sunday of November at 2am
  const nov = new Date(year, 10, 1);
  const firstSundayNov = (7 - nov.getDay()) % 7;
  const edtEnd = new Date(year, 10, firstSundayNov + 1, 2, 0, 0);
  return date >= edtStart && date < edtEnd;
}

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
      const isTentative = !ev.time || ev.time === "Tentative" || ev.time === "All Day";
      let scheduledAt: string | null = null;

      if (ev.date) {
        // FF date format: "2026-03-15T21:00:00-04:00" (ISO with offset)
        // or sometimes "03-15-2026" (MM-DD-YYYY)
        let year: number, month: number, day: number;

        if (ev.date.includes("T")) {
          // ISO format
          const d = new Date(ev.date);
          year = d.getFullYear();
          month = d.getMonth();
          day = d.getDate();
        } else {
          // MM-DD-YYYY format
          const parts = ev.date.split("-");
          if (parts.length === 3) {
            month = parseInt(parts[0], 10) - 1;
            day = parseInt(parts[1], 10);
            year = parseInt(parts[2], 10);
          } else {
            continue; // skip unparseable
          }
        }

        if (!isTentative && ev.time) {
          const timeMatch = ev.time.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const ampm = timeMatch[3].toLowerCase();
            if (ampm === "pm" && hours !== 12) hours += 12;
            if (ampm === "am" && hours === 12) hours = 0;

            // FF times are US/Eastern
            const estDate = new Date(year, month, day);
            const offset = isEDT(estDate) ? 4 : 5;

            scheduledAt = new Date(
              Date.UTC(year, month, day, hours + offset, minutes)
            ).toISOString();
          } else {
            // Unparseable time — use midnight UTC
            scheduledAt = new Date(Date.UTC(year, month, day, 12, 0)).toISOString();
          }
        } else {
          // Tentative/All Day — use noon UTC so it sorts mid-day
          scheduledAt = new Date(Date.UTC(year, month, day, 12, 0)).toISOString();
        }
      }

      if (!scheduledAt) continue;

      const key = `${(ev.title || "").trim()}|${scheduledAt}|${(ev.currency || "").trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      events.push({
        event_name: (ev.title || "Unknown Event").trim(),
        country: nullIfEmpty(ev.country),
        currency: nullIfEmpty(ev.currency),
        impact: normalizeImpact(ev.impact || "low"),
        scheduled_at: scheduledAt,
        forecast: nullIfEmpty(ev.forecast),
        previous: nullIfEmpty(ev.previous),
        actual: nullIfEmpty(ev.actual),
        is_tentative: isTentative,
      });
    }

    console.log(`Deduped to ${events.length} events`);

    let upserted = 0;
    if (events.length > 0) {
      for (let i = 0; i < events.length; i += 500) {
        const chunk = events.slice(i, i + 500);
        const { error } = await sb
          .from("economic_events")
          .upsert(chunk as any, {
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

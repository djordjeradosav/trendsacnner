import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Scheduled scan — delegates to fast-scan for each timeframe.
 * Runs via pg_cron every 15 minutes.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const timeframes = ["5min", "15min", "1h", "4h", "1day"];
  const results: Record<string, any> = {};
  const startTime = Date.now();

  for (const tf of timeframes) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/fast-scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ timeframe: tf }),
      });
      const data = await res.json();
      results[tf] = { status: res.status, scored: data.scored ?? 0, avg: data.avgScore ?? 0 };
      console.log(`Scheduled scan TF ${tf}: scored=${data.scored}, avg=${data.avgScore}`);
    } catch (err) {
      console.error(`Scheduled scan TF ${tf} failed:`, err);
      results[tf] = { status: 500, error: String(err) };
    }
  }

  const duration = Date.now() - startTime;
  console.log("Scheduled scan complete:", duration, "ms", JSON.stringify(results));

  return new Response(JSON.stringify({ success: true, durationMs: duration, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

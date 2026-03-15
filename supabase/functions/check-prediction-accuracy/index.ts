import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find predictions that haven't been checked yet
    const { data: unchecked } = await sb
      .from("event_predictions")
      .select("*")
      .is("was_correct", null)
      .order("scheduled_at", { ascending: false })
      .limit(50);

    if (!unchecked || unchecked.length === 0) {
      return new Response(JSON.stringify({ message: "No predictions to check" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const pred of unchecked) {
      // Find corresponding event with actual
      const { data: events } = await sb
        .from("economic_events")
        .select("actual, forecast")
        .eq("event_name", pred.event_name)
        .eq("currency", pred.currency || "")
        .eq("scheduled_at", pred.scheduled_at)
        .not("actual", "is", null)
        .limit(1);

      if (!events || events.length === 0) continue;

      const evt = events[0];
      const actual = parseFloat((evt.actual || "").replace(/[^0-9.\-]/g, ""));
      const forecast = parseFloat((evt.forecast || "").replace(/[^0-9.\-]/g, ""));

      if (isNaN(actual) || isNaN(forecast)) continue;

      let actualOutcome: string;
      const diff = Math.abs(actual - forecast);
      const threshold = Math.abs(forecast) * 0.02 || 0.05;

      if (actual > forecast + threshold) actualOutcome = "beat";
      else if (actual < forecast - threshold) actualOutcome = "miss";
      else actualOutcome = "inline";

      const predicted = pred.prediction?.prediction || "inline";
      const wasCorrect = predicted === actualOutcome;

      // Check if reaction data confirms direction prediction
      let reactionMatch: boolean | null = null;
      const { data: reactionData } = await sb
        .from("event_reactions")
        .select("pair_symbol, change_60m, direction, pips_move")
        .eq("event_id", pred.id)
        .limit(10);

      if (reactionData && reactionData.length > 0) {
        const primaryReaction = reactionData[0];
        const predictedDir = pred.prediction?.primaryScenario?.direction;
        if (predictedDir && primaryReaction.direction) {
          const dirMatches =
            (predictedDir === "bullish" && primaryReaction.direction === "up") ||
            (predictedDir === "bearish" && primaryReaction.direction === "down");
          reactionMatch = dirMatches;
        }
      }

      await sb
        .from("event_predictions")
        .update({ was_correct: wasCorrect, actual_outcome: actualOutcome })
        .eq("id", pred.id);

      results.push({
        event: pred.event_name,
        predicted,
        actual: actualOutcome,
        correct: wasCorrect,
        reactionMatch,
        reactions: reactionData?.length || 0,
      });
    }

    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-prediction-accuracy error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

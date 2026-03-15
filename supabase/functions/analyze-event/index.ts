import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { event_name, currency, forecast, previous, history } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Check cache (< 6 hours old)
    const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
    const { data: cached } = await sb
      .from("event_analyses")
      .select("analysis")
      .eq("event_name", event_name)
      .eq("currency", currency || "")
      .gte("created_at", sixHoursAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (cached && cached.length > 0) {
      return new Response(JSON.stringify({ scenarios: cached[0].analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const historyStr = (history || []).join(", ") || "No history available";

    const prompt = `Event: ${event_name} (${currency})
Forecast: ${forecast || "N/A"}, Previous: ${previous || "N/A"}
Last actuals: ${historyStr}

Provide exactly 3 scenarios as a JSON array:
[
  { "scenario": "Beat", "condition": "If actual > forecast", "probability": "35%", "impact": "Bullish for ${currency}", "pairsToWatch": [], "expectedMove": "+0.3% to +0.6%" },
  { "scenario": "In-line", "condition": "If actual ≈ forecast", "probability": "30%", "impact": "Muted reaction", "pairsToWatch": [], "expectedMove": "±0.1%" },
  { "scenario": "Miss", "condition": "If actual < forecast", "probability": "35%", "impact": "Bearish for ${currency}", "pairsToWatch": [], "expectedMove": "-0.3% to -0.6%" }
]
Fill in realistic probabilities, pairs, and expected moves based on the data.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a macro analyst. Return ONLY a JSON array of 3 scenarios. No markdown, no explanation." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429 || status === 402) {
        return new Response(JSON.stringify({ error: status === 429 ? "Rate limited" : "Payment required" }), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    // Parse JSON from response (handle markdown code blocks)
    let scenarios;
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      scenarios = JSON.parse(cleaned);
    } catch {
      scenarios = [
        { scenario: "Beat", condition: `If actual > ${forecast || "forecast"}`, probability: "35%", impact: `Bullish for ${currency}`, pairsToWatch: [], expectedMove: "+0.3%" },
        { scenario: "In-line", condition: `If actual ≈ ${forecast || "forecast"}`, probability: "30%", impact: "Muted reaction", pairsToWatch: [], expectedMove: "±0.1%" },
        { scenario: "Miss", condition: `If actual < ${forecast || "forecast"}`, probability: "35%", impact: `Bearish for ${currency}`, pairsToWatch: [], expectedMove: "-0.3%" },
      ];
    }

    // Cache
    await sb.from("event_analyses").insert({
      event_name,
      currency: currency || "",
      analysis: scenarios,
    });

    return new Response(JSON.stringify({ scenarios }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-event error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

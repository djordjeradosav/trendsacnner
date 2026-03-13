import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { pairId, timeframe = "1h" } = await req.json();
    if (!pairId) throw new Error("pairId is required");

    // Check cache — skip if last analysis < 60 min ago
    const { data: cached } = await supabase
      .from("pair_analyses")
      .select("analysis, created_at")
      .eq("pair_id", pairId)
      .eq("timeframe", timeframe)
      .order("created_at", { ascending: false })
      .limit(1);

    if (cached && cached.length > 0) {
      const age = Date.now() - new Date(cached[0].created_at).getTime();
      if (age < 60 * 60 * 1000) {
        return new Response(JSON.stringify({
          analysis: cached[0].analysis,
          created_at: cached[0].created_at,
          cached: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 1. Read pair info + latest score
    const { data: score } = await supabase
      .from("scores")
      .select("*, pairs(symbol, name, category)")
      .eq("pair_id", pairId)
      .eq("timeframe", timeframe)
      .limit(1)
      .single();

    if (!score) throw new Error("No score data for this pair. Run a scan first.");

    // 2. Read score history
    const { data: history } = await supabase
      .from("scores")
      .select("score, scanned_at")
      .eq("pair_id", pairId)
      .order("scanned_at", { ascending: false })
      .limit(10);

    const scoreTrend = history
      ? [...history].reverse().map((h) => h.score).join(" → ")
      : String(score.score);

    const scores = history ? history.map((h) => Number(h.score)) : [Number(score.score)];
    const first = scores[scores.length - 1];
    const last = scores[0];
    const trendDir = last > first + 5 ? "improving" : last < first - 5 ? "deteriorating" : "stable";

    const pair = score.pairs as any;
    const emaStack =
      Number(score.ema20) > Number(score.ema50) && Number(score.ema50) > Number(score.ema200)
        ? "bullish stack"
        : Number(score.ema20) < Number(score.ema50) && Number(score.ema50) < Number(score.ema200)
          ? "bearish stack"
          : "mixed";

    // 3. Call Lovable AI
    const userMessage = `Pair: ${pair.symbol} (${pair.name})
Timeframe: ${timeframe}
Composite score: ${score.score}/100 → ${score.trend}
Score trend: ${scoreTrend} (${trendDir})
Indicators: EMA20=${Number(score.ema20).toFixed(4)}, EMA50=${Number(score.ema50).toFixed(4)}, EMA200=${Number(score.ema200).toFixed(4)}, ADX=${Number(score.adx).toFixed(1)}, RSI=${Number(score.rsi).toFixed(1)}, MACD hist=${Number(score.macd_hist).toFixed(5)}
EMA alignment: ${emaStack}

Provide JSON: { "summary": "...", "bias": "bullish"|"neutral"|"bearish", "keyLevel": "...", "risk": "..." }`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a technical analyst. Be concise and precise. Max 3 sentences per section. Always respond with valid JSON only, no markdown fences." },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error [${aiResponse.status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content ?? "";

    let analysis;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { summary: rawContent, bias: "neutral", keyLevel: "", risk: "" };
    }

    // 4. Store
    const now = new Date().toISOString();
    await supabase.from("pair_analyses").insert({
      pair_id: pairId,
      timeframe,
      analysis,
    });

    return new Response(JSON.stringify({ analysis, created_at: now, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-pair error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

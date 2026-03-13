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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { timeframe = "1h" } = await req.json().catch(() => ({}));

    // 1. Read latest scores with pair info
    const { data: scores, error: scErr } = await supabase
      .from("scores")
      .select("score, trend, pair_id, scanned_at, pairs(symbol, name, category)")
      .eq("timeframe", timeframe)
      .order("score", { ascending: false });

    if (scErr) throw new Error(`Scores query failed: ${scErr.message}`);
    if (!scores || scores.length === 0) {
      return new Response(JSON.stringify({ error: "No scan data available. Run a scan first." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Compute aggregates
    const totalPairs = scores.length;
    const avgScore = Math.round((scores.reduce((s, r) => s + Number(r.score), 0) / totalPairs) * 10) / 10;
    const bullish = scores.filter((s) => s.trend === "bullish");
    const bearish = scores.filter((s) => s.trend === "bearish");
    const neutral = scores.filter((s) => s.trend === "neutral");

    const top10 = scores.slice(0, 10);
    const bottom10 = [...scores].sort((a, b) => Number(a.score) - Number(b.score)).slice(0, 10);

    // Sector averages
    const sectorMap: Record<string, { sum: number; count: number }> = {};
    scores.forEach((s: any) => {
      const cat = s.pairs?.category ?? "Unknown";
      if (!sectorMap[cat]) sectorMap[cat] = { sum: 0, count: 0 };
      sectorMap[cat].sum += Number(s.score);
      sectorMap[cat].count++;
    });
    const sectorAvgs = Object.entries(sectorMap)
      .map(([name, { sum, count }]) => `${name}: ${(sum / count).toFixed(1)}`)
      .join(", ");

    const formatPairList = (list: any[]) =>
      list.map((s: any) => `${s.pairs?.symbol ?? "?"} (${s.score})`).join(", ");

    const timestamp = new Date().toISOString();

    // 3. Call Lovable AI
    const userMessage = `Current scan data (${timeframe} timeframe, ${timestamp}):

Overall market score: ${avgScore}/100
Total pairs: ${totalPairs} (${bullish.length} bullish, ${neutral.length} neutral, ${bearish.length} bearish)

Top 10 bullish pairs: ${formatPairList(top10)}

Bottom 10 bearish pairs: ${formatPairList(bottom10)}

Sector averages: ${sectorAvgs}

Provide:
1. A 3-sentence macro overview
2. Key themes (comma-separated, max 5, e.g. 'USD strength, risk-off, metals bid')
3. Three specific pairs to watch with one-sentence reason each
4. One contrarian observation (a pair that looks anomalous vs its sector)

Respond in JSON: { "overview": "...", "themes": ["..."], "watchPairs": [{"symbol": "...", "reason": "..."}], "contrarian": "..." }`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a professional FX and futures market analyst. Given scan data from a trend-following system, provide a concise, actionable market brief. Be direct and specific. No fluff. Always respond with valid JSON only, no markdown fences.",
          },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error [${aiResponse.status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content ?? "";

    // Parse JSON from response (strip markdown fences if present)
    let brief;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      brief = JSON.parse(cleaned);
    } catch {
      brief = {
        overview: rawContent,
        themes: [],
        watchPairs: [],
        contrarian: "",
      };
    }

    // 4. Store in market_briefs
    const { error: insertErr } = await supabase.from("market_briefs").insert({
      brief,
      timeframe,
      scan_score_avg: avgScore,
    });
    if (insertErr) console.error("Failed to store brief:", insertErr.message);

    return new Response(JSON.stringify({ brief, avgScore, timestamp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-market-brief error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

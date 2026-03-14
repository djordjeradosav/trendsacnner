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

    // Check cache — skip if last briefing < 60 min ago
    const { data: cached } = await supabase
      .from("daily_briefings")
      .select("id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    if (cached && cached.length > 0) {
      const age = Date.now() - new Date(cached[0].created_at).getTime();
      if (age < 60 * 60 * 1000) {
        return new Response(JSON.stringify({
          content: cached[0].content,
          created_at: cached[0].created_at,
          cached: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Get top 3 news articles
    const { data: news } = await supabase
      .from("news_articles")
      .select("headline, summary, source, sentiment, relevant_pairs")
      .order("published_at", { ascending: false })
      .limit(3);

    // Get market summary from latest scores
    const { data: scores } = await supabase
      .from("scores")
      .select("score, trend, pairs(symbol)")
      .order("scanned_at", { ascending: false })
      .limit(20);

    // Build market summary
    let marketSummary = "No scan data available yet.";
    if (scores && scores.length > 0) {
      const avgScore = scores.reduce((s, r) => s + Number(r.score), 0) / scores.length;
      const bullish = scores.filter((s) => s.trend === "bullish").length;
      const bearish = scores.filter((s) => s.trend === "bearish").length;
      const neutral = scores.length - bullish - bearish;
      marketSummary = `Average score: ${avgScore.toFixed(0)}/100. ${bullish} bullish, ${neutral} neutral, ${bearish} bearish out of ${scores.length} scanned pairs.`;
    }

    const newsBlock = (news && news.length > 0)
      ? news.map((n, i) => `${i + 1}. [${n.sentiment}] ${n.headline} (${n.source})`).join("\n")
      : "No recent news available.";

    const prompt = `Given these market news headlines:\n${newsBlock}\n\nAnd our trend scan data showing: ${marketSummary}\n\nWrite a concise 4-sentence pre-session briefing for a trader. Start with the most impactful market theme. Mention 2 specific instruments. End with one key risk. No bullet points.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a senior market analyst writing a pre-session briefing. Be direct, specific, and actionable. Write in a professional but accessible tone." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error [${status}]`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content ?? "";

    if (!content) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store briefing
    await supabase.from("daily_briefings").insert({ content });

    // Clean old briefings (keep last 24)
    const { data: old } = await supabase
      .from("daily_briefings")
      .select("id")
      .order("created_at", { ascending: false })
      .range(24, 1000);
    if (old && old.length > 0) {
      await supabase.from("daily_briefings").delete().in("id", old.map((r) => r.id));
    }

    return new Response(JSON.stringify({ content, created_at: new Date().toISOString(), cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-briefing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Allow manual trigger with specific event, or auto-find upcoming events
    let events: any[] = [];
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (body.event_name && body.currency && body.scheduled_at) {
      // Manual trigger for specific event
      events = [{
        event_name: body.event_name,
        currency: body.currency,
        scheduled_at: body.scheduled_at,
        forecast: body.forecast,
        previous: body.previous,
        impact: body.impact || "high",
      }];
    } else {
      // Auto: find HIGH impact events in the next 2 hours without predictions
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 3600 * 1000);

      const { data: upcoming } = await sb
        .from("economic_events")
        .select("*")
        .eq("impact", "high")
        .is("actual", null)
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", twoHoursFromNow.toISOString());

      if (!upcoming || upcoming.length === 0) {
        return new Response(JSON.stringify({ message: "No upcoming high-impact events" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Filter out events that already have predictions
      for (const evt of upcoming) {
        const { data: existing } = await sb
          .from("event_predictions")
          .select("id")
          .eq("event_name", evt.event_name)
          .eq("currency", evt.currency || "")
          .eq("scheduled_at", evt.scheduled_at)
          .limit(1);

        if (!existing || existing.length === 0) {
          events.push(evt);
        }
      }
    }

    if (events.length === 0) {
      return new Response(JSON.stringify({ message: "All upcoming events already have predictions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const evt of events) {
      try {
        const prediction = await generatePrediction(sb, evt, LOVABLE_API_KEY);
        results.push({ event: evt.event_name, currency: evt.currency, prediction });
      } catch (e) {
        console.error(`Failed prediction for ${evt.event_name}:`, e);
        results.push({ event: evt.event_name, error: e.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-event-prediction error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generatePrediction(sb: any, evt: any, apiKey: string) {
  // 1. Historical actuals (last 12 months)
  const twelveMonthsAgo = new Date(Date.now() - 365 * 86400 * 1000).toISOString();
  const { data: historicals } = await sb
    .from("economic_events")
    .select("actual, forecast, scheduled_at")
    .eq("event_name", evt.event_name)
    .eq("currency", evt.currency || "")
    .not("actual", "is", null)
    .gte("scheduled_at", twelveMonthsAgo)
    .order("scheduled_at", { ascending: false })
    .limit(12);

  const actuals = (historicals || []).map((h: any) => h.actual).filter(Boolean);
  const forecasts = (historicals || []).map((h: any) => h.forecast).filter(Boolean);

  // Compute beat rate
  let beatCount = 0, missCount = 0, inlineCount = 0;
  for (const h of (historicals || [])) {
    const a = parseFloat((h.actual || "").replace(/[^0-9.\-]/g, ""));
    const f = parseFloat((h.forecast || "").replace(/[^0-9.\-]/g, ""));
    if (isNaN(a) || isNaN(f)) continue;
    if (a > f) beatCount++;
    else if (a < f) missCount++;
    else inlineCount++;
  }
  const total = beatCount + missCount + inlineCount;
  const beatRate = total > 0 ? Math.round((beatCount / total) * 100) : 50;

  // Trend: compare first 3 vs last 3 actuals
  const nums = actuals.map((a: string) => parseFloat(a.replace(/[^0-9.\-]/g, ""))).filter((n: number) => !isNaN(n));
  let trendDir = "flat";
  if (nums.length >= 6) {
    const recent3 = nums.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3;
    const older3 = nums.slice(3, 6).reduce((a: number, b: number) => a + b, 0) / 3;
    if (recent3 > older3 * 1.02) trendDir = "up";
    else if (recent3 < older3 * 0.98) trendDir = "down";
  }

  // 2. News sentiment (last 24h)
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: newsData } = await sb
    .from("news_articles")
    .select("sentiment, headline")
    .gte("published_at", dayAgo)
    .order("published_at", { ascending: false })
    .limit(20);

  const news = newsData || [];
  // Filter to relevant currency
  const currency = (evt.currency || "").toUpperCase();
  const relevantNews = news.filter((n: any) => {
    const h = (n.headline || "").toUpperCase();
    return h.includes(currency) || h.includes(currency === "USD" ? "DOLLAR" : currency === "EUR" ? "EURO" : currency === "GBP" ? "POUND" : currency === "JPY" ? "YEN" : currency);
  });

  const posNews = relevantNews.filter((n: any) => n.sentiment === "positive").length;
  const negNews = relevantNews.filter((n: any) => n.sentiment === "negative").length;
  const newsSentiment = posNews > negNews ? "positive" : negNews > posNews ? "negative" : "neutral";

  // 3. Social sentiment (last 4h)
  const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
  const { data: socialData } = await sb
    .from("social_sentiment")
    .select("sentiment")
    .gte("fetched_at", fourHoursAgo)
    .limit(50);

  const social = socialData || [];
  const bullish = social.filter((s: any) => s.sentiment === "bullish").length;
  const bearish = social.filter((s: any) => s.sentiment === "bearish").length;
  const socialSentiment = bullish > bearish ? "bullish" : bearish > bullish ? "bearish" : "neutral";

  // 4. Central bank language
  const { data: cbNews } = await sb
    .from("news_articles")
    .select("headline")
    .gte("published_at", new Date(Date.now() - 7 * 86400 * 1000).toISOString())
    .limit(50);

  const cbTexts = (cbNews || []).map((n: any) => (n.headline || "").toLowerCase()).join(" ");
  const hawkishCount = (cbTexts.match(/hawkish|rate hike|tighten/g) || []).length;
  const dovishCount = (cbTexts.match(/dovish|rate cut|easing|accommodative/g) || []).length;
  const cbLanguage = hawkishCount > dovishCount ? "hawkish" : dovishCount > hawkishCount ? "dovish" : "neutral";

  // 5. Historical reaction data from event_reactions
  const { data: pastReactions } = await sb
    .from("event_reactions")
    .select("pair_symbol, change_60m, beat_miss, pips_move, direction")
    .eq("beat_miss", "beat")
    .limit(50);

  const reactionsByPair: Record<string, { beatAvg: number; missAvg: number; count: number }> = {};
  if (pastReactions) {
    for (const r of pastReactions) {
      if (!reactionsByPair[r.pair_symbol]) reactionsByPair[r.pair_symbol] = { beatAvg: 0, missAvg: 0, count: 0 };
      reactionsByPair[r.pair_symbol].beatAvg += r.change_60m || 0;
      reactionsByPair[r.pair_symbol].count++;
    }
    for (const pair of Object.keys(reactionsByPair)) {
      if (reactionsByPair[pair].count > 0) {
        reactionsByPair[pair].beatAvg = reactionsByPair[pair].beatAvg / reactionsByPair[pair].count;
      }
    }
  }

  const reactionContext = Object.entries(reactionsByPair)
    .slice(0, 5)
    .map(([pair, data]) => `${pair} moves avg ${data.beatAvg > 0 ? "+" : ""}${data.beatAvg.toFixed(3)}% on beats (${data.count} samples)`)
    .join("; ");

  // Build prompt
  const prompt = `Event: ${evt.event_name} (${currency})
Scheduled: ${evt.scheduled_at}
Forecast: ${evt.forecast || "N/A"}
Previous: ${evt.previous || "N/A"}
Last 12 actuals: ${actuals.join(", ") || "No history"}
Beat rate: ${beatRate}% (${beatCount}/${total})
Trending: ${trendDir} based on 3-month average
News sentiment last 24h: ${newsSentiment}, ${relevantNews.length} articles
Social sentiment: ${socialSentiment}, ${social.length} mentions
Recent central bank language: ${cbLanguage}

Provide your analysis in this exact JSON (no markdown, no explanation):
{
  "prediction": "beat" or "miss" or "inline",
  "confidence": 0-100,
  "predictedValue": "specific number",
  "reasoning": "3 sentences max citing specific data points",
  "primaryScenario": {
    "label": "Beat" or "Miss" or "Inline",
    "probability": "45%",
    "expectedMove": "+0.35% to +0.55% on relevant pair",
    "pairsToWatch": ["PAIR1","PAIR2"],
    "direction": "bullish" or "bearish"
  },
  "altScenario": {
    "label": "Miss" or "Beat",
    "probability": "35%",
    "expectedMove": "-0.4% to -0.7% on relevant pair",
    "pairsToWatch": ["PAIR1"],
    "direction": "bearish" or "bullish"
  },
  "keyRisk": "one sentence what could make this prediction wrong",
  "analystConsensus": "above forecast" or "at forecast" or "below forecast" or "mixed",
  "dataSignals": {
    "beatRate": "${beatRate}%",
    "beatCount": ${beatCount},
    "totalReleases": ${total},
    "newsSentiment": "${newsSentiment}",
    "newsCount": ${relevantNews.length},
    "socialSentiment": "${socialSentiment}",
    "socialCount": ${social.length},
    "cbLanguage": "${cbLanguage}",
    "trendDirection": "${trendDir}"
  }
}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: "You are a professional macro analyst generating pre-release forecasts. Be specific with numbers. Base analysis on data provided, not general knowledge. Return ONLY valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const status = response.status;
    throw new Error(`AI gateway error: ${status}`);
  }

  const aiData = await response.json();
  const content = aiData.choices?.[0]?.message?.content || "{}";

  let prediction;
  try {
    const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    prediction = JSON.parse(cleaned);
  } catch {
    prediction = {
      prediction: "inline",
      confidence: 50,
      predictedValue: evt.forecast || "N/A",
      reasoning: "Unable to parse AI response. Defaulting to inline prediction.",
      primaryScenario: { label: "Inline", probability: "40%", expectedMove: "±0.1%", pairsToWatch: [], direction: "neutral" },
      altScenario: { label: "Beat", probability: "30%", expectedMove: "+0.2%", pairsToWatch: [], direction: "bullish" },
      keyRisk: "Unparseable AI response",
      analystConsensus: "at forecast",
      dataSignals: { beatRate: `${beatRate}%`, beatCount, totalReleases: total, newsSentiment, newsCount: relevantNews.length, socialSentiment, socialCount: social.length, cbLanguage, trendDirection: trendDir },
    };
  }

  // Store prediction
  await sb.from("event_predictions").upsert({
    event_name: evt.event_name,
    currency: evt.currency || "",
    scheduled_at: evt.scheduled_at,
    prediction,
  }, { onConflict: "event_name,currency,scheduled_at" });

  return prediction;
}

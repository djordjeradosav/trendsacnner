import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, scanContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build context from scan data
    let contextBlock = "";
    if (scanContext) {
      const { topPairs, sectorAverages, overallScore, timeframe, timestamp } = scanContext;

      contextBlock += `Current data (${timestamp}, ${timeframe} timeframe):\n`;
      contextBlock += `Overall market score: ${overallScore}/100\n\n`;

      if (topPairs?.length) {
        contextBlock += "Top pairs:\n";
        contextBlock += "Symbol       | Score | Trend\n";
        contextBlock += "-------------|-------|--------\n";
        topPairs.forEach((p: any) => {
          contextBlock += `${p.symbol.padEnd(13)}| ${String(p.score).padEnd(6)}| ${p.trend}\n`;
        });
        contextBlock += "\n";
      }

      if (sectorAverages) {
        contextBlock += "Sector averages: ";
        contextBlock += Object.entries(sectorAverages)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        contextBlock += "\n";
      }
    }

    const systemPrompt = `You are TrendScan AI, a trading assistant with access to live market scan data.\n\n${contextBlock}\nAnswer questions about the market based on this data. Be concise and specific. Use numbers from the data. If asked about a specific pair, look it up in the data. Format responses with markdown for readability.`;

    // Keep last 10 messages
    const trimmedMessages = (messages || []).slice(-10);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...trimmedMessages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

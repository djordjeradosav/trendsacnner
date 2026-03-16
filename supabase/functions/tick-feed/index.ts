import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // This edge function proxies WebSocket connections to Twelve Data.
  // Since Deno Deploy edge functions don't support long-lived WebSocket upgrades well,
  // we instead provide an SSE-based polling approach for live prices.

  const TWELVE_DATA_KEY = Deno.env.get("TWELVE_DATA_API_KEY");
  if (!TWELVE_DATA_KEY) {
    return new Response(JSON.stringify({ error: "TWELVE_DATA_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const symbols = url.searchParams.get("symbols");

  if (!symbols) {
    return new Response(JSON.stringify({ error: "symbols parameter required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use Twelve Data REST price endpoint for batch quotes
  try {
    const tdUrl = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbols)}&apikey=${TWELVE_DATA_KEY}`;
    const tdRes = await fetch(tdUrl);
    const data = await tdRes.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map currency to affected pairs
const CURRENCY_PAIRS: Record<string, string[]> = {
  USD: ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD"],
  EUR: ["EURUSD", "EURGBP", "EURJPY"],
  GBP: ["GBPUSD", "EURGBP", "GBPJPY"],
  JPY: ["USDJPY", "EURJPY", "GBPJPY"],
  AUD: ["AUDUSD"],
  CAD: ["USDCAD"],
  CHF: ["USDCHF"],
  NZD: ["NZDUSD"],
};

// Pip multipliers for different pair types
const PIP_MULTIPLIER: Record<string, number> = {
  USDJPY: 100,
  EURJPY: 100,
  GBPJPY: 100,
  XAUUSD: 10,
  XAGUSD: 100,
};
const DEFAULT_PIP_MULT = 10000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find HIGH/MEDIUM impact events that released 60-90 min ago without reactions
    const now = new Date();
    const minAgo90 = new Date(now.getTime() - 90 * 60 * 1000).toISOString();
    const minAgo60 = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const { data: events } = await sb
      .from("economic_events")
      .select("*")
      .in("impact", ["high", "medium"])
      .not("actual", "is", null)
      .gte("scheduled_at", minAgo90)
      .lte("scheduled_at", minAgo60);

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: "No events to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const evt of events) {
      // Check if reactions already exist for this event
      const { data: existing } = await sb
        .from("event_reactions")
        .select("id")
        .eq("event_id", evt.id)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const currency = (evt.currency || "USD").toUpperCase();
      const pairs = CURRENCY_PAIRS[currency] || ["EURUSD"];
      const releaseTime = new Date(evt.scheduled_at);

      // Determine beat/miss
      const actual = parseFloat((evt.actual || "").replace(/[^0-9.\-]/g, ""));
      const forecast = parseFloat((evt.forecast || "").replace(/[^0-9.\-]/g, ""));
      let beatMiss = "inline";
      let surprise = 0;
      if (!isNaN(actual) && !isNaN(forecast)) {
        surprise = actual - forecast;
        const threshold = Math.abs(forecast) * 0.02 || 0.05;
        if (actual > forecast + threshold) beatMiss = "beat";
        else if (actual < forecast - threshold) beatMiss = "miss";
      }

      for (const pairSymbol of pairs) {
        try {
          // Find pair_id
          const { data: pairData } = await sb
            .from("pairs")
            .select("id")
            .eq("symbol", pairSymbol)
            .limit(1);

          if (!pairData || pairData.length === 0) continue;
          const pairId = pairData[0].id;

          // Get candles around the release time (1h before to 1.5h after)
          const candleStart = new Date(releaseTime.getTime() - 60 * 60 * 1000).toISOString();
          const candleEnd = new Date(releaseTime.getTime() + 90 * 60 * 1000).toISOString();

          const { data: candles } = await sb
            .from("candles")
            .select("close, high, low, ts")
            .eq("pair_id", pairId)
            .eq("timeframe", "15min")
            .gte("ts", candleStart)
            .lte("ts", candleEnd)
            .order("ts", { ascending: true });

          if (!candles || candles.length < 2) {
            // Try 1h timeframe as fallback
            const { data: hourCandles } = await sb
              .from("candles")
              .select("close, high, low, ts")
              .eq("pair_id", pairId)
              .eq("timeframe", "1h")
              .gte("ts", candleStart)
              .lte("ts", candleEnd)
              .order("ts", { ascending: true });

            if (!hourCandles || hourCandles.length < 2) continue;

            // Use 1h candles — less granular but still useful
            const releaseCandle = findClosestCandle(hourCandles, releaseTime);
            if (!releaseCandle) continue;

            const priceAtRelease = releaseCandle.close;
            const afterCandles = hourCandles.filter(
              (c: any) => new Date(c.ts) > releaseTime
            );

            const price60m = afterCandles.length > 0 ? afterCandles[0].close : priceAtRelease;
            const allPricesAfter = afterCandles.map((c: any) => c.close);
            const maxHigh = Math.max(...afterCandles.map((c: any) => c.high), priceAtRelease);
            const minLow = Math.min(...afterCandles.map((c: any) => c.low), priceAtRelease);

            const change60m = ((price60m - priceAtRelease) / priceAtRelease) * 100;
            const maxMoveUp = ((maxHigh - priceAtRelease) / priceAtRelease) * 100;
            const maxMoveDown = ((minLow - priceAtRelease) / priceAtRelease) * 100;
            const maxMove = Math.abs(maxMoveUp) > Math.abs(maxMoveDown) ? maxMoveUp : maxMoveDown;
            const direction = price60m > priceAtRelease ? "up" : "down";
            const pipMult = PIP_MULTIPLIER[pairSymbol] || DEFAULT_PIP_MULT;
            const pipsMove = Math.abs(price60m - priceAtRelease) * pipMult;

            await sb.from("event_reactions").insert({
              event_id: evt.id,
              pair_symbol: pairSymbol,
              actual_value: evt.actual,
              forecast_value: evt.forecast,
              surprise,
              beat_miss: beatMiss,
              price_at_release: priceAtRelease,
              change_15m: change60m * 0.3, // estimate
              change_30m: change60m * 0.6,
              change_60m: change60m,
              max_move_60m: maxMove,
              direction,
              pips_move: Math.round(pipsMove * 10) / 10,
            });

            results.push({ pair: pairSymbol, event: evt.event_name, pips: pipsMove.toFixed(1) });
            continue;
          }

          // 15m candles available — use them directly
          const releaseCandle = findClosestCandle(candles, releaseTime);
          if (!releaseCandle) continue;

          const releaseIdx = candles.indexOf(releaseCandle);
          const priceAtRelease = releaseCandle.close;

          const get = (offset: number) =>
            releaseIdx + offset < candles.length ? candles[releaseIdx + offset].close : priceAtRelease;

          const price15m = get(1);
          const price30m = get(2);
          const price60m = get(4);

          const change15m = ((price15m - priceAtRelease) / priceAtRelease) * 100;
          const change30m = ((price30m - priceAtRelease) / priceAtRelease) * 100;
          const change60m = ((price60m - priceAtRelease) / priceAtRelease) * 100;

          // Max move in 60min window
          const windowCandles = candles.slice(releaseIdx, releaseIdx + 5);
          const maxHigh = Math.max(...windowCandles.map((c: any) => c.high));
          const minLow = Math.min(...windowCandles.map((c: any) => c.low));
          const maxMoveUp = ((maxHigh - priceAtRelease) / priceAtRelease) * 100;
          const maxMoveDown = ((minLow - priceAtRelease) / priceAtRelease) * 100;
          const maxMove = Math.abs(maxMoveUp) > Math.abs(maxMoveDown) ? maxMoveUp : maxMoveDown;

          const direction = price60m > priceAtRelease ? "up" : "down";
          const pipMult = PIP_MULTIPLIER[pairSymbol] || DEFAULT_PIP_MULT;
          const pipsMove = Math.abs(price60m - priceAtRelease) * pipMult;

          await sb.from("event_reactions").insert({
            event_id: evt.id,
            pair_symbol: pairSymbol,
            actual_value: evt.actual,
            forecast_value: evt.forecast,
            surprise,
            beat_miss: beatMiss,
            price_at_release: priceAtRelease,
            change_15m: Math.round(change15m * 1000) / 1000,
            change_30m: Math.round(change30m * 1000) / 1000,
            change_60m: Math.round(change60m * 1000) / 1000,
            max_move_60m: Math.round(maxMove * 1000) / 1000,
            direction,
            pips_move: Math.round(pipsMove * 10) / 10,
          });

          results.push({ pair: pairSymbol, event: evt.event_name, pips: pipsMove.toFixed(1) });
        } catch (pairErr) {
          console.warn(`Failed reaction for ${pairSymbol}:`, pairErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ recorded: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("record-event-reaction error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function findClosestCandle(candles: any[], targetTime: Date): any | null {
  let closest = candles[0];
  let minDiff = Infinity;
  for (const c of candles) {
    const diff = Math.abs(new Date(c.ts).getTime() - targetTime.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closest = c;
    }
  }
  return closest;
}

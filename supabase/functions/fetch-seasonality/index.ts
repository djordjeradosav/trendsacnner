import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAIRS: Array<{
  symbol: string;
  avFrom?: string;
  avTo?: string;
  avType?: string;
  avSymbol?: string;
}> = [
  // Forex
  { symbol: "EURUSD", avFrom: "EUR", avTo: "USD" },
  { symbol: "GBPUSD", avFrom: "GBP", avTo: "USD" },
  { symbol: "USDJPY", avFrom: "USD", avTo: "JPY" },
  { symbol: "USDCHF", avFrom: "USD", avTo: "CHF" },
  { symbol: "AUDUSD", avFrom: "AUD", avTo: "USD" },
  { symbol: "USDCAD", avFrom: "USD", avTo: "CAD" },
  { symbol: "NZDUSD", avFrom: "NZD", avTo: "USD" },
  { symbol: "EURGBP", avFrom: "EUR", avTo: "GBP" },
  { symbol: "EURJPY", avFrom: "EUR", avTo: "JPY" },
  { symbol: "GBPJPY", avFrom: "GBP", avTo: "JPY" },
  // Metals (ETF proxies)
  { symbol: "XAUUSD", avType: "COMMODITY", avSymbol: "GLD" },
  { symbol: "XAGUSD", avType: "COMMODITY", avSymbol: "SLV" },
  // US Index Futures (ETF proxies)
  { symbol: "US30USD",   avType: "COMMODITY", avSymbol: "DIA" },
  { symbol: "NAS100USD", avType: "COMMODITY", avSymbol: "QQQ" },
  { symbol: "SPX500USD", avType: "COMMODITY", avSymbol: "SPY" },
  { symbol: "US2000USD", avType: "COMMODITY", avSymbol: "IWM" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    const AV_KEY = Deno.env.get("ALPHA_VANTAGE_KEY");
    if (!AV_KEY) throw new Error("ALPHA_VANTAGE_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const pair = PAIRS.find((p) => p.symbol === symbol);
    if (!pair) throw new Error(`Unknown symbol: ${symbol}`);

    // Fetch monthly data from Alpha Vantage
    let url: string;
    let timeSeriesKey: string;

    if ((pair as any).avType === "COMMODITY") {
      url =
        `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${(pair as any).avSymbol}&apikey=${AV_KEY}`;
      timeSeriesKey = "Monthly Adjusted Time Series";
    } else {
      url =
        `https://www.alphavantage.co/query?function=FX_MONTHLY&from_symbol=${(pair as any).avFrom}&to_symbol=${(pair as any).avTo}&apikey=${AV_KEY}`;
      timeSeriesKey = "Time Series FX (Monthly)";
    }

    const response = await fetch(url);
    const data = await response.json();

    // Check for rate limit
    if (data["Note"] || data["Information"]) {
      return new Response(
        JSON.stringify({
          error: "rate_limit",
          message: "Alpha Vantage daily API limit reached. Try again tomorrow.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const timeSeries = data[timeSeriesKey];
    if (!timeSeries) {
      return new Response(
        JSON.stringify({ error: "no_data", message: "No time series data returned", raw: Object.keys(data) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse and insert raw monthly data
    const rows: any[] = [];
    for (const [date, candle] of Object.entries(timeSeries)) {
      const year = parseInt(date.substring(0, 4));
      if (year < 2000) continue;

      const monthNumber = parseInt(date.substring(5, 7));
      const c = candle as any;
      const open = parseFloat(c["1. open"]);
      const close = parseFloat(c["4. close"]);
      const returnPct = ((close - open) / open) * 100;
      const direction = returnPct > 0.01 ? "up" : returnPct < -0.01 ? "down" : "flat";

      rows.push({
        symbol: pair.symbol,
        month_number: monthNumber,
        year,
        open,
        close,
        direction,
        return_pct: parseFloat(returnPct.toFixed(4)),
      });
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "no_rows", message: "No data parsed from response" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Upsert raw data
    const { error: insertErr } = await supabase
      .from("seasonality")
      .upsert(rows, { onConflict: "symbol,month_number,year" });

    if (insertErr) throw insertErr;

    // Compute stats per month
    const statsRows: any[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthRows = rows.filter((r) => r.month_number === m);
      if (monthRows.length === 0) continue;

      const upCount = monthRows.filter((r) => r.direction === "up").length;
      const downCount = monthRows.filter((r) => r.direction === "down").length;
      const flatCount = monthRows.filter((r) => r.direction === "flat").length;
      const totalYears = monthRows.length;
      const upPct = (upCount / totalYears) * 100;
      const downPct = (downCount / totalYears) * 100;
      const avgReturn = monthRows.reduce((s, r) => s + r.return_pct, 0) / totalYears;

      const sorted = [...monthRows].sort((a, b) => a.return_pct - b.return_pct);
      const best = sorted[sorted.length - 1];
      const worst = sorted[0];

      const bias = upPct >= 60 ? "bullish" : upPct <= 40 ? "bearish" : "neutral";

      statsRows.push({
        symbol: pair.symbol,
        month_number: m,
        up_count: upCount,
        down_count: downCount,
        flat_count: flatCount,
        total_years: totalYears,
        up_pct: parseFloat(upPct.toFixed(2)),
        down_pct: parseFloat(downPct.toFixed(2)),
        avg_return: parseFloat(avgReturn.toFixed(4)),
        best_return: best.return_pct,
        worst_return: worst.return_pct,
        best_year: best.year,
        worst_year: worst.year,
        bias,
        updated_at: new Date().toISOString(),
      });
    }

    const { error: statsErr } = await supabase
      .from("seasonality_stats")
      .upsert(statsRows, { onConflict: "symbol,month_number" });

    if (statsErr) throw statsErr;

    return new Response(
      JSON.stringify({ success: true, symbol: pair.symbol, months: rows.length, stats: statsRows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

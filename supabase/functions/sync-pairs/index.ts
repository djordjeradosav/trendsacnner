import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Category classification ────────────────────────────────────────────────

const METALS = ["XAU", "XAG", "XPT", "XPD", "XCU"];
const ENERGY_BASE = ["BCO", "WTICO", "NATGAS"];
const INDICES = [
  "US30", "NAS100", "SPX500", "UK100", "GER30", "GER40",
  "JP225", "AUS200", "HK33", "CN50", "CHINA50", "EU50", "FR40",
  "ES35", "US2000", "TWIX", "SING30", "IN50",
];
const BONDS = ["USB02Y", "USB05Y", "USB10Y", "USB30Y", "BUND", "UK10YB", "DE10YB"];
const CRYPTO = ["BTC", "ETH", "LTC", "BCH", "XRP"];
const GRAINS = ["CORN", "WHEAT", "SOYBN", "SUGAR"];

function classifyPair(
  oandaSymbol: string,
  description: string
): { category: string; base: string; quote: string; displayName: string } {
  const raw = oandaSymbol.replace("OANDA:", "");
  const parts = raw.split("_");
  const base = parts[0];
  const quote = parts.slice(1).join("_");
  const displayName = description.replace(/^OANDA\s*/i, "");

  if (METALS.includes(base)) return { category: "commodity", base, quote, displayName };
  if (ENERGY_BASE.some((e) => base.includes(e)))
    return { category: "commodity", base, quote, displayName };
  if (GRAINS.some((g) => base.includes(g)))
    return { category: "commodity", base, quote, displayName };
  if (INDICES.some((i) => raw.includes(i)))
    return { category: "futures", base, quote, displayName };
  if (BONDS.some((b) => raw.includes(b)))
    return { category: "futures", base, quote, displayName };
  if (CRYPTO.includes(base))
    return { category: "crypto", base, quote, displayName };

  // Check description for commodity keywords
  const descLower = description.toLowerCase();
  if (
    descLower.includes("oil") ||
    descLower.includes("gas") ||
    descLower.includes("corn") ||
    descLower.includes("wheat") ||
    descLower.includes("soybean") ||
    descLower.includes("sugar") ||
    descLower.includes("coffee") ||
    descLower.includes("cocoa") ||
    descLower.includes("copper")
  )
    return { category: "commodity", base, quote, displayName };

  return { category: "forex", base, quote, displayName };
}

function toInternalSymbol(oandaSymbol: string): string {
  return oandaSymbol.replace("OANDA:", "").replace(/_/g, "");
}

// ─── Main ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const FINNHUB_KEY = Deno.env.get("FINNHUB_API_KEY");
  if (!FINNHUB_KEY) {
    return new Response(
      JSON.stringify({ error: "FINNHUB_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("Fetching all symbols from Finnhub OANDA exchange...");

  const res = await fetch(
    `https://finnhub.io/api/v1/forex/symbol?exchange=oanda&token=${FINNHUB_KEY}`
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Finnhub error:", res.status, text);
    return new Response(
      JSON.stringify({ error: `Finnhub API error: ${res.status}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const finnhubSymbols: Array<{
    description: string;
    displaySymbol: string;
    symbol: string;
  }> = await res.json();

  console.log("Finnhub returned", finnhubSymbols.length, "OANDA symbols");

  if (!finnhubSymbols.length) {
    return new Response(
      JSON.stringify({ error: "No symbols returned — check FINNHUB_API_KEY" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Build rows to upsert
  const pairRows = finnhubSymbols.map((item) => {
    const internalSymbol = toInternalSymbol(item.symbol);
    const { category, base, quote, displayName } = classifyPair(
      item.symbol,
      item.description
    );
    return {
      symbol: internalSymbol,
      finnhub_symbol: item.symbol,
      display_symbol: item.displaySymbol,
      name: displayName,
      category,
      base_currency: base,
      quote_currency: quote,
      is_active: true,
    };
  });

  // Upsert all Finnhub symbols — adds new ones, updates existing ones
  // Process in batches of 50 to avoid payload limits
  let upsertErrors: string[] = [];
  for (let i = 0; i < pairRows.length; i += 50) {
    const batch = pairRows.slice(i, i + 50);
    const { error } = await supabase
      .from("pairs")
      .upsert(batch, { onConflict: "symbol" });
    if (error) {
      console.error("Upsert batch error:", error);
      upsertErrors.push(error.message);
    }
  }

  if (upsertErrors.length > 0) {
    return new Response(
      JSON.stringify({ error: upsertErrors.join("; ") }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Deactivate pairs NOT in Finnhub's list
  const activeSymbols = pairRows.map((p) => p.symbol);
  const { data: allDbPairs } = await supabase
    .from("pairs")
    .select("id, symbol")
    .eq("is_active", true);

  if (allDbPairs) {
    const toDeactivate = allDbPairs
      .filter((p) => !activeSymbols.includes(p.symbol))
      .map((p) => p.id);

    if (toDeactivate.length > 0) {
      const { error: deactivateError } = await supabase
        .from("pairs")
        .update({ is_active: false })
        .in("id", toDeactivate);

      if (deactivateError) {
        console.warn("Deactivate error (non-fatal):", deactivateError.message);
      } else {
        console.log("Deactivated", toDeactivate.length, "pairs not in Finnhub");
      }
    }
  }

  // Return summary
  const summary = {
    success: true,
    total: finnhubSymbols.length,
    forex: pairRows.filter((p) => p.category === "forex").length,
    commodity: pairRows.filter((p) => p.category === "commodity").length,
    futures: pairRows.filter((p) => p.category === "futures").length,
    crypto: pairRows.filter((p) => p.category === "crypto").length,
    deactivated: allDbPairs
      ? allDbPairs.filter((p) => !activeSymbols.includes(p.symbol)).length
      : 0,
    samples: pairRows.slice(0, 10).map((p) => `${p.symbol} (${p.category})`),
  };

  console.log("Sync complete:", JSON.stringify(summary));

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

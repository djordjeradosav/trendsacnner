import { useMemo } from "react";
import { useAllScores, type ScoreRow } from "@/hooks/useScores";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// ─── Classification based on DB fields ──────────────────────────────────────

const MAJOR_CURRENCIES = new Set(["EUR", "GBP", "USD", "JPY", "CHF", "AUD", "CAD", "NZD"]);
const EXOTIC_CURRENCIES = new Set([
  "SEK", "NOK", "DKK", "SGD", "HKD", "ZAR", "MXN", "TRY",
  "PLN", "HUF", "CZK", "CNH", "THB", "ILS",
]);
const METALS = new Set(["XAU", "XAG", "XPT", "XPD", "XCU"]);
const ENERGY = new Set(["BCO", "WTICO", "NATGAS"]);
const AGRI = new Set(["CORN", "WHEAT", "SOYBN", "SUGAR", "COFFEE", "COCOA", "COTTON"]);

interface PairRow {
  id: string;
  symbol: string;
  name: string;
  category: string;
  base_currency: string | null;
  quote_currency: string | null;
}

function getSector(pair: PairRow): string {
  const cat = pair.category;
  const base = (pair.base_currency ?? "").toUpperCase();
  const quote = (pair.quote_currency ?? "").toUpperCase();

  if (cat === "futures") return "Equity Futures";

  if (cat === "commodity") {
    if (METALS.has(base)) return "Metals";
    if (ENERGY.has(base)) return "Energy";
    if (AGRI.has(base)) return "Grains";
    return "Commodities";
  }

  if (cat === "forex") {
    const isExotic = EXOTIC_CURRENCIES.has(base) || EXOTIC_CURRENCIES.has(quote);
    if (isExotic) return "Forex Exotics";
    const isMajor =
      MAJOR_CURRENCIES.has(base) &&
      MAJOR_CURRENCIES.has(quote) &&
      (base === "USD" || quote === "USD");
    return isMajor ? "Forex Majors" : "Forex Minors";
  }

  return "Other";
}

// ─── Types ──────────────────────────────────────────────────────────────────

export const SECTOR_NAMES = [
  "Forex Majors",
  "Forex Minors",
  "Forex Exotics",
  "Metals",
  "Energy",
  "Grains",
  "Equity Futures",
] as const;

export type SectorName = string;

export interface SectorStat {
  name: string;
  avgScore: number;
  bullishCount: number;
  neutralCount: number;
  bearishCount: number;
  totalCount: number;
  strongestPair: { symbol: string; score: number } | null;
  weakestPair: { symbol: string; score: number } | null;
  trend: "bullish" | "neutral" | "bearish";
}

export interface MarketSentiment {
  totalPairs: number;
  bullishCount: number;
  neutralCount: number;
  bearishCount: number;
  bullishPct: number;
  neutralPct: number;
  bearishPct: number;
  overallTrend: "bullish" | "neutral" | "bearish";
  summary: string;
}

// ─── Pairs query ────────────────────────────────────────────────────────────

function usePairsInfo() {
  return useQuery({
    queryKey: ["pairs-info-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pairs")
        .select("id, symbol, name, category, base_currency, quote_currency")
        .eq("is_active", true);
      return (data ?? []) as PairRow[];
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Main hook ──────────────────────────────────────────────────────────────

export function useSectorStats(timeframe: string = "1h") {
  const { data: pairsData } = usePairsInfo();
  const { data: allScores, isLoading: scoresLoading } = useAllScores(timeframe);

  const result = useMemo(() => {
    if (!pairsData || !allScores) {
      return { sectors: [] as SectorStat[], sentiment: null as MarketSentiment | null, loading: true };
    }

    const scoreMap = new Map<string, ScoreRow>();
    allScores.forEach((s) => scoreMap.set(s.pair_id, s));

    // Group by sector using DB fields
    const sectorGroups: Record<string, { symbol: string; score: number; trend: string }[]> = {};

    let totalBull = 0, totalNeutral = 0, totalBear = 0;

    pairsData.forEach((p) => {
      const sector = getSector(p);
      if (!sectorGroups[sector]) sectorGroups[sector] = [];
      const s = scoreMap.get(p.id);
      const score = s ? Number(s.score) : 50;
      const trend = s?.trend ?? "neutral";
      sectorGroups[sector].push({ symbol: p.symbol, score, trend });
      if (trend === "bullish") totalBull++;
      else if (trend === "bearish") totalBear++;
      else totalNeutral++;
    });

    const total = pairsData.length;
    const bullPct = total ? Math.round((totalBull / total) * 100) : 0;
    const neutralPct = total ? Math.round((totalNeutral / total) * 100) : 0;
    const bearPct = total ? 100 - bullPct - neutralPct : 0;
    const overallTrend: "bullish" | "neutral" | "bearish" =
      bullPct >= 50 ? "bullish" : bearPct >= 50 ? "bearish" : "neutral";

    const stats: SectorStat[] = Object.entries(sectorGroups)
      .map(([name, items]) => {
        if (items.length === 0) return null;
        const avg = items.reduce((s, i) => s + i.score, 0) / items.length;
        const bull = items.filter((i) => i.trend === "bullish").length;
        const neut = items.filter((i) => i.trend === "neutral").length;
        const bear = items.filter((i) => i.trend === "bearish").length;
        const sorted = [...items].sort((a, b) => b.score - a.score);
        return {
          name,
          avgScore: Math.round(avg * 10) / 10,
          bullishCount: bull,
          neutralCount: neut,
          bearishCount: bear,
          totalCount: items.length,
          strongestPair: sorted[0] ? { symbol: sorted[0].symbol, score: sorted[0].score } : null,
          weakestPair: sorted[sorted.length - 1] ? { symbol: sorted[sorted.length - 1].symbol, score: sorted[sorted.length - 1].score } : null,
          trend: (avg >= 62 ? "bullish" : avg <= 38 ? "bearish" : "neutral") as "bullish" | "neutral" | "bearish",
        } satisfies SectorStat;
      })
      .filter(Boolean) as SectorStat[];

    // Sort by avgScore descending
    stats.sort((a, b) => b.avgScore - a.avgScore);

    const strongSectors = stats.filter((s) => s.trend === "bullish").map((s) => s.name);
    let summary = `${totalBull} of ${total} pairs (${bullPct}%) are trending bullish.`;
    if (strongSectors.length > 0) summary += ` ${strongSectors.join(" and ")} show${strongSectors.length === 1 ? "s" : ""} the strongest directional bias.`;

    const sentiment: MarketSentiment = {
      totalPairs: total,
      bullishCount: totalBull,
      neutralCount: totalNeutral,
      bearishCount: totalBear,
      bullishPct: bullPct,
      neutralPct: neutralPct,
      bearishPct: bearPct,
      overallTrend,
      summary,
    };

    return { sectors: stats, sentiment, loading: false };
  }, [pairsData, allScores]);

  return result;
}

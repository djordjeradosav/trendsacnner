import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

const FOREX_MAJORS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD"];
const FOREX_MINORS = [
  "EURGBP", "EURJPY", "EURCHF", "EURAUD", "EURCAD", "EURNZD",
  "GBPJPY", "GBPCHF", "GBPAUD", "GBPCAD", "GBPNZD",
  "AUDJPY", "AUDCHF", "AUDCAD", "AUDNZD",
  "NZDJPY", "NZDCHF", "NZDCAD",
  "CADJPY", "CADCHF", "CHFJPY",
];
const METALS = ["XAUUSD", "XAGUSD", "XPTUSD", "XPDUSD", "GOLD", "SILVER"];
const ENERGY = ["CRUDEOIL", "BRENT", "NATURALGAS", "WTI", "USOIL", "UKOIL", "CL", "NG"];
const GRAINS = ["WHEAT", "CORN", "SOYBEAN", "SOYBEANS", "RICE", "OATS", "ZW", "ZC", "ZS"];
const EQUITY_FUTURES = ["ES", "NQ", "YM", "RTY", "SPX", "NDX", "DJI", "DAX", "FTSE", "NIKKEI", "SP500", "NASDAQ"];
const BOND_FUTURES = ["ZN", "ZB", "ZT", "ZF", "US10Y", "US30Y", "US2Y", "US5Y", "TNOTE", "TBOND"];

export const SECTOR_NAMES = [
  "Forex Majors",
  "Forex Minors",
  "Forex Exotics",
  "Metals",
  "Energy",
  "Grains",
  "Equity Futures",
  "Bond Futures",
] as const;

export type SectorName = (typeof SECTOR_NAMES)[number];

function classifySector(symbol: string, category: string): SectorName {
  const sym = symbol.replace(/[\/\-\s]/g, "").toUpperCase();
  if (METALS.some((m) => sym.includes(m))) return "Metals";
  if (ENERGY.some((e) => sym.includes(e))) return "Energy";
  if (GRAINS.some((g) => sym.includes(g))) return "Grains";
  if (EQUITY_FUTURES.some((e) => sym.includes(e))) return "Equity Futures";
  if (BOND_FUTURES.some((b) => sym.includes(b))) return "Bond Futures";

  if (category.toLowerCase() === "forex") {
    if (FOREX_MAJORS.some((m) => sym.includes(m))) return "Forex Majors";
    if (FOREX_MINORS.some((m) => sym.includes(m))) return "Forex Minors";
    return "Forex Exotics";
  }
  if (category.toLowerCase() === "commodity") {
    if (METALS.some((m) => sym.includes(m))) return "Metals";
    if (ENERGY.some((e) => sym.includes(e))) return "Energy";
    if (GRAINS.some((g) => sym.includes(g))) return "Grains";
    return "Energy"; // default commodity
  }
  if (category.toLowerCase() === "futures") {
    if (EQUITY_FUTURES.some((e) => sym.includes(e))) return "Equity Futures";
    if (BOND_FUTURES.some((b) => sym.includes(b))) return "Bond Futures";
    return "Equity Futures"; // default futures
  }
  return "Forex Exotics";
}

export interface SectorStat {
  name: SectorName;
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

export function useSectorStats() {
  const [sectors, setSectors] = useState<SectorStat[]>([]);
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: pairsData }, { data: scoresData }] = await Promise.all([
        supabase.from("pairs").select("id, symbol, name, category").eq("is_active", true),
        supabase.from("scores").select("pair_id, score, trend"),
      ]);

      if (!pairsData || !scoresData) { setLoading(false); return; }

      const scoreMap = new Map(scoresData.map((s) => [s.pair_id, s]));

      // Group by sector
      const sectorGroups: Record<SectorName, { symbol: string; score: number; trend: string }[]> = {} as any;
      SECTOR_NAMES.forEach((n) => { sectorGroups[n] = []; });

      let totalBull = 0, totalNeutral = 0, totalBear = 0;

      pairsData.forEach((p) => {
        const sector = classifySector(p.symbol, p.category);
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

      const stats: SectorStat[] = SECTOR_NAMES
        .map((name) => {
          const items = sectorGroups[name];
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
            trend: (avg >= 65 ? "bullish" : avg <= 35 ? "bearish" : "neutral") as "bullish" | "neutral" | "bearish",
          } satisfies SectorStat;
        })
        .filter(Boolean) as SectorStat[];

      // Generate summary sentence
      const strongSectors = stats.filter((s) => s.trend === "bullish").map((s) => s.name);
      const neutralSectors = stats.filter((s) => s.trend === "neutral").map((s) => s.name);
      let summary = `${totalBull} of ${total} pairs (${bullPct}%) are trending bullish.`;
      if (strongSectors.length > 0) summary += ` ${strongSectors.join(" and ")} show${strongSectors.length === 1 ? "s" : ""} the strongest directional bias.`;
      if (neutralSectors.length > 0) summary += ` ${neutralSectors.slice(0, 2).join(" and ")} ${neutralSectors.length === 1 ? "is" : "are"} largely neutral.`;

      const overallLabel = overallTrend === "bullish" ? "Broadly Bullish" : overallTrend === "bearish" ? "Broadly Bearish" : "Mixed / Neutral";

      setSectors(stats);
      setSentiment({
        totalPairs: total,
        bullishCount: totalBull,
        neutralCount: totalNeutral,
        bearishCount: totalBear,
        bullishPct: bullPct,
        neutralPct: neutralPct,
        bearishPct: bearPct,
        overallTrend,
        summary,
      });
      setLoading(false);
    };
    fetch();
  }, []);

  return { sectors, sentiment, loading };
}

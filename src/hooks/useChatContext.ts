import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ScanContext {
  topPairs: { symbol: string; score: number; trend: string }[];
  sectorAverages: Record<string, number>;
  overallScore: number;
  timeframe: string;
  timestamp: string;
}

export function useChatContext(timeframe: string): ScanContext | null {
  const [context, setContext] = useState<ScanContext | null>(null);

  useEffect(() => {
    const fetchContext = async () => {
      // Get latest scores with pair info
      const { data: scores } = await supabase
        .from("scores")
        .select("score, trend, pair_id, timeframe, scanned_at, pairs(symbol, category)")
        .eq("timeframe", timeframe)
        .order("scanned_at", { ascending: false })
        .limit(200);

      if (!scores?.length) return;

      // Dedupe to latest per pair
      const seen = new Set<string>();
      const unique = scores.filter((s) => {
        if (seen.has(s.pair_id)) return false;
        seen.add(s.pair_id);
        return true;
      });

      // Sort by score desc, take top 20
      const sorted = [...unique].sort((a, b) => b.score - a.score);
      const topPairs = sorted.slice(0, 20).map((s) => ({
        symbol: (s.pairs as any)?.symbol || "?",
        score: s.score,
        trend: s.trend,
      }));

      // Sector averages
      const sectors: Record<string, number[]> = {};
      unique.forEach((s) => {
        const cat = (s.pairs as any)?.category || "other";
        if (!sectors[cat]) sectors[cat] = [];
        sectors[cat].push(s.score);
      });
      const sectorAverages: Record<string, number> = {};
      Object.entries(sectors).forEach(([k, v]) => {
        sectorAverages[k] = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
      });

      const overallScore = Math.round(
        unique.reduce((a, b) => a + b.score, 0) / unique.length
      );

      setContext({
        topPairs,
        sectorAverages,
        overallScore,
        timeframe,
        timestamp: new Date().toLocaleString(),
      });
    };

    fetchContext();
  }, [timeframe]);

  return context;
}

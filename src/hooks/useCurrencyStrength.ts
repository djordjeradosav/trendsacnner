import { useMemo } from "react";
import { useAllScores, ScoreRow } from "@/hooks/useScores";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PairInfo {
  id: string;
  symbol: string;
}

export interface CurrencyStrength {
  currency: string;
  strength: number;
  prevStrength: number | null;
  delta: number | null;
}

// Define which pairs each currency appears in and whether to invert
const CURRENCY_PAIRS: Record<string, { symbol: string; invert: boolean }[]> = {
  USD: [
    { symbol: "EURUSD", invert: true },
    { symbol: "GBPUSD", invert: true },
    { symbol: "USDJPY", invert: false },
    { symbol: "USDCHF", invert: false },
    { symbol: "AUDUSD", invert: true },
    { symbol: "USDCAD", invert: false },
    { symbol: "NZDUSD", invert: true },
  ],
  EUR: [
    { symbol: "EURUSD", invert: false },
    { symbol: "EURGBP", invert: false },
    { symbol: "EURJPY", invert: false },
  ],
  GBP: [
    { symbol: "GBPUSD", invert: false },
    { symbol: "EURGBP", invert: true },
    { symbol: "GBPJPY", invert: false },
  ],
  JPY: [
    { symbol: "USDJPY", invert: true },
    { symbol: "EURJPY", invert: true },
    { symbol: "GBPJPY", invert: true },
  ],
  CHF: [
    { symbol: "USDCHF", invert: true },
  ],
  AUD: [
    { symbol: "AUDUSD", invert: false },
  ],
  CAD: [
    { symbol: "USDCAD", invert: true },
  ],
  NZD: [
    { symbol: "NZDUSD", invert: false },
  ],
};

export function useCurrencyStrength(timeframe: string) {
  const { data: allScores } = useAllScores(timeframe);

  // Fetch pairs to map symbol -> pair_id
  const { data: pairs } = useQuery<PairInfo[]>({
    queryKey: ["pairs-for-strength"],
    queryFn: async () => {
      const { data } = await supabase.from("pairs").select("id, symbol");
      return (data ?? []) as PairInfo[];
    },
    staleTime: 5 * 60_000,
  });

  // Fetch previous scan scores for delta
  const { data: prevScores } = useQuery<ScoreRow[]>({
    queryKey: ["scores", "previous", timeframe],
    queryFn: async () => {
      // Get the 2nd most recent batch by distinct scanned_at
      const { data } = await supabase
        .from("scores")
        .select("pair_id, score, trend, timeframe, scanned_at, id, ema_score, adx_score, rsi_score, macd_score, news_score, social_score")
        .eq("timeframe", timeframe)
        .order("scanned_at", { ascending: false })
        .limit(200);
      if (!data || data.length === 0) return [];

      // Group by scanned_at, take 2nd batch
      const batches = new Map<string, ScoreRow[]>();
      for (const row of data) {
        const key = row.scanned_at;
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key)!.push(row);
      }
      const batchKeys = [...batches.keys()];
      if (batchKeys.length < 2) return [];
      return batches.get(batchKeys[1]) ?? [];
    },
    staleTime: 60_000,
  });

  const strengths = useMemo<CurrencyStrength[]>(() => {
    if (!allScores || !pairs) return [];

    const symbolToId = new Map<string, string>();
    pairs.forEach((p) => symbolToId.set(p.symbol, p.id));

    const scoreMap = new Map<string, number>();
    allScores.forEach((s) => scoreMap.set(s.pair_id, Number(s.score)));

    const prevScoreMap = new Map<string, number>();
    prevScores?.forEach((s) => prevScoreMap.set(s.pair_id, Number(s.score)));

    const results: CurrencyStrength[] = [];

    for (const [currency, pairDefs] of Object.entries(CURRENCY_PAIRS)) {
      const values: number[] = [];
      const prevValues: number[] = [];

      for (const { symbol, invert } of pairDefs) {
        const pairId = symbolToId.get(symbol);
        if (!pairId) continue;

        const score = scoreMap.get(pairId);
        if (score !== undefined) {
          values.push(invert ? 100 - score : score);
        }

        const prev = prevScoreMap.get(pairId);
        if (prev !== undefined) {
          prevValues.push(invert ? 100 - prev : prev);
        }
      }

      if (values.length === 0) continue;

      const strength = values.reduce((a, b) => a + b, 0) / values.length;
      const prevStrength = prevValues.length > 0
        ? prevValues.reduce((a, b) => a + b, 0) / prevValues.length
        : null;
      const delta = prevStrength !== null ? strength - prevStrength : null;

      results.push({ currency, strength, prevStrength, delta });
    }

    results.sort((a, b) => b.strength - a.strength);
    return results;
  }, [allScores, pairs, prevScores]);

  return strengths;
}

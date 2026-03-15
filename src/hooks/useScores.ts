import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ScoreRow {
  id: string;
  pair_id: string;
  score: number;
  trend: string;
  timeframe: string;
  ema_score: number | null;
  adx_score: number | null;
  rsi_score: number | null;
  macd_score: number | null;
  news_score: number | null;
  scanned_at: string;
}

/**
 * Fetches all latest scores. Subscribes to realtime INSERT events
 * and merges new rows into the cache for instant UI updates.
 */
export function useAllScores(timeframe: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const query = useQuery<ScoreRow[]>({
    queryKey: ["scores", "all", timeframe],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scores")
        .select("id, pair_id, score, trend, timeframe, ema_score, adx_score, rsi_score, macd_score, scanned_at")
        .eq("timeframe", timeframe)
        .order("scanned_at", { ascending: false });
      if (error) throw error;

      // Deduplicate: keep only the latest per pair_id
      const map = new Map<string, ScoreRow>();
      (data ?? []).forEach((row) => {
        if (!map.has(row.pair_id)) map.set(row.pair_id, row);
      });
      return Array.from(map.values());
    },
    staleTime: 60_000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("scores-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scores" },
        (payload) => {
          const newScore = payload.new as ScoreRow;
          // Update the "all scores" cache in place
          queryClient.setQueryData<ScoreRow[]>(
            ["scores", "all", newScore.timeframe],
            (old) => {
              if (!old) return [newScore];
              const idx = old.findIndex((s) => s.pair_id === newScore.pair_id);
              if (idx >= 0) {
                const copy = [...old];
                copy[idx] = newScore;
                return copy;
              }
              return [newScore, ...old];
            }
          );

          // Also invalidate pair-specific queries
          queryClient.invalidateQueries({
            queryKey: ["scores", "pair", newScore.pair_id],
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  return query;
}

/**
 * Fetches the latest score for a single pair.
 */
export function usePairScore(pairId: string | undefined, timeframe: string) {
  return useQuery<ScoreRow | null>({
    queryKey: ["scores", "pair", pairId, timeframe],
    queryFn: async () => {
      if (!pairId) return null;
      const { data, error } = await supabase
        .from("scores")
        .select("id, pair_id, score, trend, timeframe, ema_score, adx_score, rsi_score, macd_score, scanned_at")
        .eq("pair_id", pairId)
        .eq("timeframe", timeframe)
        .order("scanned_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!pairId,
    staleTime: 30_000,
  });
}

/**
 * Fetches score history for a pair (for charts).
 */
export function usePairHistory(pairId: string | undefined, timeframe: string, limit = 48) {
  return useQuery({
    queryKey: ["scores", "history", pairId, timeframe, limit],
    queryFn: async () => {
      if (!pairId) return [];
      const { data, error } = await supabase
        .from("scores")
        .select("score, scanned_at")
        .eq("pair_id", pairId)
        .order("scanned_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!pairId,
    staleTime: 5 * 60_000,
  });
}

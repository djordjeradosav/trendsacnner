import { useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useScoresStore, type ScoreEntry } from "@/store/scoresStore";

interface Props {
  children: ReactNode;
}

/**
 * Global provider that:
 * 1. Loads the pair_id→symbol lookup on mount
 * 2. Subscribes to Supabase Realtime on the scores table
 * 3. Pushes every INSERT/UPDATE into the Zustand store instantly
 */
export function RealtimeProvider({ children }: Props) {
  const upsertScore = useScoresStore((s) => s.upsertScore);
  const pairMapRef = useRef<Record<string, string>>({});

  // Load pair_id → symbol map once
  useEffect(() => {
    supabase
      .from("pairs")
      .select("id, symbol")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          pairMapRef.current = Object.fromEntries(data.map((p) => [p.id, p.symbol]));
        }
      });
  }, []);

  // Subscribe to ALL score changes (unfiltered — store handles timeframe separation)
  useEffect(() => {
    const channel = supabase
      .channel("scores-global-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scores",
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const row = payload.new as any;
            const symbol = pairMapRef.current[row.pair_id] ?? "";
            const entry: ScoreEntry = {
              id: row.id,
              pair_id: row.pair_id,
              symbol,
              score: Number(row.score),
              trend: row.trend,
              timeframe: row.timeframe,
              ema_score: row.ema_score,
              adx_score: row.adx_score,
              rsi_score: row.rsi_score,
              macd_score: row.macd_score,
              news_score: row.news_score,
              social_score: row.social_score,
              ema20: row.ema20,
              ema50: row.ema50,
              ema200: row.ema200,
              adx: row.adx,
              rsi: row.rsi,
              macd_hist: row.macd_hist,
              scanned_at: row.scanned_at,
            };
            upsertScore(entry);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [upsertScore]);

  return <>{children}</>;
}

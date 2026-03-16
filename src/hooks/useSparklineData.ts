import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SparklineRow {
  pair_id: string;
  scores: number[];
  score_change: number;
}

export function useSparklineData(timeframe: string) {
  return useQuery<Record<string, SparklineRow>>({
    queryKey: ["sparklines", timeframe],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sparkline_data", {
        p_timeframe: timeframe,
        p_limit: 20,
      });
      if (error) throw error;
      const map: Record<string, SparklineRow> = {};
      (data ?? []).forEach((d: any) => {
        map[d.pair_id] = {
          pair_id: d.pair_id,
          scores: d.scores ?? [],
          score_change: d.score_change ?? 0,
        };
      });
      return map;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

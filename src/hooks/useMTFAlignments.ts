import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface MTFAlignmentRow {
  id: string;
  pair_id: string;
  symbol: string;
  direction: string;
  alignment: number;
  alignment_score: number;
  label: string;
  bull_count: number;
  bear_count: number;
  scores_5m: { score: number; trend: string } | null;
  scores_30m: { score: number; trend: string } | null;
  scores_1h: { score: number; trend: string } | null;
  scores_4h: { score: number; trend: string } | null;
  scanned_at: string;
}

export function useMTFAlignments() {
  const query = useQuery<MTFAlignmentRow[]>({
    queryKey: ["mtf-alignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mtf_alignments")
        .select("*")
        .order("alignment_score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MTFAlignmentRow[];
    },
    staleTime: 30_000,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("mtf-alignments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "mtf_alignments" }, () => {
        query.refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const perfect = (query.data ?? []).filter((a) => a.label === "Perfect");
  const perfectBullish = perfect.filter((a) => a.direction === "bullish");
  const perfectBearish = perfect.filter((a) => a.direction === "bearish");

  return { alignments: query.data ?? [], perfect, perfectBullish, perfectBearish, isLoading: query.isLoading, refetch: query.refetch };
}

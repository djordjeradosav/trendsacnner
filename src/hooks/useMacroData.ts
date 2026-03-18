import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMacroData(indicator: string, limit = 60) {
  const query = useQuery({
    queryKey: ["macro", indicator, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("macro_indicators" as any)
        .select("*")
        .eq("indicator", indicator)
        .eq("country", "US")
        .order("release_date", { ascending: false })
        .limit(limit);

      if (error) throw error;

      if (!data?.length) {
        // Auto-trigger fetch if no data
        await supabase.functions.invoke("fetch-fred-data", {
          body: { indicator },
        });
        // Wait and retry
        await new Promise((r) => setTimeout(r, 10000));
        const retry = await supabase
          .from("macro_indicators" as any)
          .select("*")
          .eq("indicator", indicator)
          .order("release_date", { ascending: false })
          .limit(limit);
        return (retry.data ?? []) as unknown as MacroIndicator[];
      }

      return data as MacroIndicator[];
    },
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const latest = query.data?.[0];
  const previous = query.data?.[1];
  const sorted = [...(query.data ?? [])].sort(
    (a, b) =>
      new Date(a.release_date).getTime() - new Date(b.release_date).getTime()
  );

  const beatCount =
    query.data?.filter((d) => d.beat_miss === "beat").length ?? 0;
  const totalCount =
    query.data?.filter((d) => d.beat_miss !== "pending").length ?? 0;
  const beatRate =
    totalCount > 0 ? Math.round((beatCount / totalCount) * 100) : 0;

  const biggestBeat = [...(query.data ?? [])]
    .filter((d) => d.beat_miss === "beat" && d.surprise != null)
    .sort((a, b) => Math.abs(b.surprise!) - Math.abs(a.surprise!))[0];

  const biggestMiss = [...(query.data ?? [])]
    .filter((d) => d.beat_miss === "miss" && d.surprise != null)
    .sort((a, b) => Math.abs(b.surprise!) - Math.abs(a.surprise!))[0];

  return {
    ...query,
    latest,
    previous,
    sorted,
    beatCount,
    totalCount,
    beatRate,
    biggestBeat,
    biggestMiss,
  };
}

export interface MacroIndicator {
  id: string;
  indicator: string;
  country: string;
  actual: number | null;
  previous: number | null;
  forecast: number | null;
  surprise: number | null;
  beat_miss: string | null;
  release_date: string;
  unit: string | null;
  source: string | null;
  created_at: string;
}

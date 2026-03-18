import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function useMacroData(indicator: string, limit = 60) {
  const fetchedRef = useRef(false);

  const query = useQuery({
    queryKey: ["macro", indicator],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("macro_indicators")
        .select("*")
        .eq("indicator", indicator)
        .eq("country", "US")
        .order("release_date", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("useMacroData error for", indicator, error);
        throw error;
      }

      console.log("useMacroData:", indicator, "returned", data?.length, "rows");
      return (data ?? []) as MacroIndicator[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Auto-fetch from FRED if table is empty (non-blocking)
  useEffect(() => {
    if (!query.isLoading && query.data?.length === 0 && !fetchedRef.current) {
      fetchedRef.current = true;
      console.log("No data for", indicator, "— auto-fetching from FRED");
      supabase.functions
        .invoke("fetch-fred-data", { body: { indicator } })
        .then(({ data, error }) => {
          console.log("Auto-fetch result for", indicator, { data, error });
          // Refetch after a delay to let the data settle
          setTimeout(() => query.refetch(), 5000);
        });
    }
  }, [query.isLoading, query.data?.length, indicator]);

  const sorted = [...(query.data ?? [])].sort(
    (a, b) =>
      new Date(a.release_date).getTime() - new Date(b.release_date).getTime()
  );

  const latest = query.data?.[0] ?? null;
  const previous = query.data?.[1] ?? null;

  const releases = query.data?.filter((d) => d.beat_miss !== "pending") ?? [];
  const beatCount = releases.filter((d) => d.beat_miss === "beat").length;
  const totalCount = releases.length;
  const beatRate =
    totalCount > 0 ? Math.round((beatCount / totalCount) * 100) : 0;

  const withSurprise = query.data?.filter((d) => d.surprise != null) ?? [];
  const biggestBeat =
    [...withSurprise]
      .filter((d) => d.beat_miss === "beat")
      .sort((a, b) => Math.abs(b.surprise!) - Math.abs(a.surprise!))[0] ?? null;
  const biggestMiss =
    [...withSurprise]
      .filter((d) => d.beat_miss === "miss")
      .sort((a, b) => Math.abs(b.surprise!) - Math.abs(a.surprise!))[0] ?? null;

  function computeStreak() {
    const d = query.data ?? [];
    if (!d.length) return { count: 0, direction: "none" as string };
    const dir = d[0].beat_miss;
    if (!dir || dir === "pending")
      return { count: 0, direction: "none" as string };
    let count = 0;
    for (const row of d) {
      if (row.beat_miss === dir) count++;
      else break;
    }
    return { count, direction: dir === "beat" ? "beats" : "misses" };
  }

  return {
    ...query,
    sorted,
    latest,
    previous,
    beatCount,
    totalCount,
    beatRate,
    biggestBeat,
    biggestMiss,
    computeStreak,
    hasData: (query.data?.length ?? 0) > 0,
    autoFetching: !fetchedRef.current && query.data?.length === 0,
  };
}

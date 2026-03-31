import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllScores } from "@/hooks/useScores";
import { useSparklineData } from "@/hooks/useSparklineData";
import { ScoreSparkline } from "@/components/scanner/ScoreSparkline";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PairMap {
  [id: string]: { symbol: string; category: string };
}



function scoreToColor(score: number): string {
  if (score >= 80) return "hsl(142 70% 35%)";
  if (score >= 65) return "hsl(142 50% 28%)";
  if (score >= 55) return "hsl(142 30% 22%)";
  if (score >= 45) return "hsl(200 15% 18%)";
  if (score >= 35) return "hsl(0 30% 22%)";
  if (score >= 20) return "hsl(0 50% 28%)";
  return "hsl(0 70% 33%)";
}

function scoreToBorder(score: number): string {
  if (score >= 80) return "hsl(142 70% 45%)";
  if (score >= 65) return "hsl(142 50% 38%)";
  if (score >= 55) return "hsl(142 30% 30%)";
  if (score >= 45) return "hsl(200 15% 25%)";
  if (score >= 35) return "hsl(0 30% 30%)";
  if (score >= 20) return "hsl(0 50% 38%)";
  return "hsl(0 70% 42%)";
}

const CATEGORIES = ["All", "Forex", "Futures", "Commodity"] as const;

export function HeatmapWidget({ timeframe }: { timeframe: string }) {
  const { data: allScores } = useAllScores(timeframe);
  const { data: sparklines } = useSparklineData(timeframe);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("All");

  const { data: pairs } = useQuery<PairMap>({
    queryKey: ["pairs-map"],
    queryFn: async () => {
      const { data } = await supabase.from("pairs").select("id, symbol, category").eq("is_active", true);
      const map: PairMap = {};
      (data ?? []).forEach((p) => { map[p.id] = { symbol: p.symbol, category: p.category }; });
      return map;
    },
    staleTime: 5 * 60_000,
  });

  const cells = useMemo(() => {
    if (!allScores || !pairs) return [];
    return allScores
      .map((s) => ({
        pairId: s.pair_id,
        symbol: pairs[s.pair_id]?.symbol ?? "?",
        category: pairs[s.pair_id]?.category ?? "",
        score: s.score,
        trend: s.trend,
      }))
      .filter((c) => {
        if (c.symbol === "?") return false;
        if (category !== "All" && c.category.toLowerCase() !== category.toLowerCase()) return false;
        if (search && !c.symbol.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
  }, [allScores, pairs, category, search]);

  

  if (cells.length === 0) {
    return (
      <div className="rounded-lg p-4 bg-card border border-border/50 h-full flex items-center justify-center">
        <span className="text-xs text-muted-foreground font-mono">Run a scan to see the heatmap</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-4 bg-card border border-border/50 h-full flex flex-col">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-display font-semibold text-foreground uppercase tracking-wider shrink-0">
          Market Heatmap
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category pills */}
          <div className="flex items-center gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-display font-semibold transition-colors ${
                  category === c
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              placeholder="Filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-7 w-28 text-[10px] font-mono bg-background/50 border-border/50"
            />
          </div>
          {/* Legend */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: "hsl(0 70% 33%)" }} />
            <span className="text-[9px] text-muted-foreground font-mono">Bear</span>
            <div className="w-6 h-1.5 rounded-full mx-0.5" style={{ background: "linear-gradient(90deg, hsl(0 70% 33%), hsl(200 15% 18%), hsl(142 70% 35%))" }} />
            <div className="w-2 h-2 rounded-sm" style={{ background: "hsl(142 70% 35%)" }} />
            <span className="text-[9px] text-muted-foreground font-mono">Bull</span>
          </div>
        </div>
      </div>


      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 gap-1">
          {cells.map((cell) => {
            const spark = sparklines?.[cell.pairId];
            const change = spark?.score_change ?? 0;
            const showChange = Math.abs(change) > 1;

            return (
              <button
                key={cell.pairId}
                onClick={() => navigate(`/pair/${cell.symbol}`)}
                className="group rounded-md p-2 text-center transition-transform hover:scale-105 hover:z-10 cursor-pointer flex flex-col items-center gap-0.5"
                style={{
                  background: cell.score === null ? "hsl(200 10% 15%)" : scoreToColor(cell.score),
                  border: `1px solid ${cell.score === null ? "hsl(200 10% 22%)" : scoreToBorder(cell.score)}`,
                  minHeight: "94px",
                }}
                title={cell.score === null ? `${cell.symbol}: Insufficient data` : `${cell.symbol}: Score ${cell.score} (${cell.trend})`}
              >
                {/* Symbol name — large & pronounced */}
                <div className="flex items-center justify-between w-full gap-0.5">
                  <span className="text-[12px] sm:text-[13px] font-display font-extrabold text-white tracking-wide drop-shadow-sm truncate leading-tight">
                    {cell.symbol.replace("/", "")}
                  </span>
                  {showChange && (
                    <span
                      className="text-[8px] font-mono font-bold leading-none px-1 py-0.5 rounded-sm"
                      style={{ color: change > 0 ? "#4ade80" : "#f87171", background: "rgba(0,0,0,0.3)" }}
                    >
                      {change > 0 ? "+" : ""}{change.toFixed(1)}
                    </span>
                  )}
                </div>

                {/* Score */}
                <div className="text-base sm:text-lg font-display font-bold text-white leading-tight drop-shadow-sm">
                  {cell.score === null ? "—" : cell.score}
                </div>

                {/* Trend label */}
                <div className="text-[8px] font-display font-semibold uppercase text-white/60 tracking-wider leading-tight">
                  {cell.trend}
                </div>

                {/* Sparkline */}
                {spark && spark.scores.length >= 2 && (
                  <ScoreSparkline scores={spark.scores} trend={cell.trend} width={56} height={16} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

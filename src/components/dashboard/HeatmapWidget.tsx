import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllScores } from "@/hooks/useScores";
import { useNavigate } from "react-router-dom";

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

export function HeatmapWidget({ timeframe }: { timeframe: string }) {
  const { data: allScores } = useAllScores(timeframe);
  const navigate = useNavigate();

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
      .sort((a, b) => b.score - a.score);
  }, [allScores, pairs]);

  if (cells.length === 0) {
    return (
      <div className="rounded-lg p-4 bg-card border border-border/50 h-full flex items-center justify-center">
        <span className="text-xs text-muted-foreground font-mono">Run a scan to see the heatmap</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-4 bg-card border border-border/50 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-display font-semibold text-foreground uppercase tracking-wider">
          Market Heatmap
        </h3>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ background: "hsl(0 70% 33%)" }} />
          <span className="text-[9px] text-muted-foreground font-mono">Bearish</span>
          <div className="w-8 h-1.5 rounded-full mx-1" style={{ background: "linear-gradient(90deg, hsl(0 70% 33%), hsl(200 15% 18%), hsl(142 70% 35%))" }} />
          <div className="w-2 h-2 rounded-sm" style={{ background: "hsl(142 70% 35%)" }} />
          <span className="text-[9px] text-muted-foreground font-mono">Bullish</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1">
          {cells.map((cell) => (
            <button
              key={cell.pairId}
              onClick={() => navigate(`/pair/${cell.symbol}`)}
              className="rounded-md p-1.5 text-center transition-transform hover:scale-105 hover:z-10 cursor-pointer"
              style={{
                background: scoreToColor(cell.score),
                border: `1px solid ${scoreToBorder(cell.score)}`,
              }}
              title={`${cell.symbol}: Score ${cell.score} (${cell.trend})`}
            >
              <div className="text-[9px] font-display font-bold text-white/90 truncate leading-tight">
                {cell.symbol.replace("/", "")}
              </div>
              <div className="text-[8px] font-mono text-white/60 leading-tight">
                {cell.score}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

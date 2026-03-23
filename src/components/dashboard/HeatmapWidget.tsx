import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllScores } from "@/hooks/useScores";
import { useSparklineData } from "@/hooks/useSparklineData";
import { ScoreSparkline } from "@/components/scanner/ScoreSparkline";
import { useNavigate } from "react-router-dom";

interface PairMap {
  [id: string]: { symbol: string; category: string };
}

const PINNED_SYMBOLS = ["US30USD", "NAS100USD", "SPX500USD", "US2000USD"];

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
  const { data: sparklines } = useSparklineData(timeframe);
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

  const [categoryFilter, setCategoryFilter] = useState("all");

  const { pinnedCells, otherCells } = useMemo(() => {
    if (!allScores || !pairs) return { pinnedCells: [], otherCells: [] };
    const all = allScores
      .map((s) => ({
        pairId: s.pair_id,
        symbol: pairs[s.pair_id]?.symbol ?? "?",
        category: pairs[s.pair_id]?.category ?? "",
        score: s.score,
        trend: s.trend,
      }))
      .filter((c) => c.symbol !== "?");

    const pinned = PINNED_SYMBOLS
      .map((sym) => all.find((c) => c.symbol === sym))
      .filter(Boolean) as typeof all;

    const others = all
      .filter((c) => !PINNED_SYMBOLS.includes(c.symbol))
      .filter((c) => categoryFilter === "all" || c.category === categoryFilter)
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));

    return { pinnedCells: pinned, otherCells: others };
  }, [allScores, pairs, categoryFilter]);

  const hasData = pinnedCells.length > 0 || otherCells.length > 0;

  const CATEGORY_TABS = [
    { label: "All", value: "all" },
    { label: "Forex", value: "forex" },
    { label: "Futures", value: "futures" },
    { label: "Commodities", value: "commodity" },
  ];

  if (!hasData) {
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

      {/* Category filter */}
      <div className="flex items-center gap-1.5 mb-3">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setCategoryFilter(tab.value)}
            className="px-2.5 py-1 text-[10px] font-mono rounded-full border transition-colors"
            style={{
              background: categoryFilter === tab.value ? "hsl(var(--primary) / 0.15)" : "transparent",
              color: categoryFilter === tab.value ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
              borderColor: categoryFilter === tab.value ? "hsl(var(--primary) / 0.4)" : "hsl(var(--border))",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Pinned indexes */}
        {pinnedCells.length > 0 && (
          <>
            <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
              📌 Index Futures
            </div>
            <div className="grid grid-cols-4 gap-1 mb-3 pb-3 border-b border-border/30">
              {pinnedCells.map((cell) => {
                const spark = sparklines?.[cell.pairId];
                const change = spark?.score_change ?? 0;
                const showChange = Math.abs(change) > 1;
                return (
                  <button
                    key={cell.pairId}
                    onClick={() => navigate(`/pair/${cell.symbol}`)}
                    className="group rounded-md p-1.5 text-center transition-transform hover:scale-105 hover:z-10 cursor-pointer flex flex-col items-center gap-0.5"
                    style={{
                      background: cell.score === null ? "hsl(var(--muted))" : scoreToColor(cell.score),
                      border: `1px solid ${cell.score === null ? "hsl(var(--border))" : scoreToBorder(cell.score)}`,
                      minHeight: "90px",
                    }}
                    title={`${cell.symbol}: Score ${cell.score} (${cell.trend})`}
                  >
                    <div className="flex items-center justify-between w-full gap-0.5">
                      <span className="text-[9px] font-display font-bold text-white/90 truncate leading-tight">
                        {cell.symbol.replace("USD", "")}
                      </span>
                      {showChange && (
                        <span className="text-[7px] font-mono font-semibold leading-none px-0.5 rounded"
                          style={{ color: change > 0 ? "#4ade80" : "#f87171" }}>
                          {change > 0 ? "+" : ""}{change.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-mono font-bold text-white/90 leading-tight">
                      {cell.score === null ? "—" : cell.score}
                    </div>
                    <div className="text-[7px] font-mono uppercase text-white/50 leading-tight">{cell.trend}</div>
                    {spark && spark.scores.length >= 2 && (
                      <ScoreSparkline scores={spark.scores} trend={cell.trend} width={56} height={16} />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Other pairs */}
        <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-1">
          {otherCells.map((cell) => {
            const spark = sparklines?.[cell.pairId];
            const change = spark?.score_change ?? 0;
            const showChange = Math.abs(change) > 1;

            return (
              <button
                key={cell.pairId}
                onClick={() => navigate(`/pair/${cell.symbol}`)}
                className="group rounded-md p-1.5 text-center transition-transform hover:scale-105 hover:z-10 cursor-pointer flex flex-col items-center gap-0.5"
                style={{
                  background: cell.score === null ? "hsl(200 10% 15%)" : scoreToColor(cell.score),
                  border: `1px solid ${cell.score === null ? "hsl(200 10% 22%)" : scoreToBorder(cell.score)}`,
                  minHeight: "90px",
                }}
                title={cell.score === null ? `${cell.symbol}: Insufficient data` : `${cell.symbol}: Score ${cell.score} (${cell.trend})`}
              >
                {/* Top row: symbol + change badge */}
                <div className="flex items-center justify-between w-full gap-0.5">
                  <span className="text-[9px] font-display font-bold text-white/90 truncate leading-tight">
                    {cell.symbol.replace("/", "")}
                  </span>
                  {showChange && (
                    <span
                      className="text-[7px] font-mono font-semibold leading-none px-0.5 rounded"
                      style={{ color: change > 0 ? "#4ade80" : "#f87171" }}
                    >
                      {change > 0 ? "+" : ""}{change.toFixed(1)}
                    </span>
                  )}
                </div>

                {/* Score */}
                <div className="text-sm font-mono font-bold text-white/90 leading-tight">
                  {cell.score === null ? "—" : cell.score}
                </div>

                {/* Trend label */}
                <div className="text-[7px] font-mono uppercase text-white/50 leading-tight">
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

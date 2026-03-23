import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TFS = ["15min", "1h", "4h", "1day"] as const;
const TF_LABELS: Record<string, string> = {
  "15min": "15M", "1h": "1H", "4h": "4H", "1day": "1D",
};

interface TFScore {
  score: number;
  trend: string;
}

interface Props {
  pairId: string;
  selectedTF: string;
  onSelectTF: (tf: string) => void;
}

export function MTFScoreStrip({ pairId, selectedTF, onSelectTF }: Props) {
  const [scores, setScores] = useState<Record<string, TFScore | null>>({});

  useEffect(() => {
    if (!pairId) return;
    Promise.all(
      TFS.map(async (tf) => {
        const { data } = await supabase
          .from("scores")
          .select("score, trend")
          .eq("pair_id", pairId)
          .eq("timeframe", tf)
          .order("scanned_at", { ascending: false })
          .limit(1);
        return [tf, data?.[0] ?? null] as const;
      })
    ).then((results) => {
      const map: Record<string, TFScore | null> = {};
      results.forEach(([tf, s]) => { map[tf] = s; });
      setScores(map);
    });
  }, [pairId]);

  const withData = TFS.filter((tf) => scores[tf]);
  const bullCount = withData.filter((tf) => scores[tf]?.trend === "bullish").length;
  const bearCount = withData.filter((tf) => scores[tf]?.trend === "bearish").length;

  const alignmentText = withData.length === 0
    ? "Insufficient data — run a full scan"
    : bullCount === withData.length
      ? `⭐ ${withData.length}/${TFS.length} timeframes Bullish — strong alignment`
      : bearCount === withData.length
        ? `⭐ ${withData.length}/${TFS.length} timeframes Bearish — strong alignment`
        : `Mixed — ${bullCount} Bullish, ${bearCount} Bearish, ${withData.length - bullCount - bearCount} Neutral`;

  return (
    <div className="mb-4">
      <div className="flex gap-2 pb-3 border-b border-border/50">
        {TFS.map((tf) => {
          const s = scores[tf];
          const isActive = selectedTF === tf;
          const color = !s
            ? "text-muted-foreground"
            : s.trend === "bullish"
              ? "text-bullish"
              : s.trend === "bearish"
                ? "text-bearish"
                : "text-neutral-tone";
          const borderColor = !s
            ? "border-border"
            : s.trend === "bullish"
              ? "border-bullish/40"
              : s.trend === "bearish"
                ? "border-bearish/40"
                : "border-border";

          return (
            <button
              key={tf}
              onClick={() => onSelectTF(tf)}
              className={`flex-1 text-center py-2 px-1 rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? `bg-accent/60 ${borderColor}`
                  : "border-border/50 hover:bg-accent/30"
              }`}
            >
              <div className={`text-[10px] font-display mb-1 ${isActive ? "font-semibold" : ""} text-muted-foreground`}>
                {TF_LABELS[tf]}
              </div>
              <div className={`text-lg font-bold font-mono ${color}`}>
                {s ? s.score.toFixed(0) : "—"}
              </div>
              <div className={`text-[9px] mt-0.5 ${color}`}>
                {!s ? "No data" : s.trend === "bullish" ? "↑ Bull" : s.trend === "bearish" ? "↓ Bear" : "→ Neu"}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 font-display">{alignmentText}</p>
    </div>
  );
}

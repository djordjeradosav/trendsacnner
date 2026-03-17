import { useMemo } from "react";
import { useAllScores, type ScoreRow } from "@/hooks/useScores";

const TIMEFRAMES = ["15min", "30min", "1h", "4h", "1day", "1week"];
const TF_LABELS: Record<string, string> = {
  "15min": "15M", "30min": "30M", "1h": "1H", "4h": "4H", "1day": "1D", "1week": "1W",
};

interface Props {
  pairId: string;
  selectedTF: string;
  onSelect: (tf: string) => void;
}

export function MultiTFStrip({ pairId, selectedTF, onSelect }: Props) {
  // Load scores for each TF
  const tf15 = useAllScores("15min");
  const tf30 = useAllScores("30min");
  const tf1h = useAllScores("1h");
  const tf4h = useAllScores("4h");
  const tf1d = useAllScores("1day");
  const tf1w = useAllScores("1week");

  const tfDataMap = useMemo(() => {
    const allData: Record<string, ScoreRow | null> = {};
    const sources: Record<string, ScoreRow[] | undefined> = {
      "15min": tf15.data, "30min": tf30.data, "1h": tf1h.data,
      "4h": tf4h.data, "1day": tf1d.data, "1week": tf1w.data,
    };
    for (const tf of TIMEFRAMES) {
      const scores = sources[tf];
      allData[tf] = scores?.find((s) => s.pair_id === pairId) ?? null;
    }
    return allData;
  }, [pairId, tf15.data, tf30.data, tf1h.data, tf4h.data, tf1d.data, tf1w.data]);

  // Alignment calculation
  const withData = TIMEFRAMES.filter((tf) => tfDataMap[tf] != null);
  const bullishCount = withData.filter((tf) => tfDataMap[tf]!.trend === "bullish").length;
  const bearishCount = withData.filter((tf) => tfDataMap[tf]!.trend === "bearish").length;
  const total = withData.length;

  let alignmentLabel = "";
  if (total >= 2) {
    const maxDir = bullishCount >= bearishCount ? "bullish" : "bearish";
    const maxCount = Math.max(bullishCount, bearishCount);
    if (maxCount === total) alignmentLabel = `⭐ Strong ${maxDir} alignment across all ${total} scanned TFs`;
    else if (maxCount >= total * 0.67) alignmentLabel = `Mostly ${maxDir} — ${maxCount}/${total} timeframes aligned`;
    else alignmentLabel = `Mixed signals — no clear directional bias`;
  }

  return (
    <div className="mb-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TIMEFRAMES.map((tf) => {
          const data = tfDataMap[tf];
          const isSelected = tf === selectedTF;
          const score = data ? Math.round(data.score) : null;
          const trend = data?.trend ?? null;

          const arrow = trend === "bullish" ? "↑" : trend === "bearish" ? "↓" : trend === "neutral" ? "→" : "?";
          const arrowColor = trend === "bullish" ? "hsl(var(--bullish))" : trend === "bearish" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";
          const bgTint = trend === "bullish" ? "hsl(var(--bullish) / 0.08)" : trend === "bearish" ? "hsl(var(--destructive) / 0.08)" : "transparent";

          return (
            <button
              key={tf}
              onClick={() => onSelect(tf)}
              className="flex-1 min-w-[60px] rounded-lg p-2 flex flex-col items-center gap-0.5 transition-all border"
              style={{
                background: bgTint,
                borderColor: isSelected ? "hsl(var(--primary))" : "hsl(var(--border) / 0.5)",
                opacity: data ? 1 : 0.5,
              }}
            >
              <span className="text-[10px] uppercase font-display text-muted-foreground">{TF_LABELS[tf]}</span>
              <span className="text-base font-mono font-bold" style={{ color: arrowColor }}>
                {score ?? "—"}
              </span>
              <span className="text-sm" style={{ color: arrowColor }}>{arrow}</span>
            </button>
          );
        })}
      </div>
      {alignmentLabel && (
        <p className="text-[11px] font-display text-muted-foreground mt-2 text-center">{alignmentLabel}</p>
      )}
    </div>
  );
}
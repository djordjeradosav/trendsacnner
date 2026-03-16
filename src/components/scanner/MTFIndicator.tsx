import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { MTFAlignmentRow } from "@/hooks/useMTFAlignments";

function trendColor(trend: string | undefined): string {
  if (trend === "bullish") return "hsl(var(--bullish))";
  if (trend === "bearish") return "hsl(var(--bearish))";
  return "hsl(var(--muted-foreground))";
}

function labelBadgeColor(label: string): string {
  if (label === "Perfect") return "hsl(var(--bullish))";
  if (label === "Strong") return "hsl(142 50% 45%)";
  if (label === "Partial") return "hsl(var(--muted-foreground))";
  return "hsl(var(--warning, 38 92% 50%))";
}

interface MTFIndicatorProps {
  alignment: MTFAlignmentRow;
}

export function MTFIndicator({ alignment }: MTFIndicatorProps) {
  const tfData = [
    { label: "5M", data: alignment.scores_5m },
    { label: "30M", data: alignment.scores_30m },
    { label: "1H", data: alignment.scores_1h },
    { label: "4H", data: alignment.scores_4h },
  ];

  const tooltipText = tfData
    .map((tf) => `${tf.label}: ${tf.data ? `${tf.data.trend} (${Math.round(tf.data.score)})` : "N/A"}`)
    .join(" · ") + `\nMTF Alignment: ${alignment.label} ${alignment.direction} (${alignment.bull_count + alignment.bear_count > 0 ? `${Math.max(alignment.bull_count, alignment.bear_count)}/${alignment.bull_count + alignment.bear_count + (4 - alignment.bull_count - alignment.bear_count)}` : "N/A"})`;

  const alignedCount = Math.max(alignment.bull_count, alignment.bear_count);
  const totalChecked = alignment.bull_count + alignment.bear_count + (4 - alignment.bull_count - alignment.bear_count);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 mt-0.5">
          <div className="flex gap-[2px]">
            {tfData.map((tf) => (
              <div
                key={tf.label}
                className="w-[6px] h-[6px] rounded-[1px]"
                style={{ background: tf.data ? trendColor(tf.data.trend) : "hsl(var(--muted))" }}
              />
            ))}
          </div>
          <span
            className="text-[7px] font-mono font-bold leading-none"
            style={{ color: labelBadgeColor(alignment.label) }}
          >
            {alignment.label === "Conflicting" ? "⚡" : `${alignedCount}/4`}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px] font-mono whitespace-pre-line max-w-[280px]">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

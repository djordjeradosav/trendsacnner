import { MacroIndicator } from "@/hooks/useMacroData";

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

interface BeatRateBannerProps {
  beatCount: number;
  totalCount: number;
  beatRate: number;
  streak: { count: number; direction: string };
  biggestBeat?: MacroIndicator;
  biggestMiss?: MacroIndicator;
  lowerIsBetter: boolean;
  unit: string;
  formatValue: (v: number | null | undefined) => string;
}

export function BeatRateBanner({
  beatCount, totalCount, beatRate, streak,
  biggestBeat, biggestMiss, lowerIsBetter, unit, formatValue,
}: BeatRateBannerProps) {
  const beatLabel = lowerIsBetter
    ? "Came in lower than expected (beat)"
    : "Beat forecast";

  return (
    <div className="rounded-lg p-4 bg-card border border-border">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm text-foreground font-medium">
            {beatLabel} {beatCount}/{totalCount} times ({beatRate}%)
          </p>
          {streak.count > 0 && (
            <p className="text-[11px] mt-1 text-muted-foreground">
              Current streak:{" "}
              <span className="text-foreground font-medium">
                {streak.count} consecutive {streak.direction}
              </span>
            </p>
          )}
          <div className="mt-2 w-full h-1.5 rounded-full" style={{ background: "hsl(var(--border))" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${beatRate}%`, background: "hsl(var(--bullish))" }}
            />
          </div>
        </div>
        <div className="text-[11px] space-y-1 text-muted-foreground">
          {biggestBeat && (
            <div>
              Biggest beat:{" "}
              <span style={{ color: "hsl(var(--bullish))" }}>
                {formatValue(biggestBeat.surprise)}
              </span>{" "}
              on {formatDate(biggestBeat.release_date)}
            </div>
          )}
          {biggestMiss && (
            <div>
              Biggest miss:{" "}
              <span style={{ color: "hsl(var(--bearish))" }}>
                {formatValue(biggestMiss.surprise)}
              </span>{" "}
              on {formatDate(biggestMiss.release_date)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

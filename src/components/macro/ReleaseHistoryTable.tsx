import { MacroIndicator } from "@/hooks/useMacroData";

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

const beatMissConfig = (lowerIsBetter: boolean): Record<string, { bg: string; color: string; label: string }> => ({
  beat: {
    bg: lowerIsBetter ? "rgba(59,130,246,0.15)" : "hsl(155 100% 10%)",
    color: lowerIsBetter ? "#3b82f6" : "hsl(var(--bullish))",
    label: lowerIsBetter ? "LOWER ✓" : "BEAT",
  },
  miss: {
    bg: lowerIsBetter ? "rgba(239,68,68,0.15)" : "hsl(0 60% 10%)",
    color: lowerIsBetter ? "#ef4444" : "hsl(var(--bearish))",
    label: lowerIsBetter ? "HIGHER ✗" : "MISS",
  },
  inline: { bg: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))", label: "IN-LINE" },
  pending: { bg: "hsl(var(--secondary))", color: "#3d5a70", label: "PENDING" },
});

interface Props {
  data: MacroIndicator[];
  formatValue: (v: number | null | undefined) => string;
  unit: string;
  lowerIsBetter: boolean;
}

export function ReleaseHistoryTable({ data, formatValue, lowerIsBetter }: Props) {
  return (
    <div className="rounded-lg overflow-hidden bg-card border border-border">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-medium text-foreground">Release History</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-background">
              {["Release Date", "Actual", "Forecast", "Previous", "Surprise", "Beat/Miss"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const bm = row.beat_miss ?? "pending";
              const cfg = beatMissConfig[bm] ?? beatMissConfig.pending;
              const borderColor =
                bm === "beat" ? "hsl(var(--bullish))" : bm === "miss" ? "hsl(var(--bearish))" : "transparent";

              return (
                <tr
                  key={row.id}
                  className="transition-colors"
                  style={{
                    borderLeft: `3px solid ${borderColor}`,
                    background: i === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                  }}
                >
                  <td className="px-4 py-2 text-foreground">{formatDate(row.release_date)}</td>
                  <td className="px-4 py-2 text-foreground">{formatValue(row.actual)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatValue(row.forecast)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatValue(row.previous)}</td>
                  <td className="px-4 py-2">
                    {row.surprise != null ? (
                      <span
                        style={{
                          color:
                            row.surprise > 0
                              ? lowerIsBetter ? "hsl(var(--bearish))" : "hsl(var(--bullish))"
                              : lowerIsBetter ? "hsl(var(--bullish))" : "hsl(var(--bearish))",
                        }}
                      >
                        {(row.surprise > 0 ? "+" : "") + row.surprise.toFixed(2)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-block text-[10px] font-medium rounded px-2 py-0.5"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

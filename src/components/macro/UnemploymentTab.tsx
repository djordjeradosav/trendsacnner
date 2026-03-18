import { useState, useMemo } from "react";
import { useMacroData } from "@/hooks/useMacroData";
import { StatCards } from "@/components/macro/StatCards";
import { BeatRateBanner } from "@/components/macro/BeatRateBanner";
import { DateRangeFilter } from "@/components/macro/DateRangeFilter";
import { MacroSkeleton } from "@/components/macro/MacroSkeleton";
import { formatDate, formatDateShort, formatPct, filterByRange, BeatMissBadge } from "@/lib/macroHelpers";
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from "recharts";

function computeStreak(data: { beat_miss: string | null }[]) {
  if (!data?.length) return { count: 0, direction: "pending" };
  const dir = data[0]?.beat_miss;
  if (!dir || dir === "pending" || dir === "inline") return { count: 0, direction: "pending" };
  let count = 0;
  for (const d of data) { if (d.beat_miss === dir) count++; else break; }
  return { count, direction: dir };
}

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  const fill = payload.beatMiss === "beat" ? "#22c55e" : payload.beatMiss === "miss" ? "#ef4444" : "#7a99b0";
  return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="#0d1117" strokeWidth={1} />;
};

export function UnemploymentTab() {
  const {
    data, sorted, latest, previous, beatCount, totalCount,
    beatRate, biggestBeat, biggestMiss, isLoading,
  } = useMacroData("UNEMPLOYMENT");
  const [range, setRange] = useState("2y");

  if (isLoading) return <MacroSkeleton message="Loading Unemployment data..." />;

  const filtered = filterByRange(sorted, range);
  const streak = computeStreak(data ?? []);
  const change = latest && previous && latest.actual != null && previous.actual != null
    ? latest.actual - previous.actual : null;

  const rate = latest?.actual ?? 4.0;
  const pctPos = Math.min(rate / 8 * 100, 100);

  const chartData = filtered.map((d) => ({
    date: formatDateShort(d.release_date),
    rate: d.actual,
    forecast: d.forecast,
    beatMiss: d.beat_miss,
  }));

  const statCards = [
    {
      label: "Current Rate",
      value: latest?.actual != null ? latest.actual.toFixed(1) + "%" : "—",
      subLabel: latest?.beat_miss === "beat" ? "✓ Lower than expected" : "✗ Higher than expected",
      color: latest?.actual != null
        ? latest.actual < 4.0 ? "#22c55e" : latest.actual < 4.5 ? "#f59e0b" : "#ef4444"
        : undefined,
      badge: latest ? <BeatMissBadge beatMiss={latest.beat_miss} /> : null,
    },
    {
      label: "Forecast",
      value: latest?.forecast != null ? latest.forecast.toFixed(1) + "%" : "N/A",
    },
    {
      label: "Previous",
      value: previous?.actual != null ? previous.actual.toFixed(1) + "%" : "—",
    },
    {
      label: "Change",
      value: change != null ? (change > 0 ? "+" : "") + change.toFixed(1) + "%" : "—",
      subLabel: change != null ? (change < 0 ? "Rate fell ↓" : change > 0 ? "Rate rose ↑" : "Unchanged") : "",
      color: change != null ? (change < 0 ? "#22c55e" : change > 0 ? "#ef4444" : "#7a99b0") : undefined,
    },
  ];

  const beatMissLabel = (bm: string | null) => {
    const cfgs: Record<string, { bg: string; color: string; label: string }> = {
      beat: { bg: "hsl(155 100% 10%)", color: "#22c55e", label: "LOWER ✓" },
      miss: { bg: "hsl(0 60% 10%)", color: "#ef4444", label: "HIGHER ✗" },
      inline: { bg: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))", label: "IN-LINE" },
      pending: { bg: "hsl(var(--secondary))", color: "#3d5a70", label: "PENDING" },
    };
    return cfgs[bm ?? "pending"] ?? cfgs.pending;
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Unemployment Rate — USA</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Civilian unemployment as % of labour force · Released monthly
        </p>
      </div>

      <div className="rounded-lg px-4 py-3 text-xs bg-background border border-border text-muted-foreground">
        Lower than expected = BEAT (strong economy, bullish USD).
        Higher than expected = MISS (weak economy, bearish USD).
      </div>

      <StatCards cards={statCards} />

      {/* Level Gauge */}
      <div className="rounded-lg p-4 bg-card border border-border">
        <div style={{ position: "relative", height: "52px" }}>
          <div style={{ position: "absolute", top: "20px", left: 0, right: 0, height: "8px", background: "hsl(var(--border))", borderRadius: "4px" }} />
          <div style={{ position: "absolute", top: "20px", left: 0, width: (3.5 / 8 * 100) + "%", height: "8px", background: "rgba(34,197,94,0.45)", borderRadius: "4px 0 0 4px" }} />
          <div style={{ position: "absolute", top: "20px", left: (3.5 / 8 * 100) + "%", width: (1 / 8 * 100) + "%", height: "8px", background: "rgba(245,158,11,0.45)" }} />
          <div style={{ position: "absolute", top: "20px", left: (4.5 / 8 * 100) + "%", right: 0, height: "8px", background: "rgba(239,68,68,0.45)", borderRadius: "0 4px 4px 0" }} />
          <div style={{ position: "absolute", top: "12px", left: pctPos + "%", transform: "translateX(-50%)", width: "3px", height: "24px", background: "#ffffff", borderRadius: "2px" }} />
          {[0, 2, 4, 6, 8].map((v) => (
            <span key={v} style={{ position: "absolute", top: "36px", left: (v / 8 * 100) + "%", transform: "translateX(-50%)", fontSize: "10px", color: "#7a99b0" }}>{v}%</span>
          ))}
        </div>
        <div className="flex justify-between text-[10px] mt-2" style={{ color: "#3d5a70" }}>
          <span style={{ color: "#22c55e" }}>Full employment ≤3.5%</span>
          <span style={{ color: "#f59e0b" }}>Moderate 3.5–4.5%</span>
          <span style={{ color: "#ef4444" }}>Elevated &gt;4.5%</span>
        </div>
      </div>

      <BeatRateBanner
        beatCount={beatCount}
        totalCount={totalCount}
        beatRate={beatRate}
        streak={streak}
        biggestBeat={biggestBeat}
        biggestMiss={biggestMiss}
        lowerIsBetter={true}
        unit="%"
        formatValue={(v) => v != null ? v.toFixed(1) + "%" : "—"}
      />

      <DateRangeFilter value={range} onChange={setRange} />

      {/* Main Chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg p-4 bg-card border border-border">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7a99b0", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#7a99b0", fontSize: 10 }} axisLine={false} tickLine={false} domain={[2.5, 7]} tickFormatter={(v) => v + "%"} />
              <ReferenceLine y={3.5} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "3.5% (full emp.)", fill: "#22c55e", fontSize: 10, position: "right" }} />
              <ReferenceLine y={4.0} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "4.0%", fill: "#f59e0b", fontSize: 10, position: "right" }} />
              <ReferenceLine y={4.5} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "4.5%", fill: "#ef4444", fontSize: 10, position: "right" }} />
              <Line dataKey="rate" name="Unemployment Rate" type="monotone" stroke="#22d3ee" strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 5 }} />
              <Scatter dataKey="forecast" name="Forecast" fill="#f59e0b" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "#e8f4f8", fontSize: "12px" }}
                formatter={(v: number, n: string) => [v.toFixed(1) + "%", n]}
              />
              <Legend wrapperStyle={{ color: "#7a99b0", fontSize: "11px" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History Table */}
      <div className="rounded-lg overflow-hidden bg-card border border-border">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">Release History</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-background">
                {["Date", "Rate", "Forecast", "Previous", "Change", "Beat/Miss"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row, i) => {
                const bm = row.beat_miss ?? "pending";
                const cfg = beatMissLabel(bm);
                const rowChange = row.actual != null && row.previous != null ? row.actual - row.previous : null;
                const borderColor = bm === "beat" ? "#22c55e" : bm === "miss" ? "#ef4444" : "transparent";

                return (
                  <tr
                    key={row.id}
                    className="transition-colors"
                    style={{ borderLeft: `3px solid ${borderColor}`, background: i === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}
                  >
                    <td className="px-4 py-2 text-foreground">{formatDate(row.release_date)}</td>
                    <td className="px-4 py-2 text-foreground">{row.actual != null ? row.actual.toFixed(1) + "%" : "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{row.forecast != null ? row.forecast.toFixed(1) + "%" : "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{row.previous != null ? row.previous.toFixed(1) + "%" : "—"}</td>
                    <td className="px-4 py-2">
                      {rowChange != null ? (
                        <span style={{ color: rowChange < 0 ? "#22c55e" : rowChange > 0 ? "#ef4444" : "#7a99b0" }}>
                          {(rowChange > 0 ? "+" : "") + rowChange.toFixed(1) + "%"}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-block text-[10px] font-medium rounded px-2 py-0.5" style={{ background: cfg.bg, color: cfg.color }}>
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
    </div>
  );
}

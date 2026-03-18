import { useState, useMemo } from "react";
import { useMacroData } from "@/hooks/useMacroData";
import { StatCards } from "@/components/macro/StatCards";
import { BeatRateBanner } from "@/components/macro/BeatRateBanner";
import { DateRangeFilter } from "@/components/macro/DateRangeFilter";
import { MacroSkeleton } from "@/components/macro/MacroSkeleton";
import { formatDate, formatDateShort, formatPct, filterByRange, BeatMissBadge } from "@/lib/macroHelpers";
import {
  ComposedChart, Area, Line, Scatter, XAxis, YAxis, CartesianGrid,
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

export function PceTab() {
  const pceData = useMacroData("PCE");
  const coreData = useMacroData("CORE_PCE");
  const [range, setRange] = useState("2y");

  if (pceData.isLoading || coreData.isLoading)
    return <MacroSkeleton message="Loading PCE data..." />;

  if (!pceData.hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <p className="text-3xl">📊</p>
        <p className="text-sm font-medium text-foreground">No data loaded yet</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Click "⚡ Load all macro data" above to fetch from FRED API.
        </p>
      </div>
    );
  }

  const filtered = filterByRange(pceData.sorted, range);
  const coreFiltered = filterByRange(coreData.sorted, range);

  const latest = pceData.latest;
  const coreLatest = coreData.latest;
  const vsTarget = latest?.actual != null ? latest.actual - 2.0 : null;
  const streak = computeStreak(pceData.data ?? []);

  const chartData = filtered.map((d) => {
    const coreMatch = coreFiltered.find((c) => c.release_date === d.release_date);
    return {
      date: formatDateShort(d.release_date),
      pce: d.actual,
      corePce: coreMatch?.actual ?? null,
      forecast: d.forecast,
    };
  });

  const statCards = [
    {
      label: "PCE",
      value: latest?.actual != null ? latest.actual.toFixed(2) + "%" : "—",
      subLabel: latest ? formatDate(latest.release_date) : "",
      color: latest?.actual != null
        ? latest.actual > 2.5 ? "#ef4444" : latest.actual > 2.0 ? "#f59e0b" : "#22c55e"
        : undefined,
    },
    {
      label: "Fed Target",
      value: "2.0%",
      subLabel: "Annual inflation target",
      color: "#22c55e",
      badge: (
        <span
          className="inline-block text-[10px] font-medium rounded px-2 py-0.5"
          style={{ background: "hsl(155 100% 10%)", color: "#22c55e" }}
        >
          TARGET
        </span>
      ),
    },
    {
      label: "Core PCE",
      value: coreLatest?.actual != null ? coreLatest.actual.toFixed(2) + "%" : "—",
      color: "#a78bfa",
    },
    {
      label: "vs Target",
      value: vsTarget != null ? (vsTarget > 0 ? "+" : "") + vsTarget.toFixed(2) + "%" : "—",
      color: vsTarget != null ? (vsTarget > 0 ? "#ef4444" : "#22c55e") : undefined,
      subLabel: vsTarget != null ? (vsTarget > 0 ? "Above target" : "Below target") : "",
    },
  ];

  // Merge PCE + Core PCE for the history table
  const historyRows = (pceData.data ?? []).map((row) => {
    const coreMatch = (coreData.data ?? []).find((c) => c.release_date === row.release_date);
    return { ...row, corePce: coreMatch?.actual ?? null };
  });

  const beatMissConfig = (bm: string | null) => {
    const configs: Record<string, { bg: string; color: string; label: string }> = {
      beat: { bg: "rgba(59,130,246,0.15)", color: "#3b82f6", label: "LOWER ✓" },
      miss: { bg: "rgba(239,68,68,0.15)", color: "#ef4444", label: "HIGHER ✗" },
      inline: { bg: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))", label: "IN-LINE" },
      pending: { bg: "hsl(var(--secondary))", color: "#3d5a70", label: "PENDING" },
    };
    return configs[bm ?? "pending"] ?? configs.pending;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">PCE — Personal Consumption Expenditures</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          The Federal Reserve's preferred inflation measure
        </p>
      </div>

      {/* Info box */}
      <div
        className="rounded-lg px-4 py-3 text-xs text-muted-foreground"
        style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)" }}
      >
        PCE tends to run slightly lower than CPI because it adjusts for changes in consumer behaviour.
        The Fed uses PCE to guide interest rate decisions and targets 2.0% annual inflation.
      </div>

      <StatCards cards={statCards} />

      <BeatRateBanner
        beatCount={pceData.beatCount}
        totalCount={pceData.totalCount}
        beatRate={pceData.beatRate}
        streak={streak}
        biggestBeat={pceData.biggestBeat}
        biggestMiss={pceData.biggestMiss}
        lowerIsBetter={true}
        unit="%"
        formatValue={formatPct}
      />

      <DateRangeFilter value={range} onChange={setRange} />

      {/* Main Chart — Dual line + Fed target */}
      {chartData.length > 0 && (
        <div className="rounded-lg p-4 bg-card border border-border">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7a99b0", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#7a99b0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} domain={["auto", "auto"]} />
              <ReferenceLine y={2.0} stroke="#22c55e" strokeDasharray="6 3" label={{ value: "Fed 2% Target", fill: "#22c55e", fontSize: 10, position: "insideTopRight" }} />
              <ReferenceLine y={2.5} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "2.5%", fill: "#f59e0b", fontSize: 10, position: "right" }} />
              <ReferenceLine y={3.0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "3.0%", fill: "#ef4444", fontSize: 10, position: "right" }} />
              <Area dataKey="pce" name="PCE" type="monotone" stroke="#a78bfa" strokeWidth={2} fill="rgba(167,139,250,0.08)" dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }} />
              <Line dataKey="corePce" name="Core PCE" type="monotone" stroke="#60a5fa" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: "#60a5fa", strokeWidth: 0 }} />
              <Scatter dataKey="forecast" name="Forecast" fill="#f59e0b" />
              <Legend wrapperStyle={{ color: "#7a99b0", fontSize: "11px" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "#e8f4f8", fontSize: "12px" }}
                formatter={(v: number, n: string) => [v?.toFixed(2) + "%", n]}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History Table with vs Target column */}
      <div className="rounded-lg overflow-hidden bg-card border border-border">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">Release History</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-background">
                {["Date", "PCE", "Core PCE", "Forecast", "Previous", "vs 2% Target", "Surprise", "Beat/Miss"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historyRows.map((row, i) => {
                const bm = row.beat_miss ?? "pending";
                const cfg = beatMissConfig(bm);
                const targetDiff = row.actual != null ? row.actual - 2.0 : null;
                const borderColor = bm === "beat" ? "#3b82f6" : bm === "miss" ? "#ef4444" : "transparent";

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
                    <td className="px-4 py-2 text-foreground">{row.actual != null ? row.actual.toFixed(2) + "%" : "—"}</td>
                    <td className="px-4 py-2" style={{ color: "#a78bfa" }}>
                      {row.corePce != null ? row.corePce.toFixed(2) + "%" : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{row.forecast != null ? row.forecast.toFixed(2) + "%" : "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{row.previous != null ? row.previous.toFixed(2) + "%" : "—"}</td>
                    <td className="px-4 py-2">
                      {targetDiff != null ? (
                        <span style={{ color: targetDiff > 0 ? "#ef4444" : "#22c55e" }}>
                          {(targetDiff > 0 ? "+" : "") + targetDiff.toFixed(2) + "%"}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {row.surprise != null ? (
                        <span style={{ color: row.surprise > 0 ? "#ef4444" : "#3b82f6" }}>
                          {(row.surprise > 0 ? "+" : "") + row.surprise.toFixed(2) + "%"}
                        </span>
                      ) : "—"}
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
    </div>
  );
}

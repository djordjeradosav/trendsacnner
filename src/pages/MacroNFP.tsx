import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useMacroData, MacroIndicator } from "@/hooks/useMacroData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  ComposedChart, Bar, Line, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer, Cell,
} from "recharts";

const formatK = (v: number | null | undefined) => {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(0) + "k";
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

const formatShortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function computeStreak(data: MacroIndicator[]) {
  if (!data.length) return { count: 0, direction: "pending" };
  const direction = data[0]?.beat_miss;
  if (!direction || direction === "pending" || direction === "inline") return { count: 0, direction: "pending" };
  let count = 0;
  for (const d of data) {
    if (d.beat_miss === direction) count++;
    else break;
  }
  return { count, direction };
}

const RANGE_MONTHS: Record<string, number> = { "6M": 6, "1Y": 12, "2Y": 24, ALL: 999 };

export default function MacroNFP() {
  const { sorted, latest, previous, beatCount, totalCount, beatRate, biggestBeat, biggestMiss, isLoading, refetch, data } = useMacroData("NFP");
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState("2Y");

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("fetch-fred-data", { body: { indicator: "NFP" } });
      await new Promise((r) => setTimeout(r, 3000));
      await refetch();
      toast.success("NFP data refreshed");
    } catch {
      toast.error("Failed to refresh");
    }
    setRefreshing(false);
  };

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - (RANGE_MONTHS[range] ?? 999));
  const filtered = sorted.filter((d) => new Date(d.release_date) >= cutoff);

  const chartData = filtered.map((d) => ({
    date: formatShortDate(d.release_date),
    actual: d.actual,
    forecast: d.forecast,
    surprise: d.actual != null && d.forecast != null ? d.actual - d.forecast : null,
    beatMiss: d.beat_miss,
    color: d.beat_miss === "beat" ? "#22c55e" : d.beat_miss === "miss" ? "#ef4444" : "#3b82f6",
  }));

  const deviationData = filtered
    .filter((d) => d.forecast != null && d.actual != null)
    .map((d) => ({
      date: formatShortDate(d.release_date),
      deviation: d.actual! - d.forecast!,
      color: d.actual! - d.forecast! >= 0 ? "#22c55e" : "#ef4444",
    }));

  const streak = computeStreak(data ?? []);

  const beatMissConfig: Record<string, { bg: string; color: string; label: string }> = {
    beat: { bg: "#0d2b1a", color: "#22c55e", label: "BEAT" },
    miss: { bg: "#2b0d0d", color: "#ef4444", label: "MISS" },
    inline: { bg: "#1a1a1a", color: "#7a99b0", label: "IN-LINE" },
    pending: { bg: "#1a1a1a", color: "#3d5a70", label: "PENDING" },
  };

  const borderColors: Record<string, string> = {
    beat: "#22c55e", miss: "#ef4444", inline: "#3d5a70",
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Non-Farm Payroll — USA</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monthly US employment change, excluding farm workers
            </p>
          </div>
          <div className="flex items-center gap-3">
            {latest && (
              <span className="text-[11px]" style={{ color: "#3d5a70" }}>
                Last updated: {timeAgo(latest.created_at)}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{ background: "hsl(var(--secondary))", color: "hsl(var(--foreground))" }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Context note */}
        <div className="rounded-lg px-4 py-3 text-xs" style={{ background: "#0d1117", border: "1px solid hsl(var(--border))", color: "#7a99b0" }}>
          The reported value represents the prior month's employment data. A positive value = jobs added. Negative = jobs lost.
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">Loading NFP data...</div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Latest Release"
                value={formatK(latest?.actual)}
                color={latest?.beat_miss === "beat" ? "#22c55e" : latest?.beat_miss === "miss" ? "#ef4444" : undefined}
                sub={latest ? formatDate(latest.release_date) : ""}
              />
              <StatCard label="Forecast" value={latest?.forecast != null ? formatK(latest.forecast) : "N/A"} />
              <StatCard label="Previous" value={previous ? formatK(previous.actual) : "—"} />
              <StatCard
                label="Surprise"
                value={latest?.surprise != null ? formatK(latest.surprise) : "—"}
                color={latest?.beat_miss === "beat" ? "#22c55e" : latest?.beat_miss === "miss" ? "#ef4444" : undefined}
                badge={latest?.beat_miss === "beat" || latest?.beat_miss === "miss" ? latest.beat_miss.toUpperCase() : undefined}
                badgeColor={latest?.beat_miss === "beat" ? "#22c55e" : "#ef4444"}
              />
            </div>

            {/* Beat Rate Banner */}
            <div className="rounded-lg p-4" style={{ background: "#0d1117", border: "1px solid hsl(var(--border))" }}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-foreground font-medium">
                    Beat forecast {beatCount} / {totalCount} times ({beatRate}%)
                  </p>
                  <div className="mt-2 w-full h-1.5 rounded-full" style={{ background: "#1e2d3d" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${beatRate}%`, background: "#22c55e" }} />
                  </div>
                </div>
                <div className="text-[11px] space-y-1" style={{ color: "#7a99b0" }}>
                  {streak.count > 0 && (
                    <div>Current streak: <span className="text-foreground font-medium">{streak.count} consecutive {streak.direction}</span></div>
                  )}
                  {biggestBeat && (
                    <div>Biggest beat: <span style={{ color: "#22c55e" }}>{formatK(biggestBeat.surprise)}</span> on {formatDate(biggestBeat.release_date)}</div>
                  )}
                  {biggestMiss && (
                    <div>Biggest miss: <span style={{ color: "#ef4444" }}>{formatK(biggestMiss.surprise)}</span> on {formatDate(biggestMiss.release_date)}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Range selector */}
            <div className="flex items-center gap-1.5">
              {Object.keys(RANGE_MONTHS).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className="px-3 py-1 rounded text-[11px] font-medium transition-colors"
                  style={{
                    background: range === r ? "hsl(var(--primary))" : "hsl(var(--secondary))",
                    color: range === r ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Main Chart */}
            {chartData.length > 0 && (
              <div className="rounded-lg p-4" style={{ background: "#0d1117", border: "1px solid hsl(var(--border))" }}>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#7a99b0", fontSize: 11 }} axisLine={{ stroke: "#1e2d3d" }} tickLine={false} />
                    <YAxis tick={{ fill: "#7a99b0", fontSize: 11 }} axisLine={{ stroke: "#1e2d3d" }} tickLine={false} tickFormatter={(v) => v + "k"} />
                    <Tooltip
                      contentStyle={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: "8px", color: "#e8f4f8" }}
                      formatter={(value: number, name: string) => [value?.toFixed(0) + "k", name]}
                    />
                    <ReferenceLine y={0} stroke="#3d5a70" strokeDasharray="4 4" />
                    <Bar dataKey="actual" name="Actual" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                    <Scatter dataKey="forecast" name="Forecast" fill="#ef4444" />
                    <Line dataKey="actual" name="Trend" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                    <Legend wrapperStyle={{ color: "#7a99b0", fontSize: "12px" }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Deviation Chart */}
            {deviationData.length > 0 && (
              <div className="rounded-lg p-4" style={{ background: "#0d1117", border: "1px solid hsl(var(--border))" }}>
                <p className="text-xs text-muted-foreground mb-3">How much NFP beat or missed expectations</p>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={deviationData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#7a99b0", fontSize: 11 }} axisLine={{ stroke: "#1e2d3d" }} tickLine={false} />
                    <YAxis tick={{ fill: "#7a99b0", fontSize: 11 }} axisLine={{ stroke: "#1e2d3d" }} tickLine={false} tickFormatter={(v) => v + "k"} />
                    <Tooltip
                      contentStyle={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: "8px", color: "#e8f4f8" }}
                      formatter={(value: number) => [value?.toFixed(0) + "k", "Deviation"]}
                    />
                    <ReferenceLine y={0} stroke="#7a99b0" strokeWidth={1} />
                    <Bar dataKey="deviation" name="Actual − Forecast" radius={[3, 3, 0, 0]}>
                      {deviationData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Release History Table */}
            <div className="rounded-lg overflow-hidden" style={{ background: "#0d1117", border: "1px solid hsl(var(--border))" }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
                <p className="text-sm font-medium text-foreground">Release History</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ background: "#080c10" }}>
                      {["Release Date", "Actual", "Forecast", "Previous", "Surprise", "Beat/Miss"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ color: "#7a99b0" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data ?? []).map((row, i) => {
                      const bm = row.beat_miss ?? "pending";
                      const cfg = beatMissConfig[bm] ?? beatMissConfig.pending;
                      return (
                        <tr
                          key={row.id}
                          className="transition-colors"
                          style={{
                            borderLeft: borderColors[bm] ? `3px solid ${borderColors[bm]}` : "3px solid transparent",
                            background: i === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                          }}
                        >
                          <td className="px-4 py-2 text-foreground">{formatDate(row.release_date)}</td>
                          <td className="px-4 py-2 text-foreground">{row.actual != null ? row.actual + "k" : "—"}</td>
                          <td className="px-4 py-2" style={{ color: "#7a99b0" }}>{row.forecast != null ? row.forecast + "k" : "—"}</td>
                          <td className="px-4 py-2" style={{ color: "#7a99b0" }}>{row.previous != null ? row.previous + "k" : "—"}</td>
                          <td className="px-4 py-2">
                            {row.surprise != null ? (
                              <span style={{ color: row.surprise > 0 ? "#22c55e" : "#ef4444" }}>
                                {(row.surprise > 0 ? "+" : "") + row.surprise.toFixed(0) + "k"}
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
          </>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({
  label, value, color, sub, badge, badgeColor,
}: {
  label: string; value: string; color?: string; sub?: string;
  badge?: string; badgeColor?: string;
}) {
  return (
    <div className="rounded-lg p-3.5" style={{ background: "#0d1117", border: "1px solid hsl(var(--border))" }}>
      <p className="text-[11px] font-medium" style={{ color: "#7a99b0" }}>{label}</p>
      <p className="text-lg font-bold mt-1 font-mono" style={{ color: color ?? "hsl(var(--foreground))" }}>
        {value}
      </p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: "#3d5a70" }}>{sub}</p>}
      {badge && (
        <span
          className="inline-block mt-1 text-[9px] font-semibold rounded px-2 py-0.5"
          style={{ background: badgeColor === "#22c55e" ? "#0d2b1a" : "#2b0d0d", color: badgeColor }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

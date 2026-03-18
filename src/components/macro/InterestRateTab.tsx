import { useState, useMemo } from "react";
import { useMacroData, MacroIndicator } from "@/hooks/useMacroData";
import { filterByRange, formatDate, formatDateShort } from "@/lib/macroHelpers";
import { MacroSkeleton } from "@/components/macro/MacroSkeleton";
import { StatCards } from "@/components/macro/StatCards";
import { DateRangeFilter } from "@/components/macro/DateRangeFilter";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

export function InterestRateTab() {
  const { data, sorted, latest, previous, isLoading } = useMacroData("INTEREST_RATE");
  const [range, setRange] = useState("all");
  const filtered = useMemo(() => filterByRange(sorted, range), [sorted, range]);

  if (isLoading) return <MacroSkeleton message="Loading Interest Rate data..." />;

  const rateChange = latest && previous ? latest.actual! - previous.actual! : 0;
  const direction = rateChange > 0.01 ? "hike" : rateChange < -0.01 ? "cut" : "hold";
  const rateRange = latest
    ? (latest.actual! - 0.25).toFixed(2) + "% – " + latest.actual!.toFixed(2) + "%"
    : "—";

  const lastChangedDate = sorted.find(
    (d, i) => i > 0 && Math.abs(d.actual! - (sorted[i - 1]?.actual ?? d.actual!)) >= 0.1
  );
  const daysSince = lastChangedDate
    ? Math.floor((Date.now() - new Date(lastChangedDate.release_date).getTime()) / 86400000)
    : null;

  const cycleData = [...sorted].filter((d) => d.actual != null && d.actual < 0.5);
  const cycleStart = cycleData[cycleData.length - 1];
  const totalCycle = latest && cycleStart ? latest.actual! - cycleStart.actual! : null;

  const chartData = filtered.map((d) => ({
    date: formatDateShort(d.release_date),
    rate: d.actual,
  }));

  const decisions = sorted
    .map((d, i) => ({
      ...d,
      rateBefore: sorted[i + 1]?.actual,
      change: d.actual! - (sorted[i + 1]?.actual ?? d.actual!),
    }))
    .filter((d) => Math.abs(d.change) >= 0.1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">Interest Rate — Federal Funds Rate</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Benchmark interest rate set by the Federal Reserve · Updated after each FOMC meeting
        </p>
      </div>

      {/* Hero Card */}
      <div
        className="rounded-xl border border-border p-5 flex flex-wrap justify-between items-center gap-4"
        style={{
          background:
            (latest?.actual ?? 0) > 4
              ? "hsla(0, 60%, 50%, 0.06)"
              : (latest?.actual ?? 0) > 2
              ? "hsla(38, 90%, 50%, 0.06)"
              : "hsla(142, 70%, 50%, 0.06)",
        }}
      >
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Current Federal Funds Rate
          </p>
          <p className="text-4xl font-bold font-mono text-foreground">
            {latest?.actual?.toFixed(2) ?? "—"}%
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">
            Target range: {rateRange}
          </p>
        </div>
        <div className="text-right">
          {lastChangedDate && (
            <p className="text-xs text-muted-foreground mb-2">
              Last changed: {formatDate(lastChangedDate.release_date)}
            </p>
          )}
          {daysSince != null && (
            <p className="text-xs text-muted-foreground mb-2">
              In effect for: {daysSince} days
            </p>
          )}
          <span
            className="inline-block text-[13px] font-semibold rounded-md px-3.5 py-1.5"
            style={{
              background:
                direction === "hike"
                  ? "hsl(155 100% 10%)"
                  : direction === "cut"
                  ? "hsl(0 60% 10%)"
                  : "hsl(var(--secondary))",
              color:
                direction === "hike"
                  ? "hsl(var(--bullish))"
                  : direction === "cut"
                  ? "hsl(var(--bearish))"
                  : "hsl(var(--muted-foreground))",
            }}
          >
            {direction === "hike" ? "▲ HIKE" : direction === "cut" ? "▼ CUT" : "─ HOLD"}
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <StatCards
        cards={[
          {
            label: "Current Rate",
            value: latest?.actual != null ? latest.actual.toFixed(2) + "%" : "—",
          },
          {
            label: "Previous",
            value: previous?.actual != null ? previous.actual.toFixed(2) + "%" : "—",
          },
          {
            label: "Last Change",
            value:
              rateChange !== 0
                ? (rateChange > 0 ? "+" : "") + rateChange.toFixed(2) + "%"
                : "No change",
            color:
              direction === "hike"
                ? "hsl(var(--bullish))"
                : direction === "cut"
                ? "hsl(var(--bearish))"
                : "hsl(var(--muted-foreground))",
          },
          {
            label: "Cycle total",
            value:
              totalCycle != null
                ? (totalCycle > 0 ? "+" : "") + totalCycle.toFixed(2) + "%"
                : "—",
            subLabel:
              totalCycle != null
                ? totalCycle > 0
                  ? "total hikes this cycle"
                  : "total cuts this cycle"
                : undefined,
            color:
              totalCycle != null
                ? totalCycle > 0
                  ? "hsl(var(--bullish))"
                  : "hsl(var(--bearish))"
                : undefined,
          },
        ]}
      />

      {/* Chart */}
      <DateRangeFilter value={range} onChange={setRange} />

      {chartData.length > 0 && (
        <div className="rounded-lg p-4 bg-card border border-border">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 20, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(207 35% 18%)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#7a99b0", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#7a99b0", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={[0, "auto"]}
                tickFormatter={(v) => v + "%"}
              />
              <ReferenceLine
                y={2.5}
                stroke="#7a99b0"
                strokeDasharray="4 4"
                label={{ value: "Neutral ~2.5%", fill: "#7a99b0", fontSize: 10, position: "right" }}
              />
              <Area
                dataKey="rate"
                name="Fed Funds Rate"
                type="stepAfter"
                stroke="#60a5fa"
                strokeWidth={2.5}
                fill="rgba(96,165,250,0.1)"
                dot={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(210 30% 7%)",
                  border: "1px solid hsl(207 35% 18%)",
                  borderRadius: "8px",
                  color: "#e8f4f8",
                  fontSize: "12px",
                }}
                formatter={(v: number) => [v.toFixed(2) + "%", "Fed Funds Rate"]}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* FOMC Decisions Table */}
      {decisions.length > 0 && (
        <div className="rounded-lg overflow-hidden bg-card border border-border">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground">FOMC Rate Decisions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-background">
                  {["FOMC Date", "Decision", "Rate Before", "Rate After", "Change"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[11px]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decisions.map((d, i) => (
                  <tr
                    key={i}
                    className="border-b border-border transition-colors"
                    style={{
                      borderLeft: `3px solid ${
                        d.change > 0 ? "hsl(var(--bullish))" : "hsl(var(--bearish))"
                      }`,
                    }}
                  >
                    <td className="px-4 py-2.5 text-foreground">
                      {formatDate(d.release_date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-block text-[11px] font-semibold rounded px-2.5 py-0.5"
                        style={{
                          background: d.change > 0 ? "hsl(155 100% 10%)" : "hsl(0 60% 10%)",
                          color:
                            d.change > 0
                              ? "hsl(var(--bullish))"
                              : "hsl(var(--bearish))",
                        }}
                      >
                        {d.change > 0 ? "▲ HIKE" : "▼ CUT"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">
                      {d.rateBefore != null ? d.rateBefore.toFixed(2) + "%" : "—"}
                    </td>
                    <td
                      className="px-4 py-2.5 font-mono font-semibold"
                      style={{
                        color: d.change > 0 ? "hsl(var(--bullish))" : "hsl(var(--bearish))",
                      }}
                    >
                      {d.actual!.toFixed(2)}%
                    </td>
                    <td
                      className="px-4 py-2.5 font-mono"
                      style={{
                        color: d.change > 0 ? "hsl(var(--bullish))" : "hsl(var(--bearish))",
                      }}
                    >
                      {(d.change > 0 ? "+" : "") + d.change.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

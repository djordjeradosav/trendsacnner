import { useState, useMemo } from "react";
import { useMacroData } from "@/hooks/useMacroData";
import { StatCards } from "@/components/macro/StatCards";
import { BeatRateBanner } from "@/components/macro/BeatRateBanner";
import { ReleaseHistoryTable } from "@/components/macro/ReleaseHistoryTable";
import { DateRangeFilter } from "@/components/macro/DateRangeFilter";
import { MacroSkeleton } from "@/components/macro/MacroSkeleton";
import {
  ComposedChart, Bar, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, Cell, ResponsiveContainer,
} from "recharts";

const RANGE_MAP: Record<string, number> = { "6m": 6, "1y": 12, "2y": 24, all: 999 };

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
const formatShortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
const formatPct = (v: number | null | undefined) =>
  v != null ? v.toFixed(2) + "%" : "—";

function computeStreak(data: { beat_miss: string | null }[]) {
  if (!data?.length) return { count: 0, direction: "pending" };
  const direction = data[0]?.beat_miss;
  if (!direction || direction === "pending" || direction === "inline") return { count: 0, direction: "pending" };
  let count = 0;
  for (const d of data) {
    if (d.beat_miss === direction) count++;
    else break;
  }
  return { count, direction };
}

const getBarColor = (beatMiss: string | null) =>
  beatMiss === "beat" ? "#3b82f6" : beatMiss === "miss" ? "#ef4444" : "#9ca3af";

interface CpiTabProps {
  indicator: string;
  title: string;
  subtitle?: string;
}

export function CpiTab({ indicator, title, subtitle }: CpiTabProps) {
  const {
    sorted, latest, previous, beatCount, totalCount, beatRate,
    biggestBeat, biggestMiss, isLoading, data, hasData,
  } = useMacroData(indicator);

  const [range, setRange] = useState("1y");

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - (RANGE_MAP[range] ?? 999));
    return d;
  }, [range]);

  const filtered = useMemo(
    () => sorted.filter((d) => new Date(d.release_date) >= cutoff),
    [sorted, cutoff]
  );

  const chartData = useMemo(
    () =>
      filtered.map((d) => ({
        date: formatShortDate(d.release_date),
        actual: d.actual,
        forecast: d.forecast,
        beatMiss: d.beat_miss,
      })),
    [filtered]
  );

  const deviationData = useMemo(
    () =>
      filtered
        .filter((d) => d.forecast != null && d.actual != null)
        .map((d) => ({
          date: formatShortDate(d.release_date),
          deviation: d.actual! - d.forecast!,
          // For CPI: positive = miss (higher inflation), negative = beat
          color: d.actual! - d.forecast! > 0 ? "#ef4444" : "#3b82f6",
        })),
    [filtered]
  );

  const streak = computeStreak(data ?? []);

  if (isLoading) return <MacroSkeleton message={`Loading ${title} data...`} />;

  if (!hasData) {
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

  const isCoreCpi = indicator === "CORE_CPI";

  // For CPI: positive surprise = miss (higher inflation), negative = beat
  const surpriseColor = latest?.surprise != null
    ? (latest.surprise > 0 ? "#ef4444" : "#3b82f6")
    : "#7a99b0";

  const beatMissBadge = (bm: string | null | undefined) => {
    if (!bm || bm === "pending" || bm === "inline") return null;
    const isBeat = bm === "beat";
    return (
      <span
        className="inline-block text-[9px] font-semibold rounded px-2 py-0.5"
        style={{
          background: isBeat ? "rgba(59,130,246,0.15)" : "rgba(239,68,68,0.15)",
          color: isBeat ? "#3b82f6" : "#ef4444",
        }}
      >
        {isBeat ? "LOWER ✓" : "HIGHER ✗"}
      </span>
    );
  };

  const statCards = [
    {
      label: "Latest",
      value: formatPct(latest?.actual),
      subLabel: latest ? formatDate(latest.release_date) : "",
      color: latest?.beat_miss === "beat" ? "#3b82f6" : latest?.beat_miss === "miss" ? "#ef4444" : undefined,
      badge: beatMissBadge(latest?.beat_miss),
    },
    {
      label: "Forecast",
      value: latest?.forecast != null ? formatPct(latest.forecast) : "N/A",
      subLabel: "Analyst consensus",
    },
    {
      label: "Previous",
      value: formatPct(previous?.actual),
      subLabel: previous ? formatDate(previous.release_date) : "",
    },
    {
      label: "Surprise",
      value: latest?.surprise != null
        ? (latest.surprise > 0 ? "+" : "") + latest.surprise.toFixed(2) + "%"
        : "—",
      color: surpriseColor,
      badge: beatMissBadge(latest?.beat_miss),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {subtitle ?? "Monthly change in consumer prices · Lower = better (less inflation)"}
        </p>
      </div>

      {/* Core CPI note */}
      {isCoreCpi && (
        <div className="rounded-lg px-4 py-3 text-xs bg-background border border-border text-muted-foreground">
          Core CPI strips out volatile food and energy prices.
          This is the Fed's primary inflation gauge for rate decisions.
        </div>
      )}

      {/* Legend note */}
      <p className="text-[10px] text-muted-foreground">
        <span style={{ color: "#ef4444" }}>■</span> Red bar = higher than expected (miss) ·{" "}
        <span style={{ color: "#3b82f6" }}>■</span> Blue bar = lower than expected (beat)
      </p>

      <StatCards cards={statCards} />

      <BeatRateBanner
        beatCount={beatCount}
        totalCount={totalCount}
        beatRate={beatRate}
        streak={streak}
        biggestBeat={biggestBeat}
        biggestMiss={biggestMiss}
        lowerIsBetter={true}
        unit="%"
        formatValue={formatPct}
      />

      <DateRangeFilter value={range} onChange={setRange} />

      {/* Main Chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg p-4 bg-card border border-border">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 24, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7a99b0", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#7a99b0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "#e8f4f8", fontSize: "12px" }}
                formatter={(v: number, n: string) => [v + "%", n]}
              />
              <Bar
                dataKey="actual"
                name="Actual"
                radius={[3, 3, 0, 0]}
                label={{ position: "top", fill: "#e8f4f8", fontSize: 9, formatter: (v: number) => v?.toFixed(1) + "%" }}
              >
                {chartData.map((e, i) => (
                  <Cell key={i} fill={getBarColor(e.beatMiss)} />
                ))}
              </Bar>
              <Scatter dataKey="forecast" name="Forecast" fill="#f59e0b" />
              <Legend wrapperStyle={{ color: "#7a99b0", fontSize: "11px" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Deviation Chart */}
      {deviationData.length > 0 && (
        <div className="rounded-lg p-4 bg-card border border-border">
          <p className="text-xs text-muted-foreground mb-3">
            Actual − Forecast deviation (positive = higher than expected)
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={deviationData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7a99b0", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#7a99b0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "#e8f4f8" }}
                formatter={(v: number) => [(v > 0 ? "+" : "") + v.toFixed(2) + "%", "Surprise"]}
              />
              <ReferenceLine y={0} stroke="#7a99b0" strokeWidth={1} />
              <Bar dataKey="deviation" name="Actual − Forecast" radius={[3, 3, 0, 0]}>
                {deviationData.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <ReleaseHistoryTable
        data={data ?? []}
        formatValue={formatPct}
        unit="%"
        lowerIsBetter={true}
      />
    </div>
  );
}

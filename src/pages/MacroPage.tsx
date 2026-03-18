import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMacroData, MacroIndicator } from "@/hooks/useMacroData";
import { StatCards } from "@/components/macro/StatCards";
import { BeatRateBanner } from "@/components/macro/BeatRateBanner";
import { ReleaseHistoryTable } from "@/components/macro/ReleaseHistoryTable";
import { DateRangeFilter } from "@/components/macro/DateRangeFilter";
import { MacroSkeleton } from "@/components/macro/MacroSkeleton";
import {
  ComposedChart, Bar, Line, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer, Cell,
} from "recharts";

const TABS = [
  { id: "nfp", indicator: "NFP", label: "NFP", color: "#3b82f6", unit: "k", lowerIsBetter: false, description: "Monthly US employment change, excluding farm workers" },
  { id: "cpi", indicator: "CPI", label: "CPI", color: "#f59e0b", unit: "%", lowerIsBetter: true, description: "Consumer Price Index — measures inflation from consumer goods" },
  { id: "core-cpi", indicator: "CORE_CPI", label: "Core CPI", color: "#f97316", unit: "%", lowerIsBetter: true, description: "CPI excluding food & energy — Fed's preferred inflation gauge" },
  { id: "pce", indicator: "PCE", label: "PCE", color: "#a78bfa", unit: "%", lowerIsBetter: true, description: "Personal Consumption Expenditures — alternative inflation measure" },
  { id: "unemployment", indicator: "UNEMPLOYMENT", label: "Unemployment", color: "#22d3ee", unit: "%", lowerIsBetter: true, description: "US unemployment rate — percentage of labor force without work" },
  { id: "interest-rate", indicator: "INTEREST_RATE", label: "Interest Rate", color: "#60a5fa", unit: "%", lowerIsBetter: false, description: "Federal Funds Rate — benchmark interest rate set by the Fed" },
];

const RANGE_MAP: Record<string, number> = { "6m": 6, "1y": 12, "2y": 24, all: 999 };

function computeStreak(data: MacroIndicator[]) {
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

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
const formatShortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

function MacroTabContent({ tab }: { tab: typeof TABS[number] }) {
  const {
    sorted, latest, previous, beatCount, totalCount, beatRate,
    biggestBeat, biggestMiss, isLoading, data,
  } = useMacroData(tab.indicator);

  const [range, setRange] = useState("2y");

  const formatValue = (v: number | null | undefined) => {
    if (v == null) return "—";
    if (tab.unit === "k") return (v >= 0 ? "+" : "") + v.toFixed(0) + "k";
    return v.toFixed(2) + "%";
  };

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
        surprise: d.actual != null && d.forecast != null ? d.actual - d.forecast : null,
        beatMiss: d.beat_miss,
        color: d.beat_miss === "beat"
          ? (tab.lowerIsBetter ? "#22c55e" : "#22c55e")
          : d.beat_miss === "miss"
          ? "#ef4444"
          : tab.color,
      })),
    [filtered, tab]
  );

  const deviationData = useMemo(
    () =>
      filtered
        .filter((d) => d.forecast != null && d.actual != null)
        .map((d) => ({
          date: formatShortDate(d.release_date),
          deviation: d.actual! - d.forecast!,
          color: tab.lowerIsBetter
            ? (d.actual! - d.forecast! <= 0 ? "#22c55e" : "#ef4444")
            : (d.actual! - d.forecast! >= 0 ? "#22c55e" : "#ef4444"),
        })),
    [filtered, tab]
  );

  const streak = computeStreak(data ?? []);

  if (isLoading) return <MacroSkeleton message={`Loading ${tab.label} data...`} />;

  const statCards = [
    {
      label: "Latest Release",
      value: formatValue(latest?.actual),
      subLabel: latest ? formatDate(latest.release_date) : "",
      color: latest?.beat_miss === "beat" ? "hsl(var(--bullish))" : latest?.beat_miss === "miss" ? "hsl(var(--bearish))" : undefined,
    },
    { label: "Forecast", value: latest?.forecast != null ? formatValue(latest.forecast) : "N/A" },
    { label: "Previous", value: previous ? formatValue(previous.actual) : "—" },
    {
      label: "Surprise",
      value: latest?.surprise != null ? formatValue(latest.surprise) : "—",
      color: latest?.beat_miss === "beat" ? "hsl(var(--bullish))" : latest?.beat_miss === "miss" ? "hsl(var(--bearish))" : undefined,
      badge: (latest?.beat_miss === "beat" || latest?.beat_miss === "miss") ? (
        <span
          className="inline-block text-[9px] font-semibold rounded px-2 py-0.5"
          style={{
            background: latest.beat_miss === "beat" ? "hsl(155 100% 10%)" : "hsl(0 60% 10%)",
            color: latest.beat_miss === "beat" ? "hsl(var(--bullish))" : "hsl(var(--bearish))",
          }}
        >
          {latest.beat_miss!.toUpperCase()}
        </span>
      ) : undefined,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Context */}
      <div className="rounded-lg px-4 py-3 text-xs bg-background border border-border text-muted-foreground">
        {tab.description}
      </div>

      <StatCards cards={statCards} />

      <BeatRateBanner
        beatCount={beatCount}
        totalCount={totalCount}
        beatRate={beatRate}
        streak={streak}
        biggestBeat={biggestBeat}
        biggestMiss={biggestMiss}
        lowerIsBetter={tab.lowerIsBetter}
        unit={tab.unit}
        formatValue={formatValue}
      />

      <DateRangeFilter value={range} onChange={setRange} />

      {/* Main Chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg p-4 bg-card border border-border">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(207 35% 18%)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7a99b0", fontSize: 11 }} axisLine={{ stroke: "hsl(207 35% 18%)" }} tickLine={false} />
              <YAxis tick={{ fill: "#7a99b0", fontSize: 11 }} axisLine={{ stroke: "hsl(207 35% 18%)" }} tickLine={false} tickFormatter={(v) => v + tab.unit} />
              <Tooltip
                contentStyle={{ background: "hsl(210 30% 7%)", border: "1px solid hsl(207 35% 18%)", borderRadius: "8px", color: "#e8f4f8" }}
                formatter={(value: number, name: string) => [value?.toFixed(tab.unit === "k" ? 0 : 2) + tab.unit, name]}
              />
              <ReferenceLine y={0} stroke="#3d5a70" strokeDasharray="4 4" />
              <Bar dataKey="actual" name="Actual" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
              <Scatter dataKey="forecast" name="Forecast" fill="#ef4444" />
              <Line dataKey="actual" name="Trend" stroke={tab.color} strokeWidth={1.5} dot={false} />
              <Legend wrapperStyle={{ color: "#7a99b0", fontSize: "12px" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Deviation Chart */}
      {deviationData.length > 0 && (
        <div className="rounded-lg p-4 bg-card border border-border">
          <p className="text-xs text-muted-foreground mb-3">
            How much {tab.label} {tab.lowerIsBetter ? "came in below or above" : "beat or missed"} expectations
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={deviationData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(207 35% 18%)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7a99b0", fontSize: 11 }} axisLine={{ stroke: "hsl(207 35% 18%)" }} tickLine={false} />
              <YAxis tick={{ fill: "#7a99b0", fontSize: 11 }} axisLine={{ stroke: "hsl(207 35% 18%)" }} tickLine={false} tickFormatter={(v) => v + tab.unit} />
              <Tooltip
                contentStyle={{ background: "hsl(210 30% 7%)", border: "1px solid hsl(207 35% 18%)", borderRadius: "8px", color: "#e8f4f8" }}
                formatter={(value: number) => [value?.toFixed(tab.unit === "k" ? 0 : 2) + tab.unit, "Deviation"]}
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

      <ReleaseHistoryTable
        data={data ?? []}
        formatValue={formatValue}
        unit={tab.unit}
        lowerIsBetter={tab.lowerIsBetter}
      />
    </div>
  );
}

export default function MacroPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "nfp";
  const [refreshing, setRefreshing] = useState(false);
  const [dotStatuses, setDotStatuses] = useState<Record<string, string | null>>({});

  // Load dot statuses on mount
  useEffect(() => {
    async function loadDots() {
      const results = await Promise.all(
        TABS.map(async (t) => {
          const { data } = await supabase
            .from("macro_indicators")
            .select("beat_miss")
            .eq("indicator", t.indicator)
            .order("release_date", { ascending: false })
            .limit(1)
            .maybeSingle();
          return [t.id, data?.beat_miss ?? null] as [string, string | null];
        })
      );
      setDotStatuses(Object.fromEntries(results));
    }
    loadDots();
  }, []);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("fetch-fred-data");
      await new Promise((r) => setTimeout(r, 5000));
      toast.success("All indicators updated");
    } catch {
      toast.error("Failed to refresh");
    }
    setRefreshing(false);
  };

  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Macro Data</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              US economic indicators — live data from FRED
            </p>
          </div>
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-secondary text-foreground"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Updating..." : "Refresh All"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const dotColor =
              dotStatuses[tab.id] === "beat" ? "hsl(var(--bullish))" :
              dotStatuses[tab.id] === "miss" ? "hsl(var(--bearish))" :
              "hsl(var(--muted-foreground))";

            return (
              <button
                key={tab.id}
                onClick={() => setSearchParams({ tab: tab.id })}
                className="flex items-center gap-1.5 px-4 h-[44px] text-sm font-medium whitespace-nowrap transition-colors shrink-0"
                style={{
                  color: isActive ? tab.color : "hsl(var(--muted-foreground))",
                  borderBottom: isActive ? `2px solid ${tab.color}` : "2px solid transparent",
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {tab.label}
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: dotColor }}
                />
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <MacroTabContent key={currentTab.id} tab={currentTab} />
      </div>
    </AppLayout>
  );
}

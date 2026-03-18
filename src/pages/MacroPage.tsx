import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Loader2, Database, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_EMAILS = [
"radosavljevicdjordje01@gmail.com",
"djolenosmile@gmail.com"];

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMacroData, MacroIndicator } from "@/hooks/useMacroData";
import { CpiTab } from "@/components/macro/CpiTab";
import { PceTab } from "@/components/macro/PceTab";
import { UnemploymentTab } from "@/components/macro/UnemploymentTab";
import { InterestRateTab } from "@/components/macro/InterestRateTab";
import { StatCards } from "@/components/macro/StatCards";
import { BeatRateBanner } from "@/components/macro/BeatRateBanner";
import { ReleaseHistoryTable } from "@/components/macro/ReleaseHistoryTable";
import { DateRangeFilter } from "@/components/macro/DateRangeFilter";
import { MacroSkeleton } from "@/components/macro/MacroSkeleton";
import {
  ComposedChart, Bar, Line, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer, Cell } from
"recharts";

const TABS = [
{ id: "nfp", indicator: "NFP", label: "NFP", color: "#3b82f6", unit: "k", lowerIsBetter: false,
  title: "Non-Farm Payroll — USA",
  subtitle: "Monthly employment change excluding farm workers · Released first Friday of each month",
  description: "Note: The reported value represents the prior month's employment data. Positive = jobs added. Negative = jobs lost.",
  deviationLabel: "How much NFP beat or missed expectations (Actual − Forecast)"
},
{ id: "cpi", indicator: "CPI", label: "CPI", color: "#f59e0b", unit: "%", lowerIsBetter: true,
  title: "Consumer Price Index",
  subtitle: "Measures inflation from consumer goods & services",
  description: "CPI tracks changes in the price level of a basket of consumer goods. Lower than forecast = bullish for USD (less inflation pressure).",
  deviationLabel: "How much CPI came in below or above expectations"
},
{ id: "core-cpi", indicator: "CORE_CPI", label: "Core CPI", color: "#f97316", unit: "%", lowerIsBetter: true,
  title: "Core CPI",
  subtitle: "CPI excluding food & energy — Fed's preferred inflation gauge",
  description: "Core CPI strips out volatile food and energy prices for a cleaner inflation signal. Lower = less inflationary pressure.",
  deviationLabel: "How much Core CPI came in below or above expectations"
},
{ id: "pce", indicator: "PCE", label: "PCE", color: "#a78bfa", unit: "%", lowerIsBetter: true,
  title: "Personal Consumption Expenditures",
  subtitle: "Alternative inflation measure used by the Federal Reserve",
  description: "PCE is the Fed's preferred inflation gauge. Lower readings suggest inflation is cooling, which may ease rate hike pressure.",
  deviationLabel: "How much PCE came in below or above expectations"
},
{ id: "unemployment", indicator: "UNEMPLOYMENT", label: "Unemployment", color: "#22d3ee", unit: "%", lowerIsBetter: true,
  title: "Unemployment Rate",
  subtitle: "Percentage of US labor force without work",
  description: "Lower unemployment signals a strong labor market. Very low readings can be inflationary, prompting Fed tightening.",
  deviationLabel: "How much Unemployment came in below or above expectations"
},
{ id: "interest-rate", indicator: "INTEREST_RATE", label: "Interest Rate", color: "#60a5fa", unit: "%", lowerIsBetter: false,
  title: "Federal Funds Rate",
  subtitle: "Benchmark interest rate set by the Federal Reserve",
  description: "The Fed Funds Rate influences borrowing costs across the economy. Higher rates strengthen USD but can slow growth.",
  deviationLabel: "How much the rate deviated from expectations"
}];


const RANGE_MAP: Record<string, number> = { "6m": 6, "1y": 12, "2y": 24, all: 999 };

function computeStreak(data: MacroIndicator[]) {
  if (!data?.length) return { count: 0, direction: "pending" };
  const direction = data[0]?.beat_miss;
  if (!direction || direction === "pending" || direction === "inline") return { count: 0, direction: "pending" };
  let count = 0;
  for (const d of data) {
    if (d.beat_miss === direction) count++;else
    break;
  }
  return { count, direction };
}

const formatDate = (d: string) =>
new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
const formatShortDate = (d: string) =>
new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

/* ─── Debug Panel ─── */
function MacroDebugPanel() {
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    async function check() {
      const { data: rows, error: tableError } = await supabase.
      from("macro_indicators").
      select("indicator, release_date, actual").
      limit(5);

      const { data: counts } = await supabase.
      from("macro_indicators").
      select("indicator");

      const countMap: Record<string, number> = {};
      counts?.forEach((r: any) => {
        countMap[r.indicator] = (countMap[r.indicator] ?? 0) + 1;
      });

      const { data: fnResult, error: fnError } = await supabase.functions.invoke(
        "fetch-fred-data",
        { body: { indicator: "NFP" } }
      );

      setResults({
        tableError: tableError?.message ?? null,
        sampleRows: rows ?? [],
        countMap,
        fnResult,
        fnError: fnError?.message ?? null
      });
    }
    check();
  }, []);

  if (!results)
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Running diagnostics...
      </div>);


  const hasIssue = results.tableError || results.fnError || Object.keys(results.countMap).length === 0;

  return;






































}

/* ─── Load Button ─── */
function MacroLoadButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const queryClient = useQueryClient();

  async function loadAll() {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-fred-data", {
        body: {}
      });
      if (error) {
        setResult("Error: " + error.message);
      } else if (data?.error) {
        setResult("API Error: " + data.error);
      } else {
        setResult("✓ Loaded " + (data?.count ?? 0) + " rows. Refreshing...");
        queryClient.invalidateQueries({ queryKey: ["macro"] });
        setTimeout(() => setResult(null), 8000);
      }
    } catch (e) {
      setResult("Error: " + String(e));
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={loadAll}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
        
        {loading ?
        <Loader2 className="w-4 h-4 animate-spin" /> :

        <Database className="w-4 h-4" />
        }
        {loading ? "Fetching all indicators from FRED..." : "⚡ Load all macro data"}
      </button>
      {result &&
      <span
        className="text-xs font-medium"
        style={{
          color: result.startsWith("✓") ? "#22c55e" : "#ef4444"
        }}>
        
          {result}
        </span>
      }
    </div>);

}

/* ─── No Data State ─── */
function NoDataState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
      <Database className="w-10 h-10 text-muted-foreground opacity-40" />
      <p className="text-sm font-medium text-foreground">No data loaded yet</p>
      <p className="text-xs text-muted-foreground max-w-sm">
        Click "⚡ Load all macro data" above to fetch from the FRED API.
        If the button shows an error, check that FRED_API_KEY is set in your environment variables.
      </p>
    </div>);

}

/* ─── Generic Tab Content ─── */
function MacroTabContent({ tab }: {tab: typeof TABS[number];}) {
  const {
    sorted, latest, previous, beatCount, totalCount, beatRate,
    biggestBeat, biggestMiss, isLoading, data, hasData
  } = useMacroData(tab.indicator);

  const [range, setRange] = useState("2y");

  const formatValue = (v: number | null | undefined) => {
    if (v == null) return "—";
    if (tab.unit === "k") return (v >= 0 ? "+" : "") + v.toFixed(0) + "k";
    return v.toFixed(2) + "%";
  };

  const formatSurpriseColor = (bm?: string | null) =>
  bm === "beat" ? "hsl(var(--bullish))" : bm === "miss" ? "hsl(var(--bearish))" : undefined;

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
      color: d.beat_miss === "beat" ?
      "#22c55e" :
      d.beat_miss === "miss" ?
      "#ef4444" :
      tab.color
    })),
    [filtered, tab]
  );

  const deviationData = useMemo(
    () =>
    filtered.
    filter((d) => d.forecast != null && d.actual != null).
    map((d) => ({
      date: formatShortDate(d.release_date),
      deviation: d.actual! - d.forecast!,
      color: tab.lowerIsBetter ?
      d.actual! - d.forecast! <= 0 ? "#22c55e" : "#ef4444" :
      d.actual! - d.forecast! >= 0 ? "#22c55e" : "#ef4444"
    })),
    [filtered, tab]
  );

  const streak = computeStreak(data ?? []);

  if (isLoading) return <MacroSkeleton message={`Loading ${tab.label} data...`} />;
  if (!hasData) return <NoDataState />;

  const statCards = [
  {
    label: "Latest Release",
    value: formatValue(latest?.actual),
    subLabel: latest ? formatDate(latest.release_date) : "",
    color: formatSurpriseColor(latest?.beat_miss)
  },
  {
    label: "Forecast",
    value: latest?.forecast != null ? formatValue(latest.forecast) : "N/A",
    subLabel: "Analyst consensus"
  },
  {
    label: "Previous",
    value: previous ? formatValue(previous.actual) : "—",
    subLabel: previous ? formatDate(previous.release_date) : ""
  },
  {
    label: "Surprise",
    value: latest?.surprise != null ? formatValue(latest.surprise) : "—",
    color: formatSurpriseColor(latest?.beat_miss),
    badge: latest?.beat_miss === "beat" || latest?.beat_miss === "miss" ?
    <span
      className="inline-block text-[9px] font-semibold rounded px-2 py-0.5"
      style={{
        background: latest.beat_miss === "beat" ? "hsl(155 100% 10%)" : "hsl(0 60% 10%)",
        color: latest.beat_miss === "beat" ? "hsl(var(--bullish))" : "hsl(var(--bearish))"
      }}>
      
          {latest.beat_miss!.toUpperCase()}
        </span> :
    undefined
  }];


  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">{tab.title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{tab.subtitle}</p>
      </div>

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
        formatValue={formatValue} />
      

      <DateRangeFilter value={range} onChange={setRange} />

      {chartData.length > 0 &&
      <div className="rounded-lg p-4 bg-card border border-border">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(207 35% 18%)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7a99b0", fontSize: 11 }} axisLine={{ stroke: "hsl(207 35% 18%)" }} tickLine={false} />
              <YAxis tick={{ fill: "#7a99b0", fontSize: 11 }} axisLine={{ stroke: "hsl(207 35% 18%)" }} tickLine={false} tickFormatter={(v) => v + tab.unit} />
              <Tooltip
              contentStyle={{ background: "hsl(210 30% 7%)", border: "1px solid hsl(207 35% 18%)", borderRadius: "8px", color: "#e8f4f8" }}
              formatter={(value: number, name: string) => [value?.toFixed(tab.unit === "k" ? 0 : 2) + tab.unit, name]} />
            
              <ReferenceLine y={0} stroke="#3d5a70" strokeDasharray="4 4" />
              <Bar dataKey="actual" name="Actual" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) =>
              <Cell key={i} fill={entry.color} />
              )}
              </Bar>
              <Scatter dataKey="forecast" name="Forecast" fill="#ef4444" />
              <Line dataKey="actual" name="Trend" stroke={tab.color} strokeWidth={1.5} dot={false} />
              <Legend wrapperStyle={{ color: "#7a99b0", fontSize: "12px" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      }

      {deviationData.length > 0 &&
      <div className="rounded-lg p-4 bg-card border border-border">
          <p className="text-xs text-muted-foreground mb-3">{tab.deviationLabel}</p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={deviationData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(207 35% 18%)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7a99b0", fontSize: 11 }} axisLine={{ stroke: "hsl(207 35% 18%)" }} tickLine={false} />
              <YAxis tick={{ fill: "#7a99b0", fontSize: 11 }} axisLine={{ stroke: "hsl(207 35% 18%)" }} tickLine={false} tickFormatter={(v) => v + tab.unit} />
              <Tooltip
              contentStyle={{ background: "hsl(210 30% 7%)", border: "1px solid hsl(207 35% 18%)", borderRadius: "8px", color: "#e8f4f8" }}
              formatter={(value: number) => [value?.toFixed(tab.unit === "k" ? 0 : 2) + tab.unit, "Deviation"]} />
            
              <ReferenceLine y={0} stroke="#7a99b0" strokeWidth={1} />
              <Bar dataKey="deviation" name="Actual − Forecast" radius={[3, 3, 0, 0]}>
                {deviationData.map((entry, i) =>
              <Cell key={i} fill={entry.color} />
              )}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      }

      <ReleaseHistoryTable
        data={data ?? []}
        formatValue={formatValue}
        unit={tab.unit}
        lowerIsBetter={tab.lowerIsBetter} />
      
    </div>);

}

export default function MacroPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "nfp";
  const [refreshing, setRefreshing] = useState(false);
  const [dotStatuses, setDotStatuses] = useState<Record<string, string | null>>({});
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = ADMIN_EMAILS.includes(user?.email ?? "");

  useEffect(() => {
    async function loadDots() {
      const results = await Promise.all(
        TABS.map(async (t) => {
          const { data } = await supabase.
          from("macro_indicators").
          select("beat_miss").
          eq("indicator", t.indicator).
          order("release_date", { ascending: false }).
          limit(1).
          maybeSingle();
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
      const { data, error } = await supabase.functions.invoke("fetch-fred-data");
      if (error) {
        toast.error("Failed to refresh: " + error.message);
      } else if (data?.error) {
        toast.error("FRED API error: " + data.error);
      } else {
        toast.success(`Updated ${data?.count ?? 0} data points`);
        queryClient.invalidateQueries({ queryKey: ["macro"] });
      }
    } catch {
      toast.error("Failed to refresh");
    }
    setRefreshing(false);
  };

  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-[1200px] mx-auto">
        {/* Debug Panel — admin only */}
        {isAdmin && <MacroDebugPanel />}

        {/* Load Button — admin only */}
        {isAdmin && <MacroLoadButton />}

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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-secondary text-foreground">
            
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
                  background: "transparent"
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}>
                
                {tab.label}
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: dotColor }} />
                
              </button>);

          })}
        </div>

        {/* Tab Content */}
        {currentTab.id === "cpi" ?
        <CpiTab indicator="CPI" title="CPI — Consumer Price Index MoM" /> :
        currentTab.id === "core-cpi" ?
        <CpiTab indicator="CORE_CPI" title="Core CPI — Excludes Food & Energy MoM" /> :
        currentTab.id === "pce" ?
        <PceTab /> :
        currentTab.id === "unemployment" ?
        <UnemploymentTab /> :
        currentTab.id === "interest-rate" ?
        <InterestRateTab /> :

        <MacroTabContent key={currentTab.id} tab={currentTab} />
        }
      </div>
    </AppLayout>);

}
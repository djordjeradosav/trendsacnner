import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { RefreshCw, Calendar as CalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell, Legend, Line,
} from "recharts";
import { toast } from "sonner";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const ALL_PAIRS = [
  { symbol: "EURUSD", category: "Forex Majors" },
  { symbol: "GBPUSD", category: "Forex Majors" },
  { symbol: "USDJPY", category: "Forex Majors" },
  { symbol: "USDCHF", category: "Forex Majors" },
  { symbol: "AUDUSD", category: "Forex Majors" },
  { symbol: "USDCAD", category: "Forex Majors" },
  { symbol: "NZDUSD", category: "Forex Majors" },
  { symbol: "EURGBP", category: "Forex Minors" },
  { symbol: "EURJPY", category: "Forex Minors" },
  { symbol: "GBPJPY", category: "Forex Minors" },
  { symbol: "XAUUSD", category: "Commodities" },
  { symbol: "XAGUSD", category: "Commodities" },
];

const YEAR_PRESETS = [
  { label: "5Y", years: 5 },
  { label: "10Y", years: 10 },
  { label: "15Y", years: 15 },
  { label: "20Y", years: 20 },
  { label: "ALL", years: 99 },
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const MONTH_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#ef4444","#f97316","#eab308",
  "#22c55e","#14b8a6","#06b6d4","#6366f1","#a855f7","#f43f5e",
];

function formatReturn(v: number | null) {
  if (v == null) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
}

function getCellStyle(v: number | null) {
  if (v == null) return { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" };
  const intensity = Math.min(Math.abs(v) / 3, 1);
  if (v >= 0) return {
    background: `rgba(34,197,94,${0.1 + intensity * 0.5})`,
    color: "hsl(var(--foreground))", fontFamily: "monospace", fontSize: "11px",
  };
  return {
    background: `rgba(239,68,68,${0.1 + intensity * 0.5})`,
    color: "hsl(var(--foreground))", fontFamily: "monospace", fontSize: "11px",
  };
}

export default function SeasonalityPage() {
  const queryClient = useQueryClient();
  const [selectedPair, setSelectedPair] = useState("EURUSD");
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [fromYear, setFromYear] = useState(2000);
  const [toYear, setToYear] = useState(currentYear);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([1,2,3,4,5,6,7,8,9,10,11,12]);
  const [directionFilter, setDirectionFilter] = useState<"all"|"bullish"|"bearish"|"neutral">("all");
  const [fetching, setFetching] = useState(false);
  const [pairSearch, setPairSearch] = useState("");

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["seasonality-stats", selectedPair],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seasonality_stats")
        .select("*")
        .eq("symbol", selectedPair)
        .order("month_number");
      if (error) throw error;
      return data;
    },
  });

  // Fetch raw data
  const { data: rawData, isLoading: rawLoading } = useQuery({
    queryKey: ["seasonality-raw", selectedPair],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seasonality")
        .select("*")
        .eq("symbol", selectedPair)
        .order("year", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const hasData = stats && stats.length > 0;

  // Auto-fetch if no data
  useEffect(() => {
    if (!statsLoading && !hasData && !fetching) {
      handleFetch();
    }
  }, [selectedPair, statsLoading, hasData]);

  const handleFetch = useCallback(async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-seasonality", {
        body: { symbol: selectedPair },
      });
      if (error) throw error;
      if (data?.error === "rate_limit") {
        toast.error("Daily API limit reached. Try again tomorrow.");
      } else if (data?.error) {
        toast.error(data.message || data.error);
      } else {
        toast.success(`Loaded ${data.months} months of data for ${selectedPair}`);
        queryClient.invalidateQueries({ queryKey: ["seasonality-stats", selectedPair] });
        queryClient.invalidateQueries({ queryKey: ["seasonality-raw", selectedPair] });
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch seasonality data");
    } finally {
      setFetching(false);
    }
  }, [selectedPair, queryClient]);

  // Filtered stats
  const filteredStats = useMemo(() => {
    if (!stats) return [];
    let filtered = stats;
    if (directionFilter === "bullish") filtered = filtered.filter(s => (s.up_pct ?? 0) >= 60);
    else if (directionFilter === "bearish") filtered = filtered.filter(s => (s.up_pct ?? 0) <= 40);
    else if (directionFilter === "neutral") filtered = filtered.filter(s => (s.up_pct ?? 0) > 40 && (s.up_pct ?? 0) < 60);
    return filtered;
  }, [stats, directionFilter]);

  // Filtered raw data by year range
  const filteredRaw = useMemo(() => {
    if (!rawData) return [];
    return rawData.filter(d => d.year >= fromYear && d.year <= toYear);
  }, [rawData, fromYear, toYear]);

  // Selected month detail data
  const selectedMonthData = useMemo(() => {
    if (selectedMonth == null || !filteredRaw.length) return [];
    return filteredRaw.filter(d => d.month_number === selectedMonth).sort((a, b) => a.year - b.year);
  }, [filteredRaw, selectedMonth]);

  const selectedMonthStats = useMemo(() => {
    if (selectedMonth == null || !stats) return null;
    return stats.find(s => s.month_number === selectedMonth) ?? null;
  }, [stats, selectedMonth]);

  // Bias chart data
  const biasData = useMemo(() => {
    if (!filteredStats.length) return [];
    return filteredStats.map(d => ({
      month: MONTHS[d.month_number - 1],
      bias: (d.up_pct ?? 50) - 50,
      upPct: d.up_pct,
      avgReturn: d.avg_return,
      isCurrent: currentMonth === d.month_number,
    }));
  }, [filteredStats]);

  // Year view matrix
  const yearMatrix = useMemo(() => {
    if (!filteredRaw.length) return [];
    const years = [...new Set(filteredRaw.map(d => d.year))].sort();
    return years.map(year => {
      const row: any = { year };
      let annual = 0;
      let count = 0;
      for (let m = 1; m <= 12; m++) {
        const entry = filteredRaw.find(d => d.year === year && d.month_number === m);
        row["m" + m] = entry?.return_pct ?? null;
        if (entry?.return_pct != null) { annual += entry.return_pct; count++; }
      }
      row.annual = count > 0 ? annual : null;
      return row;
    });
  }, [filteredRaw]);

  // Pair selector groups
  const pairGroups = useMemo(() => {
    const groups: Record<string, typeof ALL_PAIRS> = {};
    ALL_PAIRS.filter(p => p.symbol.toLowerCase().includes(pairSearch.toLowerCase())).forEach(p => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, [pairSearch]);

  const applyPreset = (years: number) => {
    if (years >= 50) { setFromYear(2000); setToYear(currentYear); }
    else { setFromYear(currentYear - years); setToYear(currentYear); }
  };

  const toggleMonth = (m: number) => {
    setSelectedMonths(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  // Loading skeleton
  if ((statsLoading || fetching) && !hasData) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Seasonality</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Fetching 20+ years of monthly price data for {selectedPair}...
            </p>
            <p className="text-xs text-muted-foreground">This takes about 15 seconds.</p>
          </div>
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-[10px] h-[120px] animate-pulse"
                style={{ background: "linear-gradient(90deg,hsl(var(--background)) 25%,hsl(var(--muted)) 50%,hsl(var(--background)) 75%)", backgroundSize: "200% 100%" }} />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
        {/* HEADER */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <CalIcon className="w-5 h-5 text-primary" /> Seasonality
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Historical directional probability per month based on 20+ years
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Pair selector */}
            <div className="relative">
              <select
                value={selectedPair}
                onChange={e => setSelectedPair(e.target.value)}
                className="h-9 rounded-md border border-border bg-background text-foreground text-sm px-3 pr-8"
              >
                {Object.entries(pairGroups).map(([cat, pairs]) => (
                  <optgroup key={cat} label={cat}>
                    {pairs.map(p => <option key={p.symbol} value={p.symbol}>{p.symbol}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            {/* View toggle */}
            <div className="flex rounded-md border border-border overflow-hidden">
              {(["month", "year"] as const).map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: viewMode === v ? "hsl(var(--primary))" : "transparent",
                    color: viewMode === v ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                  }}>
                  {v === "month" ? "Month View" : "Year View"}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={handleFetch} disabled={fetching}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
              {fetching ? "Loading…" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-card">
          <span className="text-xs font-medium text-muted-foreground">Range:</span>
          {YEAR_PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p.years)}
              className="px-2.5 py-1 text-[11px] rounded-md border border-border transition-colors"
              style={{
                background: (p.years >= 50 && fromYear === 2000) || (p.years < 50 && fromYear === currentYear - p.years)
                  ? "hsl(var(--primary))" : "transparent",
                color: (p.years >= 50 && fromYear === 2000) || (p.years < 50 && fromYear === currentYear - p.years)
                  ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
              }}>
              {p.label}
            </button>
          ))}
          <input type="number" value={fromYear} onChange={e => setFromYear(+e.target.value)}
            className="w-16 h-7 rounded border border-border bg-background text-foreground text-xs px-2" />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="number" value={toYear} onChange={e => setToYear(+e.target.value)}
            className="w-16 h-7 rounded border border-border bg-background text-foreground text-xs px-2" />

          <span className="text-xs font-medium text-muted-foreground ml-4">Direction:</span>
          {(["all","bullish","bearish","neutral"] as const).map(d => (
            <button key={d} onClick={() => setDirectionFilter(d)}
              className="px-2.5 py-1 text-[11px] rounded-md border border-border capitalize transition-colors"
              style={{
                background: directionFilter === d ? "hsl(var(--primary))" : "transparent",
                color: directionFilter === d ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
              }}>
              {d}
            </button>
          ))}

          {viewMode === "year" && (
            <>
              <span className="text-xs font-medium text-muted-foreground ml-4">Months:</span>
              {MONTHS.map((m, i) => (
                <button key={m} onClick={() => toggleMonth(i + 1)}
                  className="px-2 py-1 text-[11px] rounded-md border border-border transition-colors"
                  style={{
                    background: selectedMonths.includes(i + 1) ? MONTH_COLORS[i] + "33" : "transparent",
                    color: selectedMonths.includes(i + 1) ? MONTH_COLORS[i] : "hsl(var(--muted-foreground))",
                    borderColor: selectedMonths.includes(i + 1) ? MONTH_COLORS[i] + "66" : undefined,
                  }}>
                  {m}
                </button>
              ))}
            </>
          )}
        </div>

        {/* MONTH VIEW */}
        {viewMode === "month" && hasData && (
          <>
            {/* Heatmap grid */}
            <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
              {(filteredStats.length ? filteredStats : stats || []).map(month => {
                const upPct = month.up_pct ?? 50;
                const intensity = Math.abs(upPct - 50) / 50;
                const isBull = upPct >= 50;
                const isCurrent = currentMonth === month.month_number;
                const isSelected = selectedMonth === month.month_number;
                const bg = isBull
                  ? `rgba(34,197,94,${0.08 + intensity * 0.72})`
                  : `rgba(239,68,68,${0.08 + intensity * 0.72})`;

                return (
                  <button key={month.month_number}
                    onClick={() => setSelectedMonth(month.month_number)}
                    className="rounded-[10px] p-3 text-center transition-transform hover:scale-[1.03] cursor-pointer"
                    style={{
                      background: bg,
                      border: isCurrent ? "2px solid hsl(var(--foreground))"
                        : isSelected ? `2px solid ${isBull ? "#22c55e" : "#ef4444"}`
                        : "0.5px solid hsl(var(--border))",
                    }}>
                    <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                      {MONTHS[month.month_number - 1]}
                      {isCurrent && <span className="text-[8px] bg-foreground/20 rounded px-1">NOW</span>}
                    </div>
                    <div className="text-xl font-bold text-foreground mt-1">{upPct.toFixed(0)}%</div>
                    <div className="text-[10px] mt-0.5" style={{ color: isBull ? "#22c55e" : "#ef4444" }}>
                      {isBull ? "↑ Bull" : "↓ Bear"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{month.up_count}W {month.down_count}L</div>
                    <div className="text-[10px] text-muted-foreground">
                      avg {formatReturn(month.avg_return)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Colour legend */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground justify-center">
              <span>← 90% Bear</span>
              <div className="h-2 w-48 rounded-full"
                style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.8), rgba(239,68,68,0.1), hsl(var(--muted)), rgba(34,197,94,0.1), rgba(34,197,94,0.8))" }} />
              <span>90% Bull →</span>
            </div>

            {/* Bias bar chart */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Monthly Bullish Bias — {selectedPair}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={biasData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
                    tickFormatter={v => (v > 0 ? "+" : "") + v + "%"} domain={[-50, 50]} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                    formatter={(v: number) => [(v > 0 ? "+" : "") + v.toFixed(1) + "%", "Bullish bias"]} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                  <Bar dataKey="bias" name="Bias" radius={[3, 3, 0, 0]}>
                    {biasData.map((e, i) => (
                      <Cell key={i} fill={e.bias >= 0 ? "#22c55e" : "#ef4444"} opacity={e.isCurrent ? 1 : 0.75} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Selected month detail */}
            {selectedMonth != null && selectedMonthStats && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {MONTHS[selectedMonth - 1]} — {selectedPair}
                  </h3>
                  <div className="text-3xl font-bold" style={{ color: (selectedMonthStats.up_pct ?? 0) >= 50 ? "#22c55e" : "#ef4444" }}>
                    {(selectedMonthStats.up_pct ?? 0).toFixed(0)}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Up {selectedMonthStats.up_count} of {selectedMonthStats.total_years} years
                  </p>
                  <p className="text-sm text-muted-foreground">Average return: {formatReturn(selectedMonthStats.avg_return)}</p>
                  <p className="text-sm text-muted-foreground">
                    Best: {formatReturn(selectedMonthStats.best_return)} in {selectedMonthStats.best_year}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Worst: {formatReturn(selectedMonthStats.worst_return)} in {selectedMonthStats.worst_year}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Year by Year</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={selectedMonthData.map(d => ({ year: d.year, ret: d.return_pct }))}
                      margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v + "%"} />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                        formatter={(v: number) => [v.toFixed(2) + "%", "Return"]} />
                      <Bar dataKey="ret" radius={[2, 2, 0, 0]}>
                        {selectedMonthData.map((e, i) => (
                          <Cell key={i} fill={(e.return_pct ?? 0) >= 0 ? "#22c55e" : "#ef4444"} />
                        ))}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Month view summary table */}
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Month","Up","Down","Total","Bullish%","Avg Return","Best","Worst","Bias"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(stats || []).map(s => {
                    const isCurrent = currentMonth === s.month_number;
                    return (
                      <tr key={s.month_number} className="border-b border-border"
                        style={{ borderLeft: isCurrent ? "2px solid hsl(var(--foreground))" : undefined }}>
                        <td className="px-3 py-2 text-foreground font-medium">{MONTHS[s.month_number - 1]}</td>
                        <td className="px-3 py-2" style={{ color: "#22c55e" }}>{s.up_count}</td>
                        <td className="px-3 py-2" style={{ color: "#ef4444" }}>{s.down_count}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.total_years}</td>
                        <td className="px-3 py-2 font-medium" style={{ color: (s.up_pct ?? 0) >= 50 ? "#22c55e" : "#ef4444" }}>
                          {(s.up_pct ?? 0).toFixed(1)}%
                        </td>
                        <td className="px-3 py-2" style={{ color: (s.avg_return ?? 0) >= 0 ? "#22c55e" : "#ef4444" }}>
                          {formatReturn(s.avg_return)}
                        </td>
                        <td className="px-3 py-2" style={{ color: "#22c55e" }}>
                          {formatReturn(s.best_return)} ({s.best_year})
                        </td>
                        <td className="px-3 py-2" style={{ color: "#ef4444" }}>
                          {formatReturn(s.worst_return)} ({s.worst_year})
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px] uppercase"
                            style={{
                              background: s.bias === "bullish" ? "#0d2b1a" : s.bias === "bearish" ? "#2b0d0d" : "#1a2635",
                              color: s.bias === "bullish" ? "#22c55e" : s.bias === "bearish" ? "#ef4444" : "#7a99b0",
                              borderColor: "transparent",
                            }}>
                            {s.bias ?? "neutral"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* YEAR VIEW */}
        {viewMode === "year" && hasData && (
          <>
            {/* Heatmap table */}
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-2 py-2 text-left text-muted-foreground font-medium sticky left-0 bg-muted/30">Year</th>
                    {MONTHS.map((m, i) => (
                      <th key={m} className="px-2 py-2 text-center text-muted-foreground font-medium"
                        style={{ opacity: selectedMonths.includes(i + 1) ? 1 : 0.3 }}>{m}</th>
                    ))}
                    <th className="px-2 py-2 text-center text-muted-foreground font-medium">Annual</th>
                  </tr>
                </thead>
                <tbody>
                  {[...yearMatrix].reverse().map(row => (
                    <tr key={row.year} className="border-b border-border">
                      <td className="px-2 py-1.5 text-foreground font-medium sticky left-0 bg-background">{row.year}</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                        const v = row["m" + m];
                        return (
                          <td key={m} className="px-2 py-1.5 text-center" style={{
                            ...getCellStyle(v),
                            opacity: selectedMonths.includes(m) ? 1 : 0.3,
                          }}>
                            {v != null ? formatReturn(v) : "—"}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center font-medium" style={getCellStyle(row.annual)}>
                        {row.annual != null ? formatReturn(row.annual) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Year view line chart */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Annual Returns by Month</h3>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={yearMatrix} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v + "%"} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                  {selectedMonths.slice(0, 4).map(m => (
                    <Line key={m} dataKey={`m${m}`} name={MONTHS[m - 1]} stroke={MONTH_COLORS[m - 1]}
                      strokeWidth={1.5} dot={false} connectNulls />
                  ))}
                  <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* No data state */}
        {!hasData && !statsLoading && !fetching && (
          <div className="text-center py-16 space-y-3">
            <p className="text-muted-foreground">No seasonality data for {selectedPair}.</p>
            <Button onClick={handleFetch}><RefreshCw className="w-4 h-4 mr-2" /> Fetch Data</Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

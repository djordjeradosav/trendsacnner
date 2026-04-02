import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  History,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  GitCompare,
  X,
  BarChart3,
} from "lucide-react";
import { useTimeframe, timeframeOptions } from "@/hooks/useTimeframe";
import { TimeframeSelector } from "@/components/scanner/TimeframeSelector";
import { createChart, ColorType, LineStyle, LineSeries, AreaSeries, type IChartApi, type Time } from "lightweight-charts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MarketPoint {
  scan_time: string;
  avg_score: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  total_pairs: number;
}

interface PairInfo {
  id: string;
  symbol: string;
  category: string;
}

interface ScorePoint {
  score: number;
  trend: string;
  scanned_at: string;
}

interface PairStats {
  highest: number;
  lowest: number;
  bullishPct: number;
  bearishPct: number;
  currentStreak: string;
  avg7d: number;
}

// ─── Chart Colors ────────────────────────────────────────────────────────────

const COMPARE_COLORS = ["#00ff7f", "#60a5fa", "#f59e0b", "#f87171", "#c084fc"];
const CHART_BG = "transparent";
const CHART_TEXT = "#7a99b0";
const CHART_GRID = "#1e2d3d";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toChartTime(iso: string): Time {
  return Math.floor(new Date(iso).getTime() / 1000) as Time;
}

function calcPairStats(points: ScorePoint[]): PairStats {
  if (points.length === 0)
    return { highest: 0, lowest: 0, bullishPct: 0, bearishPct: 0, currentStreak: "—", avg7d: 0 };

  const scores = points.map((p) => p.score);
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  const bullishCount = points.filter((p) => p.trend === "bullish").length;
  const bearishCount = points.filter((p) => p.trend === "bearish").length;
  const bullishPct = Math.round((bullishCount / points.length) * 100);
  const bearishPct = Math.round((bearishCount / points.length) * 100);

  // Current streak
  let streak = 1;
  const lastTrend = points[points.length - 1].trend;
  for (let i = points.length - 2; i >= 0; i--) {
    if (points[i].trend === lastTrend) streak++;
    else break;
  }
  const streakLabel =
    lastTrend === "bullish"
      ? `Bullish for ${streak} scans`
      : lastTrend === "bearish"
        ? `Bearish for ${streak} scans`
        : `Neutral for ${streak} scans`;

  // Avg 7d
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = points.filter((p) => new Date(p.scanned_at).getTime() > sevenDaysAgo);
  const avg7d = recent.length > 0 ? Math.round((recent.reduce((s, p) => s + p.score, 0) / recent.length) * 10) / 10 : 0;

  return { highest, lowest, bullishPct, bearishPct, currentStreak: streakLabel, avg7d };
}

// ─── Market Overview Chart ───────────────────────────────────────────────────

function MarketScoreChart({ data }: { data: MarketPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: CHART_BG }, textColor: CHART_TEXT },
      grid: { vertLines: { color: CHART_GRID }, horzLines: { color: CHART_GRID } },
      rightPriceScale: { borderColor: CHART_GRID },
      timeScale: { borderColor: CHART_GRID, timeVisible: true },
      height: 220,
      width: containerRef.current.clientWidth,
    });
    chartRef.current = chart;

    const series = chart.addSeries(LineSeries, { color: "#00ff7f", lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: "Avg Score" });
    const chartData = data.map((d) => ({ time: toChartTime(d.scan_time), value: d.avg_score }));
    series.setData(chartData);

    // Bull/bear reference lines
    if (chartData.length >= 2) {
      const t1 = chartData[0].time;
      const t2 = chartData[chartData.length - 1].time;
      const bullLine = chart.addSeries(LineSeries, { color: "#22c55e", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
      bullLine.setData([{ time: t1, value: 65 }, { time: t2, value: 65 }]);
      const bearLine = chart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
      bearLine.setData([{ time: t1, value: 35 }, { time: t2, value: 35 }]);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [data]);

  return <div ref={containerRef} className="w-full" />;
}

// ─── Bull/Bear Ratio Chart ───────────────────────────────────────────────────

function SentimentRatioChart({ data }: { data: MarketPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: CHART_BG }, textColor: CHART_TEXT },
      grid: { vertLines: { color: CHART_GRID }, horzLines: { color: CHART_GRID } },
      rightPriceScale: { borderColor: CHART_GRID },
      timeScale: { borderColor: CHART_GRID, timeVisible: true },
      height: 220,
      width: containerRef.current.clientWidth,
    });

    const bullSeries = chart.addSeries(AreaSeries, {
      topColor: "rgba(34,197,94,0.4)", bottomColor: "rgba(34,197,94,0.05)",
      lineColor: "#22c55e", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: "Bullish %",
    });
    const bearSeries = chart.addSeries(AreaSeries, {
      topColor: "rgba(239,68,68,0.4)", bottomColor: "rgba(239,68,68,0.05)",
      lineColor: "#ef4444", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: "Bearish %",
    });

    bullSeries.setData(data.map((d) => ({ time: toChartTime(d.scan_time), value: d.total_pairs > 0 ? Math.round((d.bullish_count / d.total_pairs) * 100) : 0 })));
    bearSeries.setData(data.map((d) => ({ time: toChartTime(d.scan_time), value: d.total_pairs > 0 ? Math.round((d.bearish_count / d.total_pairs) * 100) : 0 })));

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [data]);

  return <div ref={containerRef} className="w-full" />;
}

// ─── Pair Score Chart ────────────────────────────────────────────────────────

function PairScoreChart({ points, comparePairs }: { points: ScorePoint[]; comparePairs: { symbol: string; points: ScorePoint[] }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const hasData = points.length > 0 || comparePairs.some((p) => p.points.length > 0);
    if (!hasData) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: CHART_BG }, textColor: CHART_TEXT },
      grid: { vertLines: { color: CHART_GRID }, horzLines: { color: CHART_GRID } },
      rightPriceScale: { borderColor: CHART_GRID },
      timeScale: { borderColor: CHART_GRID, timeVisible: true },
      height: 300,
      width: containerRef.current.clientWidth,
    });

    // Main pair line
    if (points.length > 0) {
      const lastTrend = points[points.length - 1].trend;
      const lineColor = lastTrend === "bullish" ? "#22c55e" : lastTrend === "bearish" ? "#ef4444" : "#6b7280";

      const mainSeries = chart.addSeries(LineSeries, { color: lineColor, lineWidth: 2, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, priceLineVisible: false });
      mainSeries.setData(points.map((p) => ({ time: toChartTime(p.scanned_at), value: p.score })));

      // Area fill only if not comparing
      if (comparePairs.length === 0) {
        const areaColor = points[points.length - 1].score > 50 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
        const areaSeries = chart.addSeries(AreaSeries, {
          topColor: areaColor, bottomColor: "transparent",
          lineColor: "transparent", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
        });
        areaSeries.setData(points.map((p) => ({ time: toChartTime(p.scanned_at), value: p.score })));
      }
    }

    // Compare pair lines
    comparePairs.forEach((cp, i) => {
      if (cp.points.length === 0) return;
      const s = chart.addSeries(LineSeries, { color: COMPARE_COLORS[i % COMPARE_COLORS.length], lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: cp.symbol });
      s.setData(cp.points.map((p) => ({ time: toChartTime(p.scanned_at), value: p.score })));
    });

    // Reference lines
    const allPoints = [...points, ...comparePairs.flatMap((cp) => cp.points)];
    if (allPoints.length >= 2) {
      const times = allPoints.map((p) => toChartTime(p.scanned_at)).sort();
      const t1 = times[0];
      const t2 = times[times.length - 1];
      chart.addSeries(LineSeries, { color: "#22c55e", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false }).setData([{ time: t1, value: 65 }, { time: t2, value: 65 }]);
      chart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false }).setData([{ time: t1, value: 35 }, { time: t2, value: 35 }]);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [points, comparePairs]);

  return <div ref={containerRef} className="w-full" />;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { selectedTimeframe, setTimeframe } = useTimeframe();
  const [marketData, setMarketData] = useState<MarketPoint[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPair, setSelectedPair] = useState<PairInfo | null>(null);
  const [pairPoints, setPairPoints] = useState<ScorePoint[]>([]);
  const [pairLoading, setPairLoading] = useState(false);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [comparePairIds, setComparePairIds] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<{ symbol: string; points: ScorePoint[] }[]>([]);

  // Fetch market overview
  useEffect(() => {
    const fetchMarket = async () => {
      setMarketLoading(true);
      const { data, error } = await supabase.rpc("get_market_score_history", {
        p_timeframe: selectedTimeframe,
        p_limit: 200,
      });
      if (data && !error) setMarketData(data as unknown as MarketPoint[]);
      setMarketLoading(false);
    };
    fetchMarket();
  }, [selectedTimeframe]);

  // Fetch pairs list
  useEffect(() => {
    const fetchPairs = async () => {
      const { data } = await supabase.from("pairs").select("id, symbol, category").eq("is_active", true).order("symbol");
      if (data) setPairs(data);
    };
    fetchPairs();
  }, []);

  // Fetch pair score history
  useEffect(() => {
    if (!selectedPair) { setPairPoints([]); return; }
    const fetchPairHistory = async () => {
      setPairLoading(true);
      const { data } = await supabase
        .from("scores")
        .select("score, trend, scanned_at")
        .eq("pair_id", selectedPair.id)
        .eq("timeframe", selectedTimeframe)
        .order("scanned_at", { ascending: true })
        .limit(500);
      if (data) setPairPoints(data.map((d) => ({ score: Number(d.score), trend: d.trend, scanned_at: d.scanned_at })));
      setPairLoading(false);
    };
    fetchPairHistory();
  }, [selectedPair, selectedTimeframe]);

  // Fetch compare data
  useEffect(() => {
    if (comparePairIds.length === 0) { setCompareData([]); return; }
    const fetchAll = async () => {
      const results = await Promise.all(
        comparePairIds.map(async (pairId) => {
          const pair = pairs.find((p) => p.id === pairId);
          const { data } = await supabase
            .from("scores")
            .select("score, trend, scanned_at")
            .eq("pair_id", pairId)
            .eq("timeframe", selectedTimeframe)
            .order("scanned_at", { ascending: true })
            .limit(500);
          return {
            symbol: pair?.symbol || "?",
            points: (data || []).map((d) => ({ score: Number(d.score), trend: d.trend, scanned_at: d.scanned_at })),
          };
        })
      );
      setCompareData(results);
    };
    fetchAll();
  }, [comparePairIds, selectedTimeframe, pairs]);

  const filteredPairs = useMemo(() => {
    if (!search) return pairs.slice(0, 40);
    return pairs.filter((p) => p.symbol.toLowerCase().includes(search.toLowerCase()));
  }, [pairs, search]);

  const stats = useMemo(() => calcPairStats(pairPoints), [pairPoints]);

  const dateRange = useMemo(() => {
    if (marketData.length === 0) return "";
    const earliest = new Date(marketData[0].scan_time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const latest = new Date(marketData[marketData.length - 1].scan_time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${earliest} → ${latest}`;
  }, [marketData]);

  const toggleCompare = (pairId: string) => {
    setComparePairIds((prev) => {
      if (prev.includes(pairId)) return prev.filter((id) => id !== pairId);
      if (prev.length >= 5) return prev;
      return [...prev, pairId];
    });
  };

  const getScoreColor = (pair: PairInfo) => {
    // Simple chip color based on category
    return "bg-muted text-muted-foreground";
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <History className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h1 className="text-lg sm:text-2xl font-bold font-display text-foreground">Scan History</h1>
          </div>
          <TimeframeSelector selected={selectedTimeframe} onChange={setTimeframe} />
        </div>

        {/* Sub-header */}
        {marketData.length > 0 && (
          <p className="text-xs text-muted-foreground mb-6">
            Showing last {marketData.length} scans · {dateRange}
          </p>
        )}

        {/* Market Overview Charts */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
            <h3 className="text-sm font-display font-semibold text-foreground mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Average Market Score
            </h3>
            {marketLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : marketData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                No history data yet — run a few scans first
              </div>
            ) : (
              <MarketScoreChart data={marketData} />
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
            <h3 className="text-sm font-display font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-bullish" />
              Bull / Bear Ratio
            </h3>
            {marketLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : marketData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                No history data yet
              </div>
            ) : (
              <SentimentRatioChart data={marketData} />
            )}
          </div>
        </div>

        {/* Pair History Section */}
        <div className="rounded-lg border border-border bg-card p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <h3 className="text-sm font-display font-semibold text-foreground flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              Pair Score History
            </h3>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search pair..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs font-body"
              />
            </div>
            <Button
              variant={compareMode ? "default" : "outline"}
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                setCompareMode(!compareMode);
                if (compareMode) { setComparePairIds([]); setCompareData([]); }
              }}
            >
              <GitCompare className="w-3.5 h-3.5" />
              {compareMode ? "Exit Compare" : "Compare"}
            </Button>
          </div>

          {/* Pair chips */}
          <div className="flex flex-wrap gap-1.5 mb-4 max-h-[140px] overflow-y-auto">
            {filteredPairs.map((p) => {
              const isSelected = selectedPair?.id === p.id;
              const isComparing = comparePairIds.includes(p.id);
              const compareIdx = comparePairIds.indexOf(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (compareMode) {
                      toggleCompare(p.id);
                    } else {
                      setSelectedPair(isSelected ? null : p);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-display font-medium border transition-colors ${
                    isSelected
                      ? "bg-primary/15 text-primary border-primary/30"
                      : isComparing
                        ? "border-primary/40 text-primary bg-primary/10"
                        : "bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                  }`}
                  style={isComparing ? { borderColor: COMPARE_COLORS[compareIdx % COMPARE_COLORS.length], color: COMPARE_COLORS[compareIdx % COMPARE_COLORS.length] } : undefined}
                >
                  {p.symbol}
                </button>
              );
            })}
          </div>

          {/* Compare legend */}
          {compareMode && comparePairIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {comparePairIds.map((id, i) => {
                const pair = pairs.find((p) => p.id === id);
                return (
                  <span key={id} className="flex items-center gap-1.5 text-xs font-display font-medium" style={{ color: COMPARE_COLORS[i % COMPARE_COLORS.length] }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMPARE_COLORS[i % COMPARE_COLORS.length] }} />
                    {pair?.symbol}
                    <button onClick={() => toggleCompare(id)} className="ml-0.5 opacity-60 hover:opacity-100">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Chart */}
          {(selectedPair || compareMode) && (
            <div className="mb-4">
              {pairLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : pairPoints.length === 0 && compareData.every((d) => d.points.length === 0) ? (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                  No score history for this pair on {selectedTimeframe}
                </div>
              ) : (
                <PairScoreChart points={pairPoints} comparePairs={compareData} />
              )}
            </div>
          )}

          {/* Stats */}
          {selectedPair && pairPoints.length > 0 && !compareMode && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MiniStat label="Highest" value={stats.highest} color="text-bullish" />
              <MiniStat label="Lowest" value={stats.lowest} color="text-bearish" />
              <MiniStat label="Time Bullish" value={`${stats.bullishPct}%`} color="text-bullish" />
              <MiniStat label="Time Bearish" value={`${stats.bearishPct}%`} color="text-bearish" />
              <MiniStat label="Streak" value={stats.currentStreak} />
              <MiniStat label="Avg 7d" value={stats.avg7d} />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 text-center">
      <p className="text-[10px] text-muted-foreground font-display uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-display font-bold ${color || "text-foreground"}`}>{value}</p>
    </div>
  );
}

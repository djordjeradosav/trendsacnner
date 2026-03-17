import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Radar, Search, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";
import { useTimeframe } from "@/hooks/useTimeframe";
import { useAutoScan } from "@/hooks/useAutoScan";
import { useFastScan } from "@/hooks/useFastScan";
import { useToast } from "@/hooks/use-toast";
import { ScanButton } from "@/components/scanner/ScanButton";
import { TimeframeSelector } from "@/components/scanner/TimeframeSelector";
import { MarketSentimentBar, SectorCards } from "@/components/scanner/MarketSectors";
import { useSectorStats } from "@/hooks/useSectorStats";
import { useWatchlists } from "@/hooks/useWatchlists";
import { useScoresStore, loadAllTimeframeScores, type ScoreEntry } from "@/stores/useScoresStore";
import { useEnsureFreshData } from "@/hooks/useEnsureFreshData";
import { timeframeOptions } from "@/hooks/useTimeframe";
import { timeAgo } from "@/lib/display";

interface PairInfo {
  id: string;
  symbol: string;
  name: string;
  category: string;
}

interface PairScore {
  pairId: string;
  symbol: string;
  name: string;
  category: string;
  score: number;
  trend: string;
  emaScore: number | null;
  adxScore: number | null;
  rsiScore: number | null;
  macdScore: number | null;
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-bullish/15 border-bullish/30";
  if (score >= 65) return "bg-bullish/10 border-bullish/20";
  if (score >= 50) return "bg-secondary border-border";
  if (score >= 36) return "bg-bearish/10 border-bearish/20";
  return "bg-bearish/15 border-bearish/30";
}

function getScoreColor(score: number): string {
  if (score >= 65) return "text-bullish";
  if (score >= 36) return "text-neutral-tone";
  return "text-bearish";
}

function TrendArrow({ trend }: { trend: string }) {
  if (trend === "bullish") return <TrendingUp className="w-4 h-4 text-bullish" />;
  if (trend === "bearish") return <TrendingDown className="w-4 h-4 text-bearish" />;
  return <Minus className="w-4 h-4 text-neutral-tone" />;
}

const CATEGORIES = ["All", "Forex", "Futures", "Commodity"];

export default function ScannerPage() {
  useEnsureFreshData();

  const [pairsInfo, setPairsInfo] = useState<PairInfo[]>([]);
  const [pairsLoading, setPairsLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const { sectors, sentiment, loading: sectorsLoading } = useSectorStats();
  const { watchlists } = useWatchlists();
  const [activeWatchlist, setActiveWatchlist] = useState<string | null>(null);
  const { selectedTimeframe, setTimeframe } = useTimeframe();
  const [lastScan, setLastScan] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const scan = useFastScan();

  // Read from Zustand store
  const allStoreScores = useScoresStore((s) => s.getAll(selectedTimeframe));
  const storeScoreMap = useMemo(() => {
    const m = new Map<string, ScoreEntry>();
    allStoreScores.forEach((s) => m.set(s.symbol, s));
    return m;
  }, [allStoreScores]);

  // Sync timeframe to store
  useEffect(() => {
    useScoresStore.getState().setActiveTimeframe(selectedTimeframe);
  }, [selectedTimeframe]);

  // Track recently updated pair_ids for flash animation
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevScoresRef = useRef<ScoreEntry[]>();

  useEffect(() => {
    if (allStoreScores.length > 0 && prevScoresRef.current && prevScoresRef.current !== allStoreScores) {
      const prevMap = new Map(prevScoresRef.current.map((s) => [s.symbol, s.score]));
      const changed = new Set<string>();
      allStoreScores.forEach((s) => {
        const pairInfo = pairsInfo.find((p) => p.symbol === s.symbol);
        if (pairInfo && prevMap.get(s.symbol) !== s.score) changed.add(pairInfo.id);
      });
      if (changed.size > 0) {
        setFlashIds(changed);
        setLastUpdated(new Date());
        setTimeout(() => setFlashIds(new Set()), 1500);
      }
    }
    prevScoresRef.current = allStoreScores;
  }, [allStoreScores, pairsInfo]);

  // Merge pairs info with store scores
  const pairs: PairScore[] = useMemo(() => {
    if (!pairsInfo.length) return [];
    return pairsInfo.map((p) => {
      const s = storeScoreMap.get(p.symbol);
      return {
        pairId: p.id,
        symbol: p.symbol,
        name: p.name,
        category: p.category,
        score: s ? s.score : 50,
        trend: s?.trend ?? "neutral",
        emaScore: s?.ema_score ?? null,
        adxScore: s?.adx_score ?? null,
        rsiScore: s?.rsi_score ?? null,
        macdScore: s?.macd_score ?? null,
      };
    });
  }, [pairsInfo, storeScoreMap]);

  const executeScan = useCallback(async () => {
    if (scan.isScanning) return;
    await scan.runScan(selectedTimeframe);
    // Reload store after scan
    await loadAllTimeframeScores();
  }, [scan.isScanning, selectedTimeframe, scan.runScan]);

  useEffect(() => {
    if (scan.result && !scan.isScanning) {
      setLastScan(new Date().toLocaleString());
      toast({
        title: "Scan complete",
        description: `${scan.result.scored} pairs scored in ${(scan.result.durationMs / 1000).toFixed(1)}s`,
      });
    }
  }, [scan.result, scan.isScanning]);

  const { timeUntilNextScan, isAutoScanEnabled, autoScanAgo } = useAutoScan(executeScan);

  useEffect(() => {
    const fetchPairs = async () => {
      setPairsLoading(true);
      const { data } = await supabase.from("pairs").select("id, symbol, name, category").eq("is_active", true);
      if (data) setPairsInfo(data);
      setPairsLoading(false);
    };
    fetchPairs();

    const fetchLast = async () => {
      const { data } = await supabase.from("scan_history").select("scanned_at").order("scanned_at", { ascending: false }).limit(1);
      if (data && data.length > 0) setLastScan(new Date(data[0].scanned_at).toLocaleString());
    };
    fetchLast();
  }, []);

  const filtered = useMemo(() => {
    let list = pairs;
    if (activeWatchlist) {
      const wl = watchlists.find((w) => w.id === activeWatchlist);
      if (wl) list = list.filter((p) => wl.pair_ids.includes(p.pairId));
    }
    if (filter !== "All") list = list.filter((p) => p.category.toLowerCase() === filter.toLowerCase());
    if (search) list = list.filter((p) => p.symbol.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [pairs, filter, search, activeWatchlist, watchlists]);

  const bullishCount = pairs.filter((p) => p.trend === "bullish").length;
  const bearishCount = pairs.filter((p) => p.trend === "bearish").length;
  const neutralCount = pairs.filter((p) => p.trend === "neutral").length;
  const avgScore = pairs.length ? Math.round(pairs.reduce((s, p) => s + p.score, 0) / pairs.length * 10) / 10 : 0;

  const strongest = useMemo(() => [...pairs].filter((p) => p.trend === "bullish").sort((a, b) => b.score - a.score).slice(0, 8), [pairs]);
  const weakest = useMemo(() => [...pairs].filter((p) => p.trend === "bearish").sort((a, b) => a.score - b.score).slice(0, 8), [pairs]);

  const handleCancelScan = () => { scan.cancelScan(); };

  const tfLabel = timeframeOptions.find(o => o.value === selectedTimeframe)?.label || selectedTimeframe;

  const layoutProps = {
    lastScan,
    scanning: scan.isScanning,
    scanDone: scan.done,
    scanTotal: scan.total,
    onRunScan: executeScan,
    onCancelScan: handleCancelScan,
    timeUntilNextScan,
    isAutoScanEnabled,
    autoScanAgo,
    currentSymbol: scan.currentSymbol,
  };

  const loading = pairsLoading;
  const hasScores = allStoreScores.length > 0;

  const updatedAgoText = useMemo(() => {
    if (!lastUpdated) return null;
    const diffSec = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (diffSec < 5) return "Updated just now";
    if (diffSec < 60) return `Updated ${diffSec}s ago`;
    return `Updated ${Math.floor(diffSec / 60)}m ago`;
  }, [lastUpdated]);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastUpdated) return;
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  if (loading) {
    return (
      <AppLayout {...layoutProps}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-12" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Array.from({ length: 18 }).map((_, i) => (
              <Skeleton key={i} className="h-[90px] rounded-lg" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!hasScores) {
    return (
      <AppLayout {...layoutProps}>
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 opacity-40">
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={i} className="w-[140px] h-[90px] rounded-lg" />
            ))}
          </div>
          <div className="text-center space-y-3">
            <p className="text-lg font-display text-foreground">No scan data yet</p>
            <p className="text-sm text-muted-foreground">Run your first scan to see live trends</p>
            <Button onClick={executeScan} disabled={scan.isScanning} className="gap-2">
              <Radar className="w-4 h-4" />
              Run first scan
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout {...layoutProps}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-display text-foreground">Scanner</h1>
          {updatedAgoText && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-display animate-in fade-in duration-300">
              <Clock className="w-3 h-3" />
              {updatedAgoText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <TimeframeSelector selected={selectedTimeframe} onChange={setTimeframe} disabled={scan.isScanning} />
          <ScanButton
            isScanning={scan.isScanning}
            progress={scan.progress}
            done={scan.done}
            total={scan.total}
            currentSymbol={scan.currentSymbol}
            eta={scan.eta}
            lastScanDuration={scan.lastScanDuration}
            lastScanAt={scan.lastScanAt}
            timeframeLabel={tfLabel}
            onScan={executeScan}
          />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Pairs" value={pairs.length} />
        <StatCard label="Bullish" value={`${pairs.length ? Math.round(bullishCount / pairs.length * 100) : 0}%`} sub={`${bullishCount} pairs`} color="text-bullish" />
        <StatCard label="Neutral" value={`${pairs.length ? Math.round(neutralCount / pairs.length * 100) : 0}%`} sub={`${neutralCount} pairs`} color="text-neutral-tone" />
        <StatCard label="Bearish" value={`${pairs.length ? Math.round(bearishCount / pairs.length * 100) : 0}%`} sub={`${bearishCount} pairs`} color="text-bearish" />
        <StatCard label="Avg Score" value={avgScore} color={getScoreColor(avgScore)} />
      </div>

      {sentiment && <MarketSentimentBar sentiment={sentiment} />}
      {sectors.length > 0 && <SectorCards sectors={sectors} />}

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            {CATEGORIES.map((c) => (
              <TabsTrigger key={c} value={c} className="text-xs font-display">{c}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search symbol..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm font-body" />
        </div>
      </div>

      {/* Watchlist filter pills */}
      {watchlists.length > 0 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          <span className="text-[11px] text-muted-foreground font-body shrink-0">Watchlists:</span>
          {watchlists.map((wl) => (
            <button
              key={wl.id}
              onClick={() => setActiveWatchlist(activeWatchlist === wl.id ? null : wl.id)}
              className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-display font-medium border transition-colors ${
                activeWatchlist === wl.id
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-transparent border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {wl.name} ({wl.pair_ids.length})
            </button>
          ))}
        </div>
      )}

      {/* Heatmap Grid */}
      <ErrorBoundary name="Heatmap">
        <div className="mb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
            {filtered.map((p) => {
              const isFlashing = flashIds.has(p.pairId);
              const storeScore = storeScoreMap.get(p.symbol);
              return (
                <Tooltip key={p.pairId}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(`/pair/${p.symbol}`)}
                      className={`relative flex flex-col items-center justify-center rounded-lg border p-3 h-[90px] transition-all duration-150 hover:scale-[1.04] hover:brightness-125 hover:z-10 cursor-pointer ${getScoreBg(p.score)} ${isFlashing ? "ring-2 ring-primary animate-pulse" : ""}`}
                    >
                      <span className="text-[13px] font-display font-bold text-foreground leading-none">{p.symbol}</span>
                      <span className={`text-2xl font-display font-bold leading-tight ${getScoreColor(p.score)}`}>{Math.round(p.score)}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <TrendArrow trend={p.trend} />
                        <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{p.category}</span>
                      </div>
                      {storeScore && (
                        <span className="text-[8px] text-muted-foreground mt-0.5">{timeAgo(storeScore.scanned_at)}</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs font-body">
                    <p className="font-semibold">{p.name}</p>
                    <p>Score: {p.score} · {p.trend}</p>
                    {storeScore?.rsi != null && <p>RSI: {storeScore.rsi.toFixed(1)} · ADX: {storeScore.adx?.toFixed(1) ?? "—"}</p>}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </ErrorBoundary>

      {/* Leaderboards */}
      {(strongest.length > 0 || weakest.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LeaderboardColumn title="Strongest Trends" icon={<TrendingUp className="w-4 h-4 text-bullish" />} items={strongest} type="bullish" />
          <LeaderboardColumn title="Weakest Pairs" icon={<TrendingDown className="w-4 h-4 text-bearish" />} items={weakest} type="bearish" />
        </div>
      )}
    </AppLayout>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-body text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-display font-bold ${color || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function LeaderboardColumn({ title, icon, items, type }: { title: string; icon: React.ReactNode; items: PairScore[]; type: "bullish" | "bearish" }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 p-4 pb-2">
        {icon}
        <h3 className="text-sm font-display font-semibold text-foreground">{title}</h3>
      </div>
      <div className="divide-y divide-border">
        {items.map((p, i) => (
          <div key={p.pairId} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-xs font-display text-muted-foreground w-5 text-right">{i + 1}</span>
            <span className="text-sm font-display font-semibold text-foreground flex-1">{p.symbol}</span>
            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${type === "bullish" ? "bg-bullish" : "bg-bearish"}`}
                style={{ width: `${p.score}%` }}
              />
            </div>
            <span className={`text-sm font-display font-bold w-8 text-right ${type === "bullish" ? "text-bullish" : "text-bearish"}`}>
              {Math.round(p.score)}
            </span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="px-4 py-3 text-xs text-muted-foreground">No data yet</p>
        )}
      </div>
    </div>
  );
}

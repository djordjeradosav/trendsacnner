import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Radar, Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTimeframe } from "@/hooks/useTimeframe";
import { useAutoScan } from "@/hooks/useAutoScan";
import { runFullScan, createScanController } from "@/services/scannerService";
import { useToast } from "@/hooks/use-toast";
import { useCallback, useRef } from "react";
import { ScanProgress } from "@/components/scanner/ScanProgress";
import { TimeframeSelector } from "@/components/scanner/TimeframeSelector";
import { MarketSentimentBar, SectorCards } from "@/components/scanner/MarketSectors";
import { useSectorStats } from "@/hooks/useSectorStats";

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
  if (score >= 80) return "bg-[hsl(142_40%_12%)] border-[hsl(142_50%_30%)]";
  if (score >= 65) return "bg-[hsl(142_30%_8%)] border-[hsl(142_40%_20%)]";
  if (score >= 50) return "bg-secondary border-border";
  if (score >= 36) return "bg-[hsl(0_30%_8%)] border-[hsl(0_40%_20%)]";
  return "bg-[hsl(0_40%_12%)] border-[hsl(0_50%_30%)]";
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
  const [pairs, setPairs] = useState<PairScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasScores, setHasScores] = useState(false);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const { selectedTimeframe, setTimeframe } = useTimeframe();
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanSymbol, setScanSymbol] = useState("");
  const [lastScan, setLastScan] = useState<string | null>(null);
  const controllerRef = useRef<ReturnType<typeof createScanController> | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const executeScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setScanDone(0);
    setScanTotal(0);
    setScanSymbol("");
    const controller = createScanController();
    controllerRef.current = controller;
    try {
      const result = await runFullScan(
        selectedTimeframe,
        (done, total, symbol) => { setScanDone(done); setScanTotal(total); setScanSymbol(symbol); },
        controller
      );
      if (!controller.isCancelled()) {
        setLastScan(new Date(result.scannedAt).toLocaleString());
        toast({ title: "Scan complete", description: `${result.totalPairs} pairs | ${result.bullish} bullish | ${result.neutral} neutral | ${result.bearish} bearish | Avg score: ${result.avgScore}` });
        fetchScores();
      }
    } catch (err) {
      toast({ title: "Scan failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setScanning(false);
      controllerRef.current = null;
    }
  }, [scanning, selectedTimeframe, toast]);

  const { timeUntilNextScan, isAutoScanEnabled, autoScanAgo } = useAutoScan(executeScan);

  const fetchScores = async () => {
    setLoading(true);
    const { data: pairsData } = await supabase.from("pairs").select("id, symbol, name, category").eq("is_active", true);
    if (!pairsData) { setLoading(false); return; }

    const { data: scoresData } = await supabase.from("scores").select("pair_id, score, trend, ema_score, adx_score, rsi_score, macd_score, timeframe");

    if (!scoresData || scoresData.length === 0) {
      setHasScores(false);
      setLoading(false);
      return;
    }

    const scoreMap = new Map<string, typeof scoresData[0]>();
    scoresData.forEach((s) => { scoreMap.set(s.pair_id, s); });

    const merged: PairScore[] = pairsData.map((p) => {
      const s = scoreMap.get(p.id);
      return {
        pairId: p.id,
        symbol: p.symbol,
        name: p.name,
        category: p.category,
        score: s?.score ?? 50,
        trend: s?.trend ?? "neutral",
        emaScore: s?.ema_score ?? null,
        adxScore: s?.adx_score ?? null,
        rsiScore: s?.rsi_score ?? null,
        macdScore: s?.macd_score ?? null,
      };
    });

    setPairs(merged);
    setHasScores(true);
    setLoading(false);
  };

  useEffect(() => {
    fetchScores();
    const fetchLast = async () => {
      const { data } = await supabase.from("scan_history").select("scanned_at").order("scanned_at", { ascending: false }).limit(1);
      if (data && data.length > 0) setLastScan(new Date(data[0].scanned_at).toLocaleString());
    };
    fetchLast();
  }, []);

  const filtered = useMemo(() => {
    let list = pairs;
    if (filter !== "All") list = list.filter((p) => p.category.toLowerCase() === filter.toLowerCase());
    if (search) list = list.filter((p) => p.symbol.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [pairs, filter, search]);

  const bullishCount = pairs.filter((p) => p.trend === "bullish").length;
  const bearishCount = pairs.filter((p) => p.trend === "bearish").length;
  const neutralCount = pairs.filter((p) => p.trend === "neutral").length;
  const avgScore = pairs.length ? Math.round(pairs.reduce((s, p) => s + p.score, 0) / pairs.length * 10) / 10 : 0;

  const strongest = useMemo(() => [...pairs].filter((p) => p.trend === "bullish").sort((a, b) => b.score - a.score).slice(0, 8), [pairs]);
  const weakest = useMemo(() => [...pairs].filter((p) => p.trend === "bearish").sort((a, b) => a.score - b.score).slice(0, 8), [pairs]);

  const handleCancelScan = () => { controllerRef.current?.cancel(); };

  if (loading) {
    return (
      <AppLayout lastScan={lastScan} scanning={scanning} scanDone={scanDone} scanTotal={scanTotal} onRunScan={executeScan} timeUntilNextScan={timeUntilNextScan} isAutoScanEnabled={isAutoScanEnabled} autoScanAgo={autoScanAgo}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 18 }).map((_, i) => (
            <Skeleton key={i} className="h-[90px] rounded-lg" />
          ))}
        </div>
      </AppLayout>
    );
  }

  if (!hasScores) {
    return (
      <AppLayout lastScan={lastScan} scanning={scanning} scanDone={scanDone} scanTotal={scanTotal} onRunScan={executeScan} timeUntilNextScan={timeUntilNextScan} isAutoScanEnabled={isAutoScanEnabled} autoScanAgo={autoScanAgo}>
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 opacity-40">
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={i} className="w-[140px] h-[90px] rounded-lg" />
            ))}
          </div>
          <div className="text-center space-y-3">
            <p className="text-lg font-display text-foreground">No scan data yet</p>
            <p className="text-sm text-muted-foreground">Run your first scan to see live trends</p>
            <Button onClick={executeScan} disabled={scanning} className="gap-2">
              <Radar className="w-4 h-4" />
              Run first scan
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout lastScan={lastScan} scanning={scanning} scanDone={scanDone} scanTotal={scanTotal} onRunScan={executeScan} timeUntilNextScan={timeUntilNextScan} isAutoScanEnabled={isAutoScanEnabled} autoScanAgo={autoScanAgo}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold font-display text-foreground">Scanner</h1>
        <TimeframeSelector selected={selectedTimeframe} onChange={setTimeframe} disabled={scanning} />
      </div>

      {scanning && (
        <div className="mb-4">
          <ScanProgress done={scanDone} total={scanTotal} currentSymbol={scanSymbol} onCancel={handleCancelScan} />
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Pairs" value={pairs.length} />
        <StatCard label="Bullish" value={`${pairs.length ? Math.round(bullishCount / pairs.length * 100) : 0}%`} sub={`${bullishCount} pairs`} color="text-bullish" />
        <StatCard label="Neutral" value={`${pairs.length ? Math.round(neutralCount / pairs.length * 100) : 0}%`} sub={`${neutralCount} pairs`} color="text-neutral-tone" />
        <StatCard label="Bearish" value={`${pairs.length ? Math.round(bearishCount / pairs.length * 100) : 0}%`} sub={`${bearishCount} pairs`} color="text-bearish" />
        <StatCard label="Avg Score" value={avgScore} color={getScoreColor(avgScore)} />
      </div>

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
          <Input
            placeholder="Search symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm font-body"
          />
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-10">
        {filtered.map((p) => (
          <Tooltip key={p.pairId}>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate(`/pair/${p.symbol}`)}
                className={`relative flex flex-col items-center justify-center rounded-lg border p-3 h-[90px] transition-all duration-150 hover:scale-[1.04] hover:brightness-125 hover:z-10 cursor-pointer ${getScoreBg(p.score)}`}
              >
                <span className="text-[13px] font-display font-bold text-foreground leading-none">{p.symbol}</span>
                <span className={`text-2xl font-display font-bold leading-tight ${getScoreColor(p.score)}`}>{Math.round(p.score)}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <TrendArrow trend={p.trend} />
                  <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{p.category}</span>
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-body">
              <p className="font-semibold">{p.name}</p>
              <p>Score: {p.score} · {p.trend}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

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
                className={`h-full rounded-full ${type === "bullish" ? "bg-bullish" : "bg-bearish"}`}
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

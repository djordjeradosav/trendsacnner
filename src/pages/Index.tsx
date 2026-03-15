import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { TimeframeSelector } from "@/components/scanner/TimeframeSelector";
import { ScanProgress } from "@/components/scanner/ScanProgress";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { IndicatorTestPanel } from "@/components/debug/IndicatorTestPanel";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { MarketSessionBar } from "@/components/dashboard/MarketSessionBar";
import { AIMacroDesk } from "@/components/dashboard/AIMacroDesk";
import { ForYouPanel } from "@/components/dashboard/ForYouPanel";
import { CapitalFlowWidget } from "@/components/dashboard/CapitalFlowWidget";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { BreakingNewsBanner } from "@/components/news/BreakingNewsBanner";
import { MarketBriefCard } from "@/components/dashboard/MarketBriefCard";
import { PriceTicker } from "@/components/dashboard/PriceTicker";
import { HeatmapWidget } from "@/components/dashboard/HeatmapWidget";
import { useTimeframe } from "@/hooks/useTimeframe";
import { useAutoScan } from "@/hooks/useAutoScan";
import { useAllScores } from "@/hooks/useScores";
import { runFullScan, createScanController } from "@/services/scannerService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BarChart3,
  Zap,
  RefreshCw,
} from "lucide-react";

const isDev = import.meta.env.DEV;

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "hsl(var(--primary))" }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "hsl(var(--primary))" }} />
    </span>
  );
}

function StatCard({ label, value, icon, color, sub }: { label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <div className="rounded-lg p-3 flex items-center gap-3 transition-colors bg-card border border-border/50">
      <div className="p-2 rounded-md" style={{ background: color + "15" }}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#5a7080" }}>{label}</div>
        <div className="text-[18px] font-bold tabular-nums" style={{ color }}>{value}</div>
        {sub && <div className="text-[9px] font-mono" style={{ color: "#5a7080" }}>{sub}</div>}
      </div>
    </div>
  );
}

const Index = () => {
  const { selectedTimeframe, setTimeframe } = useTimeframe();
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanSymbol, setScanSymbol] = useState("");
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const controllerRef = useRef<ReturnType<typeof createScanController> | null>(null);
  const { toast } = useToast();

  const { data: allScores } = useAllScores(selectedTimeframe);

  // Compute live stats from scores
  const stats = useMemo(() => {
    if (!allScores || allScores.length === 0) return { total: 0, bullish: 0, bearish: 0, neutral: 0, avg: 0, strongBull: 0, strongBear: 0 };
    let bullish = 0, bearish = 0, neutral = 0, totalScore = 0, strongBull = 0, strongBear = 0;
    allScores.forEach((s) => {
      totalScore += s.score;
      if (s.trend === "bullish") { bullish++; if (s.score >= 75) strongBull++; }
      else if (s.trend === "bearish") { bearish++; if (s.score <= 25) strongBear++; }
      else neutral++;
    });
    return { total: allScores.length, bullish, bearish, neutral, avg: Math.round(totalScore / allScores.length * 10) / 10, strongBull, strongBear };
  }, [allScores]);

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
        setLastRefresh(Date.now());
        toast({ title: "Scan complete", description: `${result.totalPairs} pairs scanned` });
      }
    } catch (err) {
      toast({ title: "Scan failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setScanning(false);
      controllerRef.current = null;
    }
  }, [scanning, selectedTimeframe, toast]);

  const { timeUntilNextScan, isAutoScanEnabled, autoScanAgo } = useAutoScan(executeScan);

  // Auto-refresh dashboard data every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => setLastRefresh(Date.now()), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchLastScan = async () => {
      const { data } = await supabase
        .from("scan_history")
        .select("scanned_at")
        .order("scanned_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) setLastScan(new Date(data[0].scanned_at).toLocaleString());
    };
    fetchLastScan();
  }, []);

  const handleCancelScan = () => { controllerRef.current?.cancel(); };

  const marketSentiment = stats.avg >= 60 ? "Risk-On" : stats.avg <= 40 ? "Risk-Off" : "Mixed";
  const sentimentColor = stats.avg >= 60 ? "hsl(var(--primary))" : stats.avg <= 40 ? "#ef4444" : "#f59e0b";

  return (
    <AppLayout
      lastScan={lastScan}
      isLive={scanning}
      scanning={scanning}
      scanDone={scanDone}
      scanTotal={scanTotal}
      onRunScan={executeScan}
      onCancelScan={handleCancelScan}
      timeUntilNextScan={timeUntilNextScan}
      isAutoScanEnabled={isAutoScanEnabled}
      autoScanAgo={autoScanAgo}
      timeframe={selectedTimeframe}
      currentSymbol={scanSymbol}
    >
      <BreakingNewsBanner />

      <div className="flex flex-col gap-3" style={{ minHeight: "calc(100vh - 72px)" }}>
        {/* Live Price Ticker */}
        <div className="anim-fade-down shrink-0">
          <PriceTicker />
        </div>

        {/* Session Bar */}
        <div className="anim-fade-down shrink-0">
          <MarketSessionBar />
        </div>

        {/* Greeting + Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 anim-fade-up shrink-0" style={{ animationDelay: "80ms" }}>
          <DashboardGreeting />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-card border border-border/50">
              <LiveDot />
              <span className="text-[10px] font-mono" style={{ color: sentimentColor }}>
                {marketSentiment}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {stats.avg || "—"}
              </span>
            </div>
            <TimeframeSelector selected={selectedTimeframe} onChange={setTimeframe} disabled={scanning} />
          </div>
        </div>

        {scanning && (
          <div className="shrink-0">
            <ScanProgress done={scanDone} total={scanTotal} currentSymbol={scanSymbol} onCancel={handleCancelScan} />
          </div>
        )}

        {/* Live Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2 anim-fade-up shrink-0" style={{ animationDelay: "120ms" }}>
          <StatCard
            label="Total Pairs"
            value={stats.total || "—"}
            icon={<BarChart3 className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />}
            color="hsl(var(--primary))"
            sub="Actively monitored"
          />
          <StatCard
            label="Bullish"
            value={stats.bullish}
            icon={<TrendingUp className="w-4 h-4" style={{ color: "#22c55e" }} />}
            color="#22c55e"
            sub={`${stats.strongBull} strong signals`}
          />
          <StatCard
            label="Bearish"
            value={stats.bearish}
            icon={<TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />}
            color="#ef4444"
            sub={`${stats.strongBear} strong signals`}
          />
          <StatCard
            label="Neutral"
            value={stats.neutral}
            icon={<Minus className="w-4 h-4" style={{ color: "#f59e0b" }} />}
            color="#f59e0b"
            sub="Consolidating"
          />
          <StatCard
            label="Avg Score"
            value={stats.avg || "—"}
            icon={<Activity className="w-4 h-4" style={{ color: sentimentColor }} />}
            color={sentimentColor}
            sub={marketSentiment}
          />
          <StatCard
            label="Auto-Scan"
            value={isAutoScanEnabled ? "ON" : "OFF"}
            icon={<Zap className="w-4 h-4" style={{ color: isAutoScanEnabled ? "#22c55e" : "#5a7080" }} />}
            color={isAutoScanEnabled ? "#22c55e" : "#5a7080"}
            sub="Every 10 min"
          />
        </div>

        {/* Heatmap */}
        <div className="anim-fade-up shrink-0" style={{ animationDelay: "140ms", height: "200px" }}>
          <HeatmapWidget timeframe={selectedTimeframe} />
        </div>

        {/* Main 3-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_360px] gap-3 flex-1 min-h-0">
          {/* Col 1: AI Macro Desk */}
          <div className="min-h-0 anim-fade-up" style={{ animationDelay: "160ms" }}>
            <div className="rounded-lg p-4 h-full overflow-y-auto bg-card border border-border/50">
              <AIMacroDesk timeframe={selectedTimeframe} />
            </div>
          </div>

          {/* Col 2: Market Brief + Capital Flow */}
          <div className="flex flex-col gap-3 min-h-0 anim-fade-up" style={{ animationDelay: "200ms" }}>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <MarketBriefCard timeframe={selectedTimeframe} />
            </div>
            <div style={{ height: "240px", flexShrink: 0 }}>
              <CapitalFlowWidget timeframe={selectedTimeframe} />
            </div>
          </div>

          {/* Col 3: For You + Calendar */}
          <div className="flex flex-col gap-3 min-h-0 anim-fade-right" style={{ animationDelay: "240ms" }}>
            <div className="flex-1 min-h-0 rounded-lg p-4 overflow-y-auto bg-card border border-border/50">
              <ForYouPanel />
            </div>
            <div className="shrink-0" style={{ height: "220px" }}>
              <CalendarWidget />
            </div>
          </div>
        </div>
      </div>

      {isDev && (
        <div className="mt-8 space-y-4">
          <DebugPanel />
          <IndicatorTestPanel />
        </div>
      )}
    </AppLayout>
  );
};

export default Index;

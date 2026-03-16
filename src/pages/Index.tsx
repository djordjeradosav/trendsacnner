import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { TimeframeSelector } from "@/components/scanner/TimeframeSelector";
import { AutoScanCountdown } from "@/components/scanner/AutoScanCountdown";
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
import { ScanButton } from "@/components/scanner/ScanButton";
import { useTimeframe, timeframeOptions } from "@/hooks/useTimeframe";
import { useAutoScan, scanIntervalOptions } from "@/hooks/useAutoScan";
import { useAllScores } from "@/hooks/useScores";
import { useFastScan } from "@/hooks/useFastScan";
import { useScanStore } from "@/store/scanStore";
import { useTickFeedStatus } from "@/hooks/useTickFeedStatus";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BarChart3,
  Zap,
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
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-[18px] font-bold tabular-nums" style={{ color }}>{value}</div>
        {sub && <div className="text-[9px] font-mono text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

const Index = () => {
  const { selectedTimeframe, setTimeframe } = useTimeframe();
  const { toast } = useToast();
  const [lastScan, setLastScan] = useState<string | null>(null);

  const { runScan, cancelScan } = useFastScan();
  const scanState = useScanStore();
  const wsFeed = useTickFeedStatus(selectedTimeframe);
  const { data: allScores } = useAllScores(selectedTimeframe);

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

  const executeScan = async () => {
    if (scanState.isScanning) return;
    await runScan(selectedTimeframe);
  };

  // Show toast on completion
  useEffect(() => {
    if (scanState.result && !scanState.isScanning) {
      setLastScan(new Date().toLocaleString());
      toast({
        title: "Scan complete",
        description: `${scanState.result.scored} pairs scored in ${(scanState.result.durationMs / 1000).toFixed(1)}s`,
      });
    }
  }, [scanState.result, scanState.isScanning]);

  const { timeUntilNextScan, isAutoScanEnabled, autoScanAgo, scanInterval } = useAutoScan(executeScan);
  const activeIntervalMs = scanIntervalOptions.find((o) => o.value === scanInterval)?.ms ?? null;

  useEffect(() => {
    const fetchLastScan = async () => {
      const { data } = await supabase.from("scan_history").select("scanned_at").order("scanned_at", { ascending: false }).limit(1);
      if (data && data.length > 0) setLastScan(new Date(data[0].scanned_at).toLocaleString());
    };
    fetchLastScan();
  }, []);

  const marketSentiment = stats.avg >= 60 ? "Risk-On" : stats.avg <= 40 ? "Risk-Off" : "Mixed";
  const sentimentColor = stats.avg >= 60 ? "hsl(var(--primary))" : stats.avg <= 40 ? "#ef4444" : "#f59e0b";

  const tfLabel = timeframeOptions.find(o => o.value === selectedTimeframe)?.label || selectedTimeframe;

  return (
    <AppLayout
      lastScan={lastScan}
      isLive={scan.isScanning}
      scanning={scan.isScanning}
      scanDone={scan.done}
      scanTotal={scan.total}
      onRunScan={executeScan}
      onCancelScan={scan.cancelScan}
      timeUntilNextScan={timeUntilNextScan}
      isAutoScanEnabled={isAutoScanEnabled}
      autoScanAgo={autoScanAgo}
      timeframe={selectedTimeframe}
      currentSymbol={scan.currentSymbol}
      wsStatus={wsFeed.status}
      wsPairCount={wsFeed.pairCount}
      wsEligible={wsFeed.isEligible}
      onWsReconnect={wsFeed.reconnect}
    >
      <BreakingNewsBanner />

      <div className="flex flex-col gap-3">
        <div className="anim-fade-down shrink-0">
          <PriceTicker />
        </div>

        <div className="anim-fade-down shrink-0">
          <MarketSessionBar />
        </div>

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
            <TimeframeSelector selected={selectedTimeframe} onChange={setTimeframe} disabled={scan.isScanning} />
          </div>
        </div>

        {/* Scan Button — replaces old ScanProgress */}
        <div className="flex justify-end shrink-0">
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

        {/* Live Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2 anim-fade-up shrink-0" style={{ animationDelay: "120ms" }}>
          <StatCard label="Total Pairs" value={stats.total || "—"} icon={<BarChart3 className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />} color="hsl(var(--primary))" sub="Actively monitored" />
          <StatCard label="Bullish" value={stats.bullish} icon={<TrendingUp className="w-4 h-4" style={{ color: "#22c55e" }} />} color="#22c55e" sub={`${stats.strongBull} strong signals`} />
          <StatCard label="Bearish" value={stats.bearish} icon={<TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />} color="#ef4444" sub={`${stats.strongBear} strong signals`} />
          <StatCard label="Neutral" value={stats.neutral} icon={<Minus className="w-4 h-4" style={{ color: "#f59e0b" }} />} color="#f59e0b" sub="Consolidating" />
          <StatCard label="Avg Score" value={stats.avg || "—"} icon={<Activity className="w-4 h-4" style={{ color: sentimentColor }} />} color={sentimentColor} sub={marketSentiment} />
          <StatCard label="Auto-Scan" value={isAutoScanEnabled ? "ON" : "OFF"} icon={<Zap className="w-4 h-4" style={{ color: isAutoScanEnabled ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))" }} />} color={isAutoScanEnabled ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))"} sub={isAutoScanEnabled ? scanIntervalOptions.find(o => o.value === scanInterval)?.label ?? scanInterval : "Manual only"} />
        </div>

        <div className="anim-fade-up shrink-0" style={{ animationDelay: "140ms", minHeight: "160px" }}>
          <HeatmapWidget timeframe={selectedTimeframe} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_minmax(300px,380px)] gap-3">
          <div className="min-h-[400px] anim-fade-up" style={{ animationDelay: "160ms" }}>
            <div className="rounded-lg p-4 h-full overflow-y-auto bg-card border border-border/50">
              <AIMacroDesk timeframe={selectedTimeframe} />
            </div>
          </div>
          <div className="flex flex-col gap-3 anim-fade-up" style={{ animationDelay: "200ms" }}>
            <div className="min-h-[280px]"><MarketBriefCard timeframe={selectedTimeframe} /></div>
            <div className="min-h-[200px]"><CapitalFlowWidget timeframe={selectedTimeframe} /></div>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-2 xl:col-span-1 anim-fade-right" style={{ animationDelay: "240ms" }}>
            <div className="min-h-[280px] rounded-lg p-4 overflow-y-auto bg-card border border-border/50"><ForYouPanel /></div>
            <div className="min-h-[200px]"><CalendarWidget /></div>
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

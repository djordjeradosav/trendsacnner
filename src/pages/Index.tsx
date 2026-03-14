import { useEffect, useState, useRef, useCallback } from "react";
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
import { useTimeframe } from "@/hooks/useTimeframe";
import { useAutoScan } from "@/hooks/useAutoScan";
import { runFullScan, createScanController } from "@/services/scannerService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MarketCount {
  category: string;
  count: number;
}

const isDev = import.meta.env.DEV;

const Index = () => {
  const [totalPairs, setTotalPairs] = useState<number>(0);
  const [markets, setMarkets] = useState<MarketCount[]>([]);
  const { selectedTimeframe, setTimeframe } = useTimeframe();
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanSymbol, setScanSymbol] = useState("");
  const [lastScan, setLastScan] = useState<string | null>(null);
  const controllerRef = useRef<ReturnType<typeof createScanController> | null>(null);
  const { toast } = useToast();

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
        (done, total, symbol) => {
          setScanDone(done);
          setScanTotal(total);
          setScanSymbol(symbol);
        },
        controller
      );

      if (!controller.isCancelled()) {
        setLastScan(new Date(result.scannedAt).toLocaleString());
        toast({
          title: "Scan complete",
          description: `${result.totalPairs} pairs | ${result.bullish} bullish | ${result.neutral} neutral | ${result.bearish} bearish | Avg score: ${result.avgScore}`,
        });
      }
    } catch (err) {
      toast({
        title: "Scan failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
      controllerRef.current = null;
    }
  }, [scanning, selectedTimeframe, toast]);

  const {
    timeUntilNextScan,
    isAutoScanEnabled,
    autoScanAgo,
  } = useAutoScan(executeScan);

  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase.from("pairs").select("category");
      if (data) {
        setTotalPairs(data.length);
        const counts: Record<string, number> = {};
        data.forEach((row) => {
          counts[row.category] = (counts[row.category] || 0) + 1;
        });
        setMarkets(
          Object.entries(counts).map(([category, count]) => ({ category, count }))
        );
      }
    };

    const fetchLastScan = async () => {
      const { data } = await supabase
        .from("scan_history")
        .select("scanned_at")
        .order("scanned_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLastScan(new Date(data[0].scanned_at).toLocaleString());
      }
    };

    fetchCounts();
    fetchLastScan();
  }, []);

  const handleCancelScan = () => {
    controllerRef.current?.cancel();
  };

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

      {/* Full-viewport dashboard grid */}
      <div
        className="flex flex-col"
        style={{ height: "calc(100vh - 72px)", overflow: "hidden" }}
      >
        {/* Session bar — fade from top */}
        <div className="anim-fade-down shrink-0" style={{ animationDelay: "0ms" }}>
          <MarketSessionBar />
        </div>

        {/* Greeting — fade up */}
        <div className="anim-fade-up mt-3 shrink-0" style={{ animationDelay: "100ms" }}>
          <DashboardGreeting />
        </div>

        {/* Timeframe + scan controls */}
        <div className="flex items-center gap-4 mt-3 shrink-0 anim-fade-up" style={{ animationDelay: "150ms" }}>
          <TimeframeSelector
            selected={selectedTimeframe}
            onChange={setTimeframe}
            disabled={scanning}
          />
        </div>

        {scanning && (
          <div className="mt-3 shrink-0">
            <ScanProgress
              done={scanDone}
              total={scanTotal}
              currentSymbol={scanSymbol}
              onCancel={handleCancelScan}
            />
          </div>
        )}

        {/* Main 2-column grid */}
        <div
          className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 mt-4 flex-1 min-h-0"
        >
          {/* Left column — macro desk with internal scroll */}
          <div className="min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: "480px" }}>
              <AIMacroDesk timeframe={selectedTimeframe} />
            </div>
          </div>

          {/* Right column — stacked widgets, fade from right */}
          <div
            className="anim-fade-right flex flex-col gap-0 min-h-0 overflow-y-auto"
            style={{ animationDelay: "150ms" }}
          >
            {/* For You — flexible height */}
            <div style={{ minHeight: "300px", flex: "1 1 auto" }}>
              <ForYouPanel />
            </div>
            {/* Capital Flow — fixed */}
            <div style={{ height: "220px", flexShrink: 0 }}>
              <CapitalFlowWidget timeframe={selectedTimeframe} />
            </div>
            {/* Calendar — fixed */}
            <div style={{ height: "200px", flexShrink: 0 }}>
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

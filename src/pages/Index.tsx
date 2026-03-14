import { useEffect, useState, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SkeletonDashboard } from "@/components/dashboard/SkeletonDashboard";
import { TimeframeSelector } from "@/components/scanner/TimeframeSelector";
import { ScanProgress } from "@/components/scanner/ScanProgress";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { MarketBriefCard } from "@/components/dashboard/MarketBriefCard";
import { IndicatorTestPanel } from "@/components/debug/IndicatorTestPanel";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { MarketSessionBar } from "@/components/dashboard/MarketSessionBar";
import { AIMacroDesk } from "@/components/dashboard/AIMacroDesk";
import { ForYouPanel } from "@/components/dashboard/ForYouPanel";
import { CapitalFlowWidget } from "@/components/dashboard/CapitalFlowWidget";
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

  const marketsLabel = markets
    .map((m) => `${m.count} ${m.category}`)
    .join(", ");

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
      <DashboardGreeting />

      <div className="mt-4">
        <MarketSessionBar />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 mb-6">
        <TimeframeSelector
          selected={selectedTimeframe}
          onChange={setTimeframe}
          disabled={scanning}
        />
      </div>

      {scanning && (
        <div className="mb-4">
          <ScanProgress
            done={scanDone}
            total={scanTotal}
            currentSymbol={scanSymbol}
            onCancel={handleCancelScan}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <AIMacroDesk timeframe={selectedTimeframe} />
        <div>
          <ForYouPanel />
          <CapitalFlowWidget timeframe={selectedTimeframe} />
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

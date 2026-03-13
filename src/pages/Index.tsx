import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SkeletonDashboard } from "@/components/dashboard/SkeletonDashboard";
import { TimeframeSelector } from "@/components/scanner/TimeframeSelector";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { IndicatorTestPanel } from "@/components/debug/IndicatorTestPanel";
import { useTimeframe } from "@/hooks/useTimeframe";
import { fetchAllPairs } from "@/services/dataService";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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
  const [scanProgress, setScanProgress] = useState<string | null>(null);

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
    fetchCounts();
  }, []);

  const handleTimeframeChange = async (tf: string) => {
    setTimeframe(tf);
    setScanning(true);
    const label = tf.toUpperCase();
    setScanProgress(`Rescanning for ${label}...`);

    try {
      await fetchAllPairs(tf);
      setScanProgress(`Scan complete for ${label}`);
      setTimeout(() => setScanProgress(null), 3000);
    } catch (err) {
      setScanProgress(`Scan failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setScanning(false);
    }
  };

  const marketsLabel = markets
    .map((m) => `${m.count} ${m.category}`)
    .join(", ");

  return (
    <AppLayout lastScan={null} isLive={false}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-display text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {totalPairs} pairs loaded across {markets.length} markets
            {marketsLabel && (
              <span className="text-muted-foreground/70"> · {marketsLabel}</span>
            )}
          </p>
        </div>
        <TimeframeSelector
          selected={selectedTimeframe}
          onChange={handleTimeframeChange}
          disabled={scanning}
        />
      </div>

      {scanProgress && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
          {scanning && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
          <span className="text-sm font-display text-foreground">{scanProgress}</span>
        </div>
      )}

      <SkeletonDashboard />

      {isDev && (
        <div className="mt-8">
          <DebugPanel />
        </div>
      )}
    </AppLayout>
  );
};

export default Index;

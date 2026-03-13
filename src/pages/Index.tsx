import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SkeletonDashboard } from "@/components/dashboard/SkeletonDashboard";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { supabase } from "@/integrations/supabase/client";

interface MarketCount {
  category: string;
  count: number;
}

const isDev = import.meta.env.DEV;

const Index = () => {
  const [totalPairs, setTotalPairs] = useState<number>(0);
  const [markets, setMarkets] = useState<MarketCount[]>([]);

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

  const marketsLabel = markets
    .map((m) => `${m.count} ${m.category}`)
    .join(", ");

  return (
    <AppLayout lastScan={null} isLive={false}>
      <div className="space-y-1 mb-6">
        <h1 className="text-2xl font-bold font-display text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {totalPairs} pairs loaded across {markets.length} markets
          {marketsLabel && (
            <span className="text-muted-foreground/70"> · {marketsLabel}</span>
          )}
        </p>
      </div>
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

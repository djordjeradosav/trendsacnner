import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SkeletonDashboard } from "@/components/dashboard/SkeletonDashboard";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [pairsCount, setPairsCount] = useState<number>(0);

  useEffect(() => {
    supabase
      .from("pairs")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setPairsCount(count ?? 0));
  }, []);

  return (
    <AppLayout lastScan={null} isLive={false}>
      <div className="space-y-1 mb-6">
        <h1 className="text-2xl font-bold font-display text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {pairsCount} pairs loaded · No scan data available
        </p>
      </div>
      <SkeletonDashboard />
    </AppLayout>
  );
};

export default Index;

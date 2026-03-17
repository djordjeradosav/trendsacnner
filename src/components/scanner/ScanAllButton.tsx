import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Radar, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TFS_TO_SCAN = ["15min", "30min", "1h", "4h", "1day"];

interface TFStatus {
  tf: string;
  label: string;
  status: "pending" | "scanning" | "done" | "error";
}

export function ScanAllButton() {
  const [scanning, setScanning] = useState(false);
  const [tfStatuses, setTfStatuses] = useState<TFStatus[]>([]);
  const { toast } = useToast();

  const runAllScans = useCallback(async () => {
    setScanning(true);
    const statuses: TFStatus[] = TFS_TO_SCAN.map((tf) => ({
      tf,
      label: tf === "1day" ? "1D" : tf.replace("min", "M").replace("1h", "1H").replace("4h", "4H"),
      status: "pending",
    }));
    setTfStatuses([...statuses]);

    // Get auth token
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const promises = TFS_TO_SCAN.map(async (tf, idx) => {
      statuses[idx].status = "scanning";
      setTfStatuses([...statuses]);

      try {
        const url = `https://${projectId}.supabase.co/functions/v1/fast-scan?timeframe=${encodeURIComponent(tf)}`;
        const res = await fetch(url, {
          headers: {
            apikey: anonKey,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) throw new Error(`${res.status}`);

        // Consume the SSE stream to completion
        const reader = res.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }

        statuses[idx].status = "done";
      } catch {
        statuses[idx].status = "error";
      }
      setTfStatuses([...statuses]);
    });

    await Promise.allSettled(promises);
    setScanning(false);

    const doneCount = statuses.filter((s) => s.status === "done").length;
    toast({
      title: "All timeframes scanned",
      description: `${doneCount}/${TFS_TO_SCAN.length} timeframes updated`,
    });
  }, [toast]);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={runAllScans}
        disabled={scanning}
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
      >
        {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
        Scan All TFs
      </Button>
      {scanning && tfStatuses.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          {tfStatuses.map((s) => (
            <span key={s.tf} className="flex items-center gap-0.5">
              {s.label}
              {s.status === "done" && <Check className="w-3 h-3 text-bullish" />}
              {s.status === "scanning" && <Loader2 className="w-3 h-3 animate-spin" />}
              {s.status === "error" && <span className="text-destructive">✗</span>}
              {s.status === "pending" && <span className="text-muted-foreground/50">·</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
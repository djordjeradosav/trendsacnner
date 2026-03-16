import { useCallback, useRef } from "react";
import { useScanStore } from "@/store/scanStore";

export function useFastScan() {
  const store = useScanStore();
  const abortRef = useRef<(() => void) | null>(null);

  const runScan = useCallback(async (timeframe: string) => {
    store.startScan(timeframe);
    const startTime = Date.now();

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const url = `https://${projectId}.supabase.co/functions/v1/fast-scan?timeframe=${encodeURIComponent(timeframe)}`;

    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const response = await fetch(url, {
        headers: {
          "apikey": anonKey,
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok || !response.body) {
        throw new Error(`Scan failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      abortRef.current = () => {
        reader.cancel();
        store.resetScan();
      };

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataLine = line.replace(/^data: /, "").trim();
          if (!dataLine) continue;

          try {
            const msg = JSON.parse(dataLine);

            if (msg.type === "progress") {
              const elapsed = Date.now() - startTime;
              const rate = msg.done / elapsed;
              const remaining = rate > 0 ? (msg.total - msg.done) / rate : 0;
              store.updateProgress(msg.done, msg.total, msg.pct, msg.symbol, Math.round(remaining / 1000));
            }

            if (msg.type === "complete") {
              const duration = Date.now() - startTime;
              store.completeScan(msg, duration);
            }
          } catch {
            // skip malformed SSE
          }
        }
      }
    } catch (err) {
      console.error("Fast scan error:", err);
      store.resetScan();
    } finally {
      abortRef.current = null;
    }
  }, [store]);

  const cancelScan = useCallback(() => {
    abortRef.current?.();
  }, []);

  return { runScan, cancelScan };
}

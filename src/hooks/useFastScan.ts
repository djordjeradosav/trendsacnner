import { useState, useCallback, useRef } from "react";

export interface ScanState {
  isScanning: boolean;
  progress: number;
  currentSymbol: string;
  done: number;
  total: number;
  eta: number | null;
  lastScanDuration: number | null;
  lastScanAt: string | null;
  result: {
    total: number;
    bullish: number;
    bearish: number;
    neutral: number;
    scored: number;
    durationMs: number;
    avgScore: number;
  } | null;
}

const initialState: ScanState = {
  isScanning: false,
  progress: 0,
  currentSymbol: "",
  done: 0,
  total: 0,
  eta: null,
  lastScanDuration: null,
  lastScanAt: null,
  result: null,
};

export function useFastScan() {
  const [state, setState] = useState<ScanState>(initialState);
  const abortRef = useRef<(() => void) | null>(null);

  const runScan = useCallback(async (timeframe: string) => {
    setState((s) => ({ ...s, isScanning: true, progress: 0, done: 0, total: 0, currentSymbol: "", eta: null, result: null }));
    const startTime = Date.now();

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const url = `https://${projectId}.supabase.co/functions/v1/fast-scan?timeframe=${encodeURIComponent(timeframe)}`;

    // Get auth token for scan history storage
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
        setState((s) => ({ ...s, isScanning: false }));
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

              setState((s) => ({
                ...s,
                progress: msg.pct,
                currentSymbol: msg.symbol,
                done: msg.done,
                total: msg.total,
                eta: Math.round(remaining / 1000),
              }));
            }

            if (msg.type === "complete") {
              const duration = Date.now() - startTime;
              setState((s) => ({
                ...s,
                isScanning: false,
                progress: 100,
                done: msg.total,
                total: msg.total,
                lastScanDuration: duration,
                lastScanAt: new Date().toISOString(),
                result: msg,
              }));
            }
          } catch {
            // skip malformed SSE
          }
        }
      }
    } catch (err) {
      console.error("Fast scan error:", err);
      setState((s) => ({ ...s, isScanning: false }));
    } finally {
      abortRef.current = null;
    }
  }, []);

  const cancelScan = useCallback(() => {
    abortRef.current?.();
  }, []);

  return { ...state, runScan, cancelScan };
}

import { useState, useCallback, useRef } from "react";

const ALL_TIMEFRAMES = ["5min", "15min", "1h", "4h", "1day"] as const;

export type TFStatus = "pending" | "scanning" | "complete" | "error";

export interface ScanState {
  isScanning: boolean;
  progress: number;
  currentSymbol: string;
  done: number;
  total: number;
  eta: number | null;
  lastScanDuration: number | null;
  lastScanAt: string | null;
  tfStatuses: Record<string, TFStatus>;
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
  tfStatuses: {},
  result: null,
};

export function useFastScan() {
  const [state, setState] = useState<ScanState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const runScan = useCallback(async (_timeframe?: string) => {
    const initStatuses: Record<string, TFStatus> = {};
    ALL_TIMEFRAMES.forEach((tf) => (initStatuses[tf] = "pending"));

    setState({
      ...initialState,
      isScanning: true,
      tfStatuses: initStatuses,
    });

    const startTime = Date.now();
    const controller = new AbortController();
    abortRef.current = controller;

    // Get auth token
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    try {
      // Fire all 4 timeframes in parallel — each returns JSON (not SSE)
      const results = await Promise.allSettled(
        ALL_TIMEFRAMES.map(async (tf) => {
          setState((s) => ({
            ...s,
            tfStatuses: { ...s.tfStatuses, [tf]: "scanning" },
          }));

          const url = `https://${projectId}.supabase.co/functions/v1/fast-scan`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ timeframe: tf }),
            signal: controller.signal,
          });

          if (!res.ok) {
            setState((s) => ({
              ...s,
              tfStatuses: { ...s.tfStatuses, [tf]: "error" },
            }));
            throw new Error(`Scan failed for ${tf}: ${res.status}`);
          }

          const data = await res.json();
          setState((s) => ({
            ...s,
            tfStatuses: { ...s.tfStatuses, [tf]: "complete" },
          }));
          return data;
        })
      );

      // Aggregate results
      let totalPairs = 0, bullish = 0, bearish = 0, neutral = 0, scored = 0, totalAvg = 0;
      let successCount = 0;

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          totalPairs = Math.max(totalPairs, r.value.total || 0);
          bullish += r.value.bullish || 0;
          bearish += r.value.bearish || 0;
          neutral += r.value.neutral || 0;
          scored += r.value.scored || 0;
          totalAvg += r.value.avgScore || 0;
          successCount++;
        }
      }

      const duration = Date.now() - startTime;
      const avgScore = successCount > 0 ? Math.round((totalAvg / successCount) * 10) / 10 : 0;

      setState((s) => ({
        ...s,
        isScanning: false,
        progress: 100,
        done: totalPairs,
        total: totalPairs,
        lastScanDuration: duration,
        lastScanAt: new Date().toISOString(),
        result: {
          total: totalPairs,
          bullish, bearish, neutral, scored,
          durationMs: duration,
          avgScore,
        },
      }));
    } catch (err) {
      console.error("Multi-TF scan error:", err);
      setState((s) => ({ ...s, isScanning: false }));
    } finally {
      abortRef.current = null;
    }
  }, []);

  const cancelScan = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, isScanning: false }));
  }, []);

  return { ...state, runScan, cancelScan };
}

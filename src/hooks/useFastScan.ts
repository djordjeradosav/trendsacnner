import { useState, useCallback, useRef } from "react";

const ALL_TIMEFRAMES = ["5min", "15min", "1h", "4h", "1day"] as const;
const TF_LABELS: Record<string, string> = {
  "5min": "5M", "15min": "15M", "1h": "1H", "4h": "4H", "1day": "1D",
};

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

/**
 * Scans a single timeframe via SSE stream. Returns the final "complete" message.
 */
async function scanOneTimeframe(
  timeframe: string,
  token: string | undefined,
  onProgress: (tf: string, msg: any) => void,
  onStatus: (tf: string, status: TFStatus) => void,
  signal?: AbortSignal,
): Promise<any> {
  onStatus(timeframe, "scanning");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = `https://${projectId}.supabase.co/functions/v1/fast-scan?timeframe=${encodeURIComponent(timeframe)}`;

  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });

  if (!response.ok || !response.body) {
    onStatus(timeframe, "error");
    throw new Error(`Scan failed for ${timeframe}: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: any = null;

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
          onProgress(timeframe, msg);
        }
        if (msg.type === "complete") {
          finalResult = msg;
        }
      } catch {
        // skip malformed SSE
      }
    }
  }

  onStatus(timeframe, finalResult ? "complete" : "error");
  return finalResult;
}

export function useFastScan() {
  const [state, setState] = useState<ScanState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Runs scan for ALL 4 timeframes in parallel.
   * The `_timeframe` param is ignored — kept for API compat but we always scan all.
   */
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

    // Per-TF progress tracking
    const tfProgress: Record<string, { done: number; total: number; symbol: string }> = {};
    ALL_TIMEFRAMES.forEach((tf) => (tfProgress[tf] = { done: 0, total: 0, symbol: "" }));

    const onProgress = (tf: string, msg: any) => {
      tfProgress[tf] = { done: msg.done, total: msg.total, symbol: msg.symbol };

      // Aggregate across all TFs
      let totalDone = 0, totalTotal = 0;
      let currentSymbol = "";
      for (const t of ALL_TIMEFRAMES) {
        totalDone += tfProgress[t].done;
        totalTotal += tfProgress[t].total;
        if (tfProgress[t].symbol) currentSymbol = `${TF_LABELS[t]}: ${tfProgress[t].symbol}`;
      }

      const pct = totalTotal > 0 ? Math.round((totalDone / totalTotal) * 100) : 0;
      const elapsed = Date.now() - startTime;
      const rate = totalDone / elapsed;
      const remaining = rate > 0 ? (totalTotal - totalDone) / rate : 0;

      setState((s) => ({
        ...s,
        progress: pct,
        done: totalDone,
        total: totalTotal,
        currentSymbol,
        eta: Math.round(remaining / 1000),
      }));
    };

    const onStatus = (tf: string, status: TFStatus) => {
      setState((s) => ({
        ...s,
        tfStatuses: { ...s.tfStatuses, [tf]: status },
      }));
    };

    // Get auth token
    const { supabase } = await import("@/integrations/supabase/client");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const results = await Promise.allSettled(
        ALL_TIMEFRAMES.map((tf) =>
          scanOneTimeframe(tf, token, onProgress, onStatus, controller.signal)
        )
      );

      // Aggregate results
      let totalPairs = 0,
        bullish = 0,
        bearish = 0,
        neutral = 0,
        scored = 0,
        totalAvg = 0;
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
        done: s.total,
        lastScanDuration: duration,
        lastScanAt: new Date().toISOString(),
        result: {
          total: totalPairs,
          bullish,
          bearish,
          neutral,
          scored,
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

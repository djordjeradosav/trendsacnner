import { create } from "zustand";

export interface ScanResult {
  total: number;
  bullish: number;
  bearish: number;
  neutral: number;
  scored: number;
  durationMs: number;
  avgScore: number;
}

interface ScanState {
  isScanning: boolean;
  progress: number;
  done: number;
  total: number;
  currentSymbol: string;
  eta: number | null;
  timeframe: string;
  lastScanDuration: number | null;
  lastScanAt: string | null;
  result: ScanResult | null;
  /** pair_ids that have been scanned in the current run */
  scannedPairIds: Set<string>;
  /** Pairs that failed during scan */
  failedSymbols: Set<string>;
  /** Recently completed symbols for overlay grid */
  recentSymbols: { symbol: string; trend: "bullish" | "bearish" | "neutral" | "failed" }[];

  // Actions
  startScan: (timeframe: string) => void;
  updateProgress: (done: number, total: number, pct: number, symbol: string, eta: number | null) => void;
  addScannedPair: (pairId: string, symbol: string, trend: "bullish" | "bearish" | "neutral") => void;
  addFailed: (symbol: string) => void;
  completeScan: (result: ScanResult, durationMs: number) => void;
  resetScan: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  isScanning: false,
  progress: 0,
  done: 0,
  total: 0,
  currentSymbol: "",
  eta: null,
  timeframe: "1h",
  lastScanDuration: null,
  lastScanAt: null,
  result: null,
  scannedPairIds: new Set(),
  failedSymbols: new Set(),
  recentSymbols: [],

  startScan: (timeframe) =>
    set({
      isScanning: true,
      progress: 0,
      done: 0,
      total: 0,
      currentSymbol: "",
      eta: null,
      timeframe,
      result: null,
      scannedPairIds: new Set(),
      failedSymbols: new Set(),
      recentSymbols: [],
    }),

  updateProgress: (done, total, pct, symbol, eta) =>
    set({ done, total, progress: pct, currentSymbol: symbol, eta }),

  addScannedPair: (pairId, symbol, trend) =>
    set((s) => {
      const newSet = new Set(s.scannedPairIds);
      newSet.add(pairId);
      const recent = [...s.recentSymbols, { symbol, trend }].slice(-30);
      return { scannedPairIds: newSet, recentSymbols: recent };
    }),

  addFailed: (symbol) =>
    set((s) => {
      const newSet = new Set(s.failedSymbols);
      newSet.add(symbol);
      const recent = [...s.recentSymbols, { symbol, trend: "failed" as const }].slice(-30);
      return { failedSymbols: newSet, recentSymbols: recent };
    }),

  completeScan: (result, durationMs) =>
    set({
      isScanning: false,
      progress: 100,
      result,
      lastScanDuration: durationMs,
      lastScanAt: new Date().toISOString(),
    }),

  resetScan: () =>
    set({
      isScanning: false,
      progress: 0,
      done: 0,
      total: 0,
      currentSymbol: "",
      eta: null,
      result: null,
    }),
}));

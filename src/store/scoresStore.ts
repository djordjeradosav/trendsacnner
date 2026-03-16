import { create } from "zustand";

export interface ScoreEntry {
  id: string;
  pair_id: string;
  symbol: string;
  score: number;
  trend: "bullish" | "neutral" | "bearish";
  timeframe: string;
  ema_score: number | null;
  adx_score: number | null;
  rsi_score: number | null;
  macd_score: number | null;
  news_score: number | null;
  social_score: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  adx: number | null;
  rsi: number | null;
  macd_hist: number | null;
  scanned_at: string;
}

interface ScoresState {
  // scores[timeframe][pair_id] = ScoreEntry
  scores: Record<string, Record<string, ScoreEntry>>;
  activeTimeframe: string;
  lastScanAt: string | null;

  // Actions
  setActiveTimeframe: (tf: string) => void;
  upsertScore: (score: ScoreEntry) => void;
  bulkLoadScores: (scores: ScoreEntry[], timeframe: string) => void;

  // Selectors
  getScore: (pairId: string, tf?: string) => ScoreEntry | null;
  getAll: (tf?: string) => ScoreEntry[];
  getBullish: (tf?: string) => ScoreEntry[];
  getBearish: (tf?: string) => ScoreEntry[];
  getNeutral: (tf?: string) => ScoreEntry[];
  getAvgScore: (tf?: string) => number;
}

export const useScoresStore = create<ScoresState>((set, get) => ({
  scores: {},
  activeTimeframe: "1h",
  lastScanAt: null,

  setActiveTimeframe: (tf) => set({ activeTimeframe: tf }),

  upsertScore: (score) =>
    set((state) => ({
      scores: {
        ...state.scores,
        [score.timeframe]: {
          ...(state.scores[score.timeframe] ?? {}),
          [score.pair_id]: score,
        },
      },
    })),

  bulkLoadScores: (scores, timeframe) =>
    set((state) => ({
      scores: {
        ...state.scores,
        [timeframe]: Object.fromEntries(scores.map((s) => [s.pair_id, s])),
      },
      lastScanAt: new Date().toISOString(),
    })),

  getScore: (pairId, tf) => {
    const timeframe = tf ?? get().activeTimeframe;
    return get().scores[timeframe]?.[pairId] ?? null;
  },

  getAll: (tf) => {
    const timeframe = tf ?? get().activeTimeframe;
    return Object.values(get().scores[timeframe] ?? {});
  },

  getAvgScore: (tf) => {
    const all = get().getAll(tf);
    if (!all.length) return 0;
    return Math.round((all.reduce((s, r) => s + r.score, 0) / all.length) * 10) / 10;
  },

  getBullish: (tf) => get().getAll(tf).filter((s) => s.trend === "bullish"),
  getBearish: (tf) => get().getAll(tf).filter((s) => s.trend === "bearish"),
  getNeutral: (tf) => get().getAll(tf).filter((s) => s.trend === "neutral"),
}));

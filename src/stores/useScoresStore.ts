import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export interface ScoreEntry {
  pair_id: string;
  symbol: string;
  score: number;
  trend: string;
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

interface PairMeta {
  id: string;
  symbol: string;
  name: string;
  category: string;
}

interface ScoresState {
  // Data
  // scores[timeframe][symbol] = ScoreEntry
  scores: Record<string, Record<string, ScoreEntry>>;
  pairs: PairMeta[];
  pairIdToSymbol: Record<string, string>;
  symbolToPairId: Record<string, string>;

  // Active timeframe
  activeTimeframe: string;
  setActiveTimeframe: (tf: string) => void;

  // Scan state
  scanning: boolean;
  scanProgress: number;
  lastScanAt: string | null;
  setScanning: (v: boolean, progress: number) => void;

  // Actions
  setPairs: (pairs: PairMeta[]) => void;
  bulkLoadScores: (rows: ScoreEntry[], tf: string) => void;
  upsertScore: (row: ScoreEntry) => void;

  // Selectors (callable from outside React)
  getAll: (tf: string) => ScoreEntry[];
  getScore: (symbol: string, tf: string) => ScoreEntry | null;
  getBullish: (tf: string) => ScoreEntry[];
  getBearish: (tf: string) => ScoreEntry[];
}

export const useScoresStore = create<ScoresState>((set, get) => ({
  scores: {},
  pairs: [],
  pairIdToSymbol: {},
  symbolToPairId: {},
  activeTimeframe: "1h",
  scanning: false,
  scanProgress: 0,
  lastScanAt: null,

  setActiveTimeframe: (tf) => set({ activeTimeframe: tf }),

  setScanning: (v, progress) =>
    set({ scanning: v, scanProgress: progress, ...(v ? {} : { lastScanAt: new Date().toISOString() }) }),

  setPairs: (pairs) => {
    const pairIdToSymbol: Record<string, string> = {};
    const symbolToPairId: Record<string, string> = {};
    pairs.forEach((p) => {
      pairIdToSymbol[p.id] = p.symbol;
      symbolToPairId[p.symbol] = p.id;
    });
    set({ pairs, pairIdToSymbol, symbolToPairId });
  },

  bulkLoadScores: (rows, tf) => {
    const state = get();
    const tfScores = { ...(state.scores[tf] || {}) };
    // Deduplicate: keep latest per symbol
    const seen = new Map<string, ScoreEntry>();
    rows.forEach((row) => {
      const existing = seen.get(row.symbol);
      if (!existing || new Date(row.scanned_at) > new Date(existing.scanned_at)) {
        seen.set(row.symbol, row);
      }
    });
    seen.forEach((row, symbol) => {
      tfScores[symbol] = row;
    });
    set({ scores: { ...state.scores, [tf]: tfScores } });
  },

  upsertScore: (row) => {
    const state = get();
    const tf = row.timeframe;
    const tfScores = { ...(state.scores[tf] || {}) };
    tfScores[row.symbol] = row;
    set({ scores: { ...state.scores, [tf]: tfScores } });
  },

  getAll: (tf) => Object.values(get().scores[tf] || {}),

  getScore: (symbol, tf) => get().scores[tf]?.[symbol] ?? null,

  getBullish: (tf) =>
    Object.values(get().scores[tf] || {}).filter((s) => s.trend === "bullish"),

  getBearish: (tf) =>
    Object.values(get().scores[tf] || {}).filter((s) => s.trend === "bearish"),
}));

// ── Load functions ──────────────────────────────────────

const TIMEFRAMES = ["15min", "30min", "1h", "4h", "1day"] as const;

export async function loadPairs() {
  const { data } = await supabase
    .from("pairs")
    .select("id, symbol, name, category")
    .eq("is_active", true);
  if (data) {
    useScoresStore.getState().setPairs(data);
  }
  return data ?? [];
}

export async function loadAllTimeframeScores() {
  const state = useScoresStore.getState();
  let pairMap = state.pairIdToSymbol;

  // Ensure pairs are loaded
  if (Object.keys(pairMap).length === 0) {
    await loadPairs();
    pairMap = useScoresStore.getState().pairIdToSymbol;
  }

  const results = await Promise.all(
    TIMEFRAMES.map((tf) =>
      supabase
        .from("scores")
        .select(
          "pair_id, timeframe, score, trend, ema_score, adx_score, rsi_score, macd_score, news_score, social_score, ema20, ema50, ema200, adx, rsi, macd_hist, scanned_at"
        )
        .eq("timeframe", tf)
        .order("scanned_at", { ascending: false })
        .limit(300)
    )
  );

  const store = useScoresStore.getState();
  results.forEach((result, i) => {
    const tf = TIMEFRAMES[i];
    const enriched: ScoreEntry[] = (result.data ?? [])
      .map((row) => ({
        ...row,
        symbol: pairMap[row.pair_id] ?? "",
        score: Number(row.score),
        ema_score: row.ema_score != null ? Number(row.ema_score) : null,
        adx_score: row.adx_score != null ? Number(row.adx_score) : null,
        rsi_score: row.rsi_score != null ? Number(row.rsi_score) : null,
        macd_score: row.macd_score != null ? Number(row.macd_score) : null,
        news_score: row.news_score != null ? Number(row.news_score) : null,
        social_score: row.social_score != null ? Number(row.social_score) : null,
        ema20: row.ema20 != null ? Number(row.ema20) : null,
        ema50: row.ema50 != null ? Number(row.ema50) : null,
        ema200: row.ema200 != null ? Number(row.ema200) : null,
        adx: row.adx != null ? Number(row.adx) : null,
        rsi: row.rsi != null ? Number(row.rsi) : null,
        macd_hist: row.macd_hist != null ? Number(row.macd_hist) : null,
      }))
      .filter((r) => r.symbol !== "");
    store.bulkLoadScores(enriched, tf);
  });

  // Set lastScanAt from the most recent score
  const allScores = store.getAll(store.activeTimeframe);
  if (allScores.length > 0) {
    const latest = allScores.reduce((a, b) =>
      new Date(a.scanned_at) > new Date(b.scanned_at) ? a : b
    );
    useScoresStore.setState({ lastScanAt: latest.scanned_at });
  }
}

export function subscribeToRealtimeScores() {
  const channels = TIMEFRAMES.map((tf) =>
    supabase
      .channel(`scores-rt-${tf}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scores",
          filter: `timeframe=eq.${tf}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (!row?.pair_id) return;
          const symbol = useScoresStore.getState().pairIdToSymbol[row.pair_id];
          if (!symbol) return;
          useScoresStore.getState().upsertScore({
            ...row,
            symbol,
            score: Number(row.score),
            ema_score: row.ema_score != null ? Number(row.ema_score) : null,
            adx_score: row.adx_score != null ? Number(row.adx_score) : null,
            rsi_score: row.rsi_score != null ? Number(row.rsi_score) : null,
            macd_score: row.macd_score != null ? Number(row.macd_score) : null,
            news_score: row.news_score != null ? Number(row.news_score) : null,
            social_score: row.social_score != null ? Number(row.social_score) : null,
            ema20: row.ema20 != null ? Number(row.ema20) : null,
            ema50: row.ema50 != null ? Number(row.ema50) : null,
            ema200: row.ema200 != null ? Number(row.ema200) : null,
            adx: row.adx != null ? Number(row.adx) : null,
            rsi: row.rsi != null ? Number(row.rsi) : null,
            macd_hist: row.macd_hist != null ? Number(row.macd_hist) : null,
          });
        }
      )
      .subscribe()
  );
  return () => channels.forEach((ch) => ch.unsubscribe());
}

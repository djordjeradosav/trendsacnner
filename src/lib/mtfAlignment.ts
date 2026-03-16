import { useScoresStore, type ScoreEntry } from "@/store/scoresStore";
import { supabase } from "@/integrations/supabase/client";

const MTF_TIMEFRAMES = ["5min", "30min", "1h", "4h"] as const;

export interface MTFAlignment {
  pairId: string;
  symbol: string;
  direction: "bullish" | "bearish" | "neutral";
  alignment: number; // 0.0 to 1.0
  alignmentScore: number; // 0-100
  label: "Perfect" | "Strong" | "Partial" | "Conflicting";
  bullCount: number;
  bearCount: number;
  scores: {
    s5m: ScoreEntry | null;
    s30m: ScoreEntry | null;
    s1h: ScoreEntry | null;
    s4h: ScoreEntry | null;
  };
  timeframesChecked: number;
}

export function calcMTFAlignment(pairId: string, symbol: string): MTFAlignment {
  const store = useScoresStore.getState();
  const s5m = store.getScore(pairId, "5min");
  const s30m = store.getScore(pairId, "30min");
  const s1h = store.getScore(pairId, "1h");
  const s4h = store.getScore(pairId, "4h");

  const all = [s5m, s30m, s1h, s4h];
  const valid = all.filter(Boolean) as ScoreEntry[];
  const trends = valid.map((s) => s.trend);

  const bullCount = trends.filter((t) => t === "bullish").length;
  const bearCount = trends.filter((t) => t === "bearish").length;

  const alignment = valid.length > 0 ? Math.max(bullCount, bearCount) / valid.length : 0;
  const direction: "bullish" | "bearish" | "neutral" =
    bullCount > bearCount ? "bullish" : bearCount > bullCount ? "bearish" : "neutral";

  const alignmentScore = Math.round(alignment * 100);

  const label: MTFAlignment["label"] =
    alignment === 1.0 ? "Perfect" :
    alignment >= 0.75 ? "Strong" :
    alignment >= 0.5 ? "Partial" : "Conflicting";

  return {
    pairId,
    symbol,
    direction,
    alignment,
    alignmentScore,
    label,
    bullCount,
    bearCount,
    scores: { s5m, s30m, s1h, s4h },
    timeframesChecked: valid.length,
  };
}

export function calcAllMTFAlignments(): MTFAlignment[] {
  const store = useScoresStore.getState();
  // Gather all unique pair_ids across all MTF timeframes
  const pairMap = new Map<string, string>(); // pairId -> symbol
  for (const tf of MTF_TIMEFRAMES) {
    const scores = store.getAll(tf);
    scores.forEach((s) => {
      if (!pairMap.has(s.pair_id)) pairMap.set(s.pair_id, s.symbol);
    });
  }

  return Array.from(pairMap.entries()).map(([pairId, symbol]) =>
    calcMTFAlignment(pairId, symbol)
  );
}

export async function persistMTFAlignments(alignments: MTFAlignment[]): Promise<void> {
  if (alignments.length === 0) return;

  const rows = alignments.map((a) => ({
    pair_id: a.pairId,
    symbol: a.symbol,
    direction: a.direction,
    alignment: a.alignment,
    alignment_score: a.alignmentScore,
    label: a.label,
    bull_count: a.bullCount,
    bear_count: a.bearCount,
    scores_5m: a.scores.s5m ? { score: a.scores.s5m.score, trend: a.scores.s5m.trend } : null,
    scores_30m: a.scores.s30m ? { score: a.scores.s30m.score, trend: a.scores.s30m.trend } : null,
    scores_1h: a.scores.s1h ? { score: a.scores.s1h.score, trend: a.scores.s1h.trend } : null,
    scores_4h: a.scores.s4h ? { score: a.scores.s4h.score, trend: a.scores.s4h.trend } : null,
    scanned_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("mtf_alignments").upsert(rows, { onConflict: "pair_id" });
  if (error) console.warn("Failed to persist MTF alignments:", error.message);
}

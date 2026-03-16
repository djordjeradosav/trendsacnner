import { useState, useEffect, useRef } from "react";
import { useScoresStore, type ScoreEntry } from "@/store/scoresStore";

/**
 * Returns the current score for a pair_id from the global store,
 * plus a flash direction ('up'|'down'|null) when the score changes.
 * Flash resets after 600ms.
 */
export function useScoreChange(pairId: string, timeframe?: string) {
  const score = useScoresStore((s) => s.getScore(pairId, timeframe));
  const prevRef = useRef<number | undefined>(score?.score);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const prev = prevRef.current;
    if (prev !== undefined && score && score.score !== prev) {
      setFlash(score.score > prev ? "up" : "down");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setFlash(null), 600);
    }
    prevRef.current = score?.score;
  }, [score?.score]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { score, flash };
}

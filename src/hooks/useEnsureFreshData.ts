import { useEffect } from "react";
import { useScoresStore, loadAllTimeframeScores } from "@/stores/useScoresStore";

/**
 * Ensures the Zustand store has fresh score data.
 * If data is empty or older than 20 minutes, reloads from DB.
 */
export function useEnsureFreshData() {
  const lastScanAt = useScoresStore((s) => s.lastScanAt);

  useEffect(() => {
    const age = lastScanAt
      ? Date.now() - new Date(lastScanAt).getTime()
      : Infinity;

    if (age > 20 * 60 * 1000) {
      loadAllTimeframeScores();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

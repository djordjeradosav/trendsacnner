import { useState, useEffect, useCallback } from "react";
import { tickFeed, isLiveEligible, type WsStatus } from "@/services/tickFeedService";

/**
 * Manages the tick feed lifecycle based on the active timeframe.
 * Returns current WS status and pair count for the header indicator.
 */
export function useTickFeedStatus(timeframe: string) {
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [pairCount, setPairCount] = useState(0);

  useEffect(() => {
    const unsub = tickFeed.onStatus((s, count) => {
      setStatus(s);
      setPairCount(count);
    });
    return unsub;
  }, []);

  // Start/stop feed when timeframe changes
  useEffect(() => {
    tickFeed.start(timeframe);
    return () => {
      // Don't stop on cleanup — let the singleton persist across re-renders.
      // It will be restarted with the new timeframe.
    };
  }, [timeframe]);

  const reconnect = useCallback(() => {
    tickFeed.reconnect();
  }, []);

  const isEligible = isLiveEligible(timeframe);

  return { status, pairCount, reconnect, isEligible };
}

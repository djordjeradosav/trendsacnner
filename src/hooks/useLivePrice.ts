import { useState, useEffect, useRef } from "react";
import { tickFeed } from "@/services/tickFeedService";

export interface LivePriceState {
  price: number | null;
  direction: "up" | "down" | null;
}

/**
 * Subscribe to live price ticks for a symbol.
 * Returns the latest price and a flash direction (up/down) that resets after 800ms.
 */
export function useLivePrice(symbol: string | undefined): LivePriceState {
  const [price, setPrice] = useState<number | null>(null);
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!symbol) return;

    // Seed with existing live price if available
    const existing = tickFeed.getLivePrice(symbol);
    if (existing !== null) {
      setPrice(existing);
      prevPriceRef.current = existing;
    }

    const unsub = tickFeed.subscribe(symbol, (newPrice) => {
      const prev = prevPriceRef.current;
      if (prev !== null) {
        const diff = newPrice - prev;
        if (diff > 0) setDirection("up");
        else if (diff < 0) setDirection("down");

        // Clear direction after 800ms
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setDirection(null), 800);
      }
      prevPriceRef.current = newPrice;
      setPrice(newPrice);
    });

    return () => {
      unsub();
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [symbol]);

  return { price, direction };
}

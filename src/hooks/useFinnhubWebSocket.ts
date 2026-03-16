import { useEffect, useRef, useState, useCallback } from "react";
import { finnhubWS, type TickHandler } from "@/services/finnhubWebSocket";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that manages the Finnhub WebSocket connection lifecycle.
 * Call once at the app level (e.g., in AppLayout or Index).
 */
export function useFinnhubWebSocket() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let checkerInterval: ReturnType<typeof setInterval> | null = null;

    async function init() {
      try {
        // Only fetch token if not already connected
        if (finnhubWS.isConnected) {
          setIsConnected(true);
          return;
        }

        const { data, error } = await supabase.functions.invoke("get-finnhub-token");
        if (error || !data?.token) {
          console.warn("Failed to get Finnhub token:", error?.message || "No token returned");
          return;
        }
        finnhubWS.connect(data.token);
      } catch (err) {
        console.error("Finnhub WS init error:", err);
      }
    }

    init();

    // Check connection status periodically
    checkerInterval = setInterval(() => {
      setIsConnected(finnhubWS.isConnected);
    }, 2000);

    return () => {
      if (checkerInterval) clearInterval(checkerInterval);
      // Don't disconnect on unmount — singleton stays alive for the app lifetime
    };
  }, []);

  return { isConnected };
}

/**
 * Hook to subscribe to live price ticks for specific symbols.
 * Returns a map of symbol → latest price.
 */
export function useLivePrices(symbols: string[]) {
  const [prices, setPrices] = useState<Map<string, { price: number; change: number | null }>>(new Map());
  const basePrices = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (symbols.length === 0) return;

    finnhubWS.subscribe(symbols);

    const unsubscribe = finnhubWS.onTick((symbol, price) => {
      if (!symbols.includes(symbol)) return;

      if (!basePrices.current.has(symbol)) {
        basePrices.current.set(symbol, price);
      }

      const base = basePrices.current.get(symbol)!;
      const changePct = base !== 0 ? ((price - base) / base) * 100 : 0;

      setPrices((prev) => {
        const next = new Map(prev);
        next.set(symbol, { price, change: changePct });
        return next;
      });
    });

    return () => {
      unsubscribe();
      finnhubWS.unsubscribe(symbols);
    };
  }, [symbols.join(",")]);

  return prices;
}

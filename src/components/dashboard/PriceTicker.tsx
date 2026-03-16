import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { finnhubWS } from "@/services/finnhubWebSocket";

const TICKER_SYMBOLS = [
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD",
  "USDCHF", "EURGBP", "XAUUSD", "ES1!", "NQ1!",
];

interface TickerItem {
  symbol: string;
  price: number | null;
  change: number | null;
}

export function PriceTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const basePrices = useRef<Map<string, number>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial prices from candles, then subscribe to WebSocket
  useEffect(() => {
    async function loadInitial() {
      const { data: pairs } = await supabase
        .from("pairs")
        .select("id, symbol")
        .eq("is_active", true);

      if (!pairs) return;

      const tickerPairs = pairs.filter((p) => TICKER_SYMBOLS.includes(p.symbol));
      const results: TickerItem[] = [];

      for (const pair of tickerPairs) {
        const { data: candles } = await supabase
          .from("candles")
          .select("close, open")
          .eq("pair_id", pair.id)
          .eq("timeframe", "1h")
          .order("ts", { ascending: false })
          .limit(2);

        if (candles && candles.length >= 1) {
          const current = Number(candles[0].close);
          const prev = candles.length >= 2 ? Number(candles[1].close) : Number(candles[0].open);
          const changePct = prev !== 0 ? ((current - prev) / prev) * 100 : 0;
          basePrices.current.set(pair.symbol, prev);
          results.push({ symbol: pair.symbol, price: current, change: changePct });
        } else {
          results.push({ symbol: pair.symbol, price: null, change: null });
        }
      }

      setItems(results);

      // Subscribe to WebSocket for live updates
      finnhubWS.subscribe(TICKER_SYMBOLS);
    }

    loadInitial();

    // Listen for live ticks
    const unsubscribe = finnhubWS.onTick((symbol, price) => {
      if (!TICKER_SYMBOLS.includes(symbol)) return;

      setItems((prev) =>
        prev.map((item) => {
          if (item.symbol !== symbol) return item;
          const base = basePrices.current.get(symbol) ?? price;
          const changePct = base !== 0 ? ((price - base) / base) * 100 : 0;
          return { ...item, price, change: changePct };
        })
      );
    });

    return () => {
      unsubscribe();
      finnhubWS.unsubscribe(TICKER_SYMBOLS);
    };
  }, []);

  // Auto-scroll animation
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let animId: number;
    let pos = 0;

    function step() {
      pos += 0.5;
      if (el && pos >= el.scrollWidth / 2) pos = 0;
      if (el) el.scrollLeft = pos;
      animId = requestAnimationFrame(step);
    }

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="h-8 rounded-md bg-card border border-border/50 flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground font-mono animate-pulse">Loading prices…</span>
      </div>
    );
  }

  const doubled = [...items, ...items];

  return (
    <div
      className="h-8 rounded-md bg-card border border-border/50 overflow-hidden relative"
      onMouseEnter={() => {
        if (scrollRef.current) scrollRef.current.dataset.paused = "true";
      }}
      onMouseLeave={() => {
        if (scrollRef.current) scrollRef.current.dataset.paused = "false";
      }}
    >
      <div
        ref={scrollRef}
        className="flex items-center h-full gap-6 px-3 overflow-x-hidden whitespace-nowrap"
      >
        {doubled.map((item, i) => {
          const isUp = (item.change ?? 0) > 0;
          const isDown = (item.change ?? 0) < 0;

          return (
            <div key={`${item.symbol}-${i}`} className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-display font-semibold text-foreground">
                {formatSymbolDisplay(item.symbol)}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {item.price != null ? formatPrice(item.symbol, item.price) : "—"}
              </span>
              {item.change != null && (
                <span className={`flex items-center gap-0.5 text-[10px] font-mono ${isUp ? "text-[hsl(var(--primary))]" : isDown ? "text-destructive" : "text-muted-foreground"}`}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {isUp ? "+" : ""}{item.change.toFixed(2)}%
                </span>
              )}
              {i < doubled.length - 1 && (
                <span className="text-border ml-2">•</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatSymbolDisplay(symbol: string): string {
  // Format for display: EURUSD -> EUR/USD, ES1! -> S&P 500
  const displayNames: Record<string, string> = {
    "ES1!": "S&P 500", "NQ1!": "Nasdaq", "YM1!": "Dow 30",
    "US500": "S&P 500", "US100": "Nasdaq", "US30": "Dow 30",
    "USOIL": "WTI Oil", "UKOIL": "Brent Oil", "NATGAS": "Nat Gas",
  };
  if (displayNames[symbol]) return displayNames[symbol];
  if (symbol.length === 6 && !symbol.includes("!")) {
    return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  }
  return symbol;
}

function formatPrice(symbol: string, price: number): string {
  if (symbol.includes("JPY")) return price.toFixed(3);
  if (symbol.startsWith("XAU") || symbol.startsWith("ES") || symbol.startsWith("NQ") || symbol.startsWith("YM")) return price.toFixed(2);
  return price.toFixed(5);
}

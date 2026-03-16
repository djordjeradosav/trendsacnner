import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const TICKER_SYMBOLS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "NZD/USD",
  "USD/CHF", "EUR/GBP", "XAU/USD", "US30", "US100", "USD/MXN",
];

interface TickerItem {
  symbol: string;
  price: number | null;
  change: number | null;
}

export function PriceTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      // Get latest candle close for each ticker symbol by fetching pairs + latest candle
      const { data: pairs } = await supabase
        .from("pairs")
        .select("id, symbol")
        .eq("is_active", true);

      if (!pairs) return;

      const tickerPairs = pairs.filter((p) =>
        TICKER_SYMBOLS.includes(p.symbol)
      );

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
          results.push({ symbol: pair.symbol, price: current, change: changePct });
        } else {
          results.push({ symbol: pair.symbol, price: null, change: null });
        }
      }

      setItems(results);
    }

    load();
    const interval = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(interval);
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

  const doubled = [...items, ...items]; // duplicate for infinite scroll

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
                {item.symbol}
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

function formatPrice(symbol: string, price: number): string {
  if (symbol.includes("JPY")) return price.toFixed(3);
  if (symbol.startsWith("XAU") || symbol.startsWith("US")) return price.toFixed(2);
  return price.toFixed(5);
}

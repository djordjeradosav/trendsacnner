import { useMemo, useEffect, useState } from "react";
import { Sparkles, Search, TrendingUp, TrendingDown, Minus, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAllScores } from "@/hooks/useScores";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

const CATEGORIES = ["All", "Forex", "Futures", "Commodity"] as const;

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "bullish") return <TrendingUp className="w-3.5 h-3.5 text-bullish" />;
  if (trend === "bearish") return <TrendingDown className="w-3.5 h-3.5 text-bearish" />;
  return <Minus className="w-3.5 h-3.5 text-neutral-tone" />;
}

function MacroDeskCard({ symbol, score, trend, rsi, adx, ema20, ema50, scannedAt, onClick }: {
  symbol: string; score: number; trend: string;
  rsi: number | null; adx: number | null;
  ema20: number | null; ema50: number | null;
  scannedAt: string | null; onClick: () => void;
}) {
  const trendColor = trend === "bullish" ? "hsl(var(--bullish))" : trend === "bearish" ? "hsl(var(--bearish))" : "hsl(var(--muted-foreground))";
  const trendBg = trend === "bullish" ? "hsl(var(--bullish) / 0.12)" : trend === "bearish" ? "hsl(var(--bearish) / 0.12)" : "hsl(var(--accent))";
  const barColor = score > 65 ? "hsl(var(--bullish))" : score < 35 ? "hsl(var(--bearish))" : "hsl(var(--chart-4))";

  const rsiColor = rsi == null ? "hsl(var(--muted-foreground))"
    : rsi > 70 ? "hsl(var(--bearish))"
    : rsi < 30 ? "hsl(var(--bullish))"
    : "hsl(var(--muted-foreground))";

  const adxLabel = adx == null ? "—" : adx > 25 ? "Strong" : "Weak";
  const adxColor = adx != null && adx > 25 ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))";

  const emaLabel = ema20 == null || ema50 == null ? "—"
    : ema20 > ema50 ? "↑ Bull" : "↓ Bear";
  const emaColor = emaLabel.includes("↑") ? "hsl(var(--bullish))" : emaLabel.includes("↓") ? "hsl(var(--bearish))" : "hsl(var(--muted-foreground))";

  return (
    <div
      onClick={onClick}
      className="group rounded-xl p-3 transition-all cursor-pointer bg-secondary/80 border border-border/40 hover:border-ring hover:bg-secondary hover:shadow-lg"
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendIcon trend={trend} />
          <div>
            <span className="text-sm font-display font-bold text-foreground">{symbol}</span>
            <div className="text-[9px] font-mono text-muted-foreground">{timeAgo(scannedAt)}</div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xl font-display font-bold tabular-nums" style={{ color: trendColor }}>{Math.round(score)}</span>
          <span className="text-[9px] font-display font-semibold px-1.5 py-0.5 rounded-md" style={{ background: trendBg, color: trendColor }}>
            {(trend ?? "neutral").toUpperCase()}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-[3px] rounded-full bg-border/60 overflow-hidden mb-3">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(score, 100)}%`, background: barColor }} />
      </div>

      {/* Indicators grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md bg-background/50 px-2 py-1.5 text-center">
          <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">RSI</div>
          <div className="text-[12px] font-mono font-bold" style={{ color: rsiColor }}>{rsi?.toFixed(0) ?? "—"}</div>
        </div>
        <div className="rounded-md bg-background/50 px-2 py-1.5 text-center">
          <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">ADX</div>
          <div className="text-[12px] font-mono font-bold" style={{ color: adxColor }}>{adx?.toFixed(0) ?? "—"}</div>
        </div>
        <div className="rounded-md bg-background/50 px-2 py-1.5 text-center">
          <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">EMA</div>
          <div className="text-[12px] font-mono font-bold" style={{ color: emaColor }}>{emaLabel}</div>
        </div>
      </div>
    </div>
  );
}

export function AIMacroDesk({ timeframe }: { timeframe: string }) {
  const navigate = useNavigate();
  const { data: allScores } = useAllScores(timeframe);
  const [pairMap, setPairMap] = useState<Record<string, { symbol: string; category: string; base: string; quote: string }>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("All");

  useEffect(() => {
    supabase
      .from("pairs")
      .select("id, symbol, category, base_currency, quote_currency")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, { symbol: string; category: string; base: string; quote: string }> = {};
          data.forEach((p) => {
            map[p.id] = { symbol: p.symbol, category: p.category, base: p.base_currency ?? "", quote: p.quote_currency ?? "" };
          });
          setPairMap(map);
        }
      });
  }, []);

  const EXOTIC_CURRENCIES = new Set([
    "SEK","NOK","DKK","SGD","HKD","ZAR","MXN","TRY",
    "PLN","HUF","CZK","CNH","THB","ILS","TWD",
  ]);

  const topPairs = useMemo(() => {
    if (!allScores?.length || !Object.keys(pairMap).length) return [];
    return [...allScores]
      .filter((s) => {
        if (s.score == null || !pairMap[s.pair_id]) return false;
        const cat = pairMap[s.pair_id];
        if (!cat) return false;
        if (cat.category === "forex") {
          const base = cat.base.toUpperCase();
          const quote = cat.quote.toUpperCase();
          if (EXOTIC_CURRENCIES.has(base) || EXOTIC_CURRENCIES.has(quote)) return false;
        }
        // Category filter
        if (category !== "All" && cat.category.toLowerCase() !== category.toLowerCase()) return false;
        // Search filter
        if (search) {
          const q = search.toLowerCase();
          if (!cat.symbol.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
      .slice(0, 12);
  }, [allScores, pairMap, category, search]);

  const hasScores = allScores && allScores.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-bullish" />
          <span className="font-bold text-sm text-foreground font-display">AI Macro Desk</span>
        </div>
        <button onClick={() => navigate("/scanner")} className="font-display transition-opacity hover:opacity-80 text-xs text-bullish">
          View All →
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search pair..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs font-mono bg-background/50 border-border/50"
          />
        </div>
        <div className="flex items-center gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-2 py-1 rounded-md text-[10px] font-display font-semibold transition-colors ${
                category === c
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {!hasScores
            ? Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="anim-fade-up rounded-xl overflow-hidden" style={{ animationDelay: `${200 + idx * 50}ms`, height: "140px" }}>
                  <div className="anim-shimmer w-full h-full rounded-xl" />
                </div>
              ))
            : topPairs.map((score, idx) => {
                const info = pairMap[score.pair_id];
                const symbol = info?.symbol ?? "???";
                return (
                  <div key={score.pair_id} className="anim-fade-up" style={{ animationDelay: `${100 + idx * 40}ms` }}>
                    <MacroDeskCard
                      symbol={symbol}
                      score={score.score}
                      trend={score.trend}
                      rsi={score.rsi ?? null}
                      adx={score.adx ?? null}
                      ema20={score.ema20 ?? null}
                      ema50={score.ema50 ?? null}
                      scannedAt={score.scanned_at ?? null}
                      onClick={() => navigate(`/pair/${symbol}`)}
                    />
                  </div>
                );
              })}
          {hasScores && topPairs.length === 0 && (
            <div className="col-span-2 py-8 text-center text-sm text-muted-foreground font-mono">
              No pairs match your filters
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

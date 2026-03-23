import { useMemo, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAllScores } from "@/hooks/useScores";
import { supabase } from "@/integrations/supabase/client";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function MacroDeskCard({ symbol, score, trend, rsi, adx, ema20, ema50, scannedAt, onClick }: {
  symbol: string; score: number; trend: string;
  rsi: number | null; adx: number | null;
  ema20: number | null; ema50: number | null;
  scannedAt: string | null; onClick: () => void;
}) {
  const rsiColor = rsi == null ? "hsl(var(--muted-foreground))"
    : rsi > 70 ? "hsl(var(--bearish))"
    : rsi < 30 ? "hsl(var(--bullish))"
    : "hsl(var(--muted-foreground))";

  const adxLabel = adx == null ? "—" : adx > 25 ? "Trending" : "Ranging";
  const adxColor = adx != null && adx > 25 ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))";

  const emaLabel = ema20 == null || ema50 == null ? "—"
    : ema20 > ema50 ? "↑ Aligned" : "↓ Inverse";
  const emaColor = emaLabel.includes("↑") ? "hsl(var(--bullish))" : emaLabel.includes("↓") ? "hsl(var(--bearish))" : "hsl(var(--muted-foreground))";

  const trendColor = trend === "bullish" ? "hsl(var(--bullish))" : trend === "bearish" ? "hsl(var(--bearish))" : "hsl(var(--muted-foreground))";
  const trendBg = trend === "bullish" ? "hsl(var(--bullish) / 0.1)" : trend === "bearish" ? "hsl(var(--bearish) / 0.1)" : "hsl(var(--accent))";

  const barColor = score > 65 ? "hsl(var(--bullish))" : score < 35 ? "hsl(var(--bearish))" : "hsl(var(--chart-4))";

  return (
    <div
      onClick={onClick}
      className="rounded-lg p-3 transition-colors cursor-pointer bg-secondary border border-border/50 hover:border-ring"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-[15px] font-display font-bold text-foreground">{symbol}</span>
          <div className="text-[9px] font-mono text-muted-foreground mt-0.5">Scanned {timeAgo(scannedAt)}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-lg font-display font-bold tabular-nums" style={{ color: trendColor }}>{Math.round(score)}</span>
          <span className="text-[10px] font-display px-1.5 py-0.5 rounded" style={{ background: trendBg, color: trendColor }}>
            {(trend ?? "neutral").toUpperCase()}
          </span>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
        <span>Confidence</span>
        <span>{Math.round(score)}%</span>
      </div>
      <div className="h-[3px] rounded-full bg-border overflow-hidden mb-2.5">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(score, 100)}%`, background: barColor }} />
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
        <div>
          <div className="text-[9px] text-muted-foreground mb-0.5">RSI</div>
          <div className="font-mono font-medium" style={{ color: rsiColor }}>{rsi?.toFixed(1) ?? "—"}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground mb-0.5">ADX</div>
          <div className="font-mono font-medium" style={{ color: adxColor }}>{adx?.toFixed(1) ?? "—"}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground mb-0.5">EMA</div>
          <div className="font-mono font-medium" style={{ color: emaColor }}>{emaLabel}</div>
        </div>
      </div>
    </div>
  );
}

export function AIMacroDesk({ timeframe }: { timeframe: string }) {
  const navigate = useNavigate();
  const { data: allScores } = useAllScores(timeframe);
  const [pairMap, setPairMap] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from("pairs")
      .select("id, symbol")
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((p) => { map[p.id] = p.symbol; });
          setPairMap(map);
        }
      });
  }, []);

  // Pick top 8 most trending pairs (highest deviation from 50)
  const topPairs = useMemo(() => {
    if (!allScores?.length || !Object.keys(pairMap).length) return [];
    return [...allScores]
      .filter((s) => s.score != null && pairMap[s.pair_id])
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
      .slice(0, 8);
  }, [allScores, pairMap]);

  const hasScores = allScores && allScores.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-bullish" />
            <span className="font-semibold text-sm text-foreground">AI Macro Desk</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Top trending pairs</p>
        </div>
        <button onClick={() => navigate("/scanner")} className="font-display transition-opacity hover:opacity-80 text-xs text-bullish">
          View All →
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-2">
        {!hasScores
          ? Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="anim-fade-up rounded-lg overflow-hidden" style={{ animationDelay: `${200 + idx * 50}ms`, height: "160px" }}>
                <div className="anim-shimmer w-full h-full rounded-lg" />
              </div>
            ))
          : topPairs.map((score, idx) => {
              const symbol = pairMap[score.pair_id] ?? "???";
              return (
                <div key={score.pair_id} className="anim-fade-up" style={{ animationDelay: `${200 + idx * 50}ms` }}>
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
      </div>
    </div>
  );
}

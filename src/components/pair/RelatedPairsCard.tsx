import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface RelatedScore {
  symbol: string;
  score: number;
  trend: string;
}

interface Props {
  symbol: string;
  pairId: string;
  timeframe: string;
}

export function RelatedPairsCard({ symbol, pairId, timeframe }: Props) {
  const navigate = useNavigate();
  const [related, setRelated] = useState<RelatedScore[]>([]);

  const base = symbol.slice(0, 3);
  const quote = symbol.slice(3, 6);

  useEffect(() => {
    async function load() {
      // Get all pairs that share base or quote currency
      const { data: pairs } = await supabase
        .from("pairs")
        .select("id, symbol")
        .neq("id", pairId)
        .eq("is_active", true);

      if (!pairs?.length) return;

      const matching = pairs.filter(
        (p) =>
          p.symbol.startsWith(base) ||
          p.symbol.endsWith(base) ||
          p.symbol.startsWith(quote) ||
          p.symbol.endsWith(quote)
      );

      if (!matching.length) return;

      // Get latest score for each
      const results: RelatedScore[] = [];
      const ids = matching.map((p) => p.id);

      const { data: scores } = await supabase
        .from("scores")
        .select("pair_id, score, trend, scanned_at")
        .in("pair_id", ids)
        .eq("timeframe", timeframe)
        .order("scanned_at", { ascending: false });

      if (!scores?.length) return;

      // Deduplicate: latest per pair
      const seen = new Set<string>();
      scores.forEach((s) => {
        if (seen.has(s.pair_id)) return;
        seen.add(s.pair_id);
        const p = matching.find((m) => m.id === s.pair_id);
        if (p) results.push({ symbol: p.symbol, score: Number(s.score), trend: s.trend });
      });

      results.sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
      setRelated(results.slice(0, 6));
    }
    load();
  }, [symbol, pairId, timeframe, base, quote]);

  if (related.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-display font-semibold text-foreground mb-3">Related Pairs</h3>
      <div className="space-y-2">
        {related.map((r) => {
          const color = r.trend === "bullish" ? "text-bullish" : r.trend === "bearish" ? "text-bearish" : "text-neutral-tone";
          const barColor = r.trend === "bullish" ? "bg-bullish" : r.trend === "bearish" ? "bg-bearish" : "bg-neutral-tone";
          return (
            <button
              key={r.symbol}
              onClick={() => navigate(`/pair/${r.symbol}`)}
              className="w-full flex items-center gap-3 py-1.5 hover:bg-accent/30 rounded px-1 transition-colors"
            >
              <span className="text-xs font-display font-semibold text-foreground w-16">{r.symbol}</span>
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${r.score}%` }} />
              </div>
              <span className={`text-xs font-mono font-bold ${color} w-8 text-right`}>{r.score.toFixed(0)}</span>
              <span className={`text-[10px] ${color}`}>
                {r.trend === "bullish" ? "↑" : r.trend === "bearish" ? "↓" : "→"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

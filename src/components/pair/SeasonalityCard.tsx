import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface SeasonalStat {
  up_pct: number | null;
  avg_return: number | null;
  best_return: number | null;
  worst_return: number | null;
  best_year: number | null;
  worst_year: number | null;
  total_years: number;
  bias: string | null;
}

interface Props {
  symbol: string;
}

export function SeasonalityCard({ symbol }: Props) {
  const navigate = useNavigate();
  const [stat, setStat] = useState<SeasonalStat | null>(null);
  const [loading, setLoading] = useState(true);
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    supabase
      .from("seasonality_stats")
      .select("up_pct, avg_return, best_return, worst_return, best_year, worst_year, total_years, bias")
      .eq("symbol", symbol)
      .eq("month_number", currentMonth)
      .limit(1)
      .then(({ data }) => {
        setStat(data?.[0] ?? null);
        setLoading(false);
      });
  }, [symbol, currentMonth]);

  if (loading) return null;

  const upPct = stat?.up_pct ?? 0;
  const barColor = upPct >= 60 ? "bg-bullish" : upPct <= 40 ? "bg-bearish" : "bg-neutral-tone";
  const biasColor = stat?.bias === "bullish" ? "text-bullish" : stat?.bias === "bearish" ? "text-bearish" : "text-neutral-tone";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-sm font-display font-semibold text-foreground">Seasonality</h3>
      </div>

      {!stat ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-2">No seasonality data</p>
          <button
            onClick={() => navigate(`/seasonality?pair=${symbol}`)}
            className="text-[11px] font-display text-bullish hover:opacity-80 transition-opacity"
          >
            View seasonality →
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-1">
            {MONTH_NAMES[currentMonth]} seasonality
          </p>
          <p className={`text-sm font-display font-semibold ${biasColor} mb-1`}>
            {stat.bias === "bullish" ? "Bullish" : stat.bias === "bearish" ? "Bearish" : "Neutral"} {upPct.toFixed(0)}% of the time
          </p>
          <p className="text-[10px] text-muted-foreground mb-3">
            Based on {stat.total_years} years of data
          </p>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${upPct}%` }} />
          </div>

          <div className="space-y-1 text-[11px] font-mono text-muted-foreground">
            <div className="flex justify-between">
              <span>Avg return</span>
              <span className={`${(stat.avg_return ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                {(stat.avg_return ?? 0) >= 0 ? "+" : ""}{(stat.avg_return ?? 0).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Best</span>
              <span className="text-bullish">+{(stat.best_return ?? 0).toFixed(1)}% ({stat.best_year})</span>
            </div>
            <div className="flex justify-between">
              <span>Worst</span>
              <span className="text-bearish">{(stat.worst_return ?? 0).toFixed(1)}% ({stat.worst_year})</span>
            </div>
          </div>

          <button
            onClick={() => navigate(`/seasonality?pair=${symbol}`)}
            className="mt-3 text-[11px] font-display text-bullish hover:opacity-80 transition-opacity"
          >
            View full seasonality →
          </button>
        </>
      )}
    </div>
  );
}

import { TrendingUp, TrendingDown, Minus, BarChart3, Percent } from "lucide-react";
import { TradingPair, getTrend } from "@/data/mockPairs";

interface StatCardsProps {
  pairs: TradingPair[];
}

export function StatCards({ pairs }: StatCardsProps) {
  const total = pairs.length;
  const bullish = pairs.filter(p => p.score >= 65).length;
  const bearish = pairs.filter(p => p.score <= 35).length;
  const neutralCount = total - bullish - bearish;
  const avgScore = total > 0 ? Math.round(pairs.reduce((s, p) => s + p.score, 0) / total) : 0;

  const pctBullish = total > 0 ? Math.round((bullish / total) * 100) : 0;
  const pctNeutral = total > 0 ? Math.round((neutralCount / total) * 100) : 0;
  const pctBearish = total > 0 ? Math.round((bearish / total) * 100) : 0;

  const stats = [
    { label: "Total Pairs", value: total, icon: BarChart3, colorClass: "text-foreground" },
    { label: "Bullish", value: `${pctBullish}%`, icon: TrendingUp, colorClass: "text-bullish" },
    { label: "Neutral", value: `${pctNeutral}%`, icon: Minus, colorClass: "text-neutral" },
    { label: "Bearish", value: `${pctBearish}%`, icon: TrendingDown, colorClass: "text-bearish" },
    { label: "Avg Score", value: avgScore, icon: Percent, colorClass: avgScore >= 65 ? "text-bullish" : avgScore <= 35 ? "text-bearish" : "text-neutral" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-border bg-card p-4 flex flex-col gap-1"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
            <stat.icon className="w-3.5 h-3.5" />
            {stat.label}
          </div>
          <div className={`text-2xl font-bold font-display ${stat.colorClass}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

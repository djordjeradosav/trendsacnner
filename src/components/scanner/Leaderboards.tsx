import { TradingPair, getScoreChange } from "@/data/mockPairs";
import { TrendingUp, TrendingDown } from "lucide-react";

interface LeaderboardsProps {
  pairs: TradingPair[];
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 65 ? "bg-bullish" : score <= 35 ? "bg-bearish" : "bg-neutral";
  return (
    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  if (change === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = change > 0;
  return (
    <span className={`text-xs font-display font-medium ${positive ? "text-bullish" : "text-bearish"}`}>
      {positive ? `↑+${change}` : `↓${change}`}
    </span>
  );
}

export function Leaderboards({ pairs }: LeaderboardsProps) {
  const strongest = [...pairs].sort((a, b) => b.score - a.score).slice(0, 8);
  const weakest = [...pairs].sort((a, b) => a.score - b.score).slice(0, 8);

  const renderRows = (list: TradingPair[]) =>
    list.map((pair, i) => (
      <div
        key={pair.symbol}
        className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-accent/50 transition-colors"
      >
        <span className="text-xs font-display text-muted-foreground w-5 text-right">{i + 1}</span>
        <span className="text-sm font-bold font-display text-foreground flex-1 truncate">{pair.symbol}</span>
        <ScoreBar score={pair.score} />
        <span className={`text-sm font-display font-bold w-8 text-right ${pair.score >= 65 ? "text-bullish" : pair.score <= 35 ? "text-bearish" : "text-neutral"}`}>
          {pair.score}
        </span>
        <div className="w-10 text-right">
          <ChangeIndicator change={getScoreChange(pair)} />
        </div>
      </div>
    ));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-bullish" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Strongest Trends</h3>
        </div>
        <div className="space-y-0.5">{renderRows(strongest)}</div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-4 h-4 text-bearish" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Weakest Pairs</h3>
        </div>
        <div className="space-y-0.5">{renderRows(weakest)}</div>
      </div>
    </div>
  );
}

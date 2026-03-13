import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { TradingPair, getTrend, getTrendArrow } from "@/data/mockPairs";

function getScoreStyles(score: number) {
  if (score >= 80) return "bg-[hsl(var(--score-strong-bg))] border-[hsl(var(--score-strong-border))] hover:border-bullish";
  if (score >= 65) return "bg-[hsl(var(--score-bullish-bg))] border-[hsl(var(--score-bullish-border))] hover:border-bullish";
  if (score >= 50) return "bg-[hsl(var(--score-neutral-bg))] border-[hsl(var(--score-neutral-border))] hover:border-muted-foreground";
  if (score >= 36) return "bg-[hsl(var(--score-weak-bg))] border-[hsl(var(--score-weak-border))] hover:border-bearish";
  return "bg-[hsl(var(--score-bearish-bg))] border-[hsl(var(--score-bearish-border))] hover:border-bearish";
}

function getScoreColor(score: number) {
  if (score >= 65) return "text-bullish";
  if (score >= 36) return "text-neutral";
  return "text-bearish";
}

interface HeatmapGridProps {
  pairs: TradingPair[];
}

export function HeatmapGrid({ pairs }: HeatmapGridProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
      {pairs.map((pair, i) => (
        <motion.button
          key={pair.symbol}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.02, duration: 0.2 }}
          onClick={() => navigate(`/pair/${pair.symbol}`)}
          title={pair.fullName}
          className={`group relative rounded-lg border p-3 text-left transition-all duration-200 cursor-pointer hover:scale-[1.04] ${getScoreStyles(pair.score)}`}
          style={{ minHeight: "90px" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold font-display text-foreground truncate">
              {pair.symbol}
            </span>
            <span className={`text-lg ${getScoreColor(pair.score)}`}>
              {getTrendArrow(pair.score)}
            </span>
          </div>
          <div className={`text-2xl font-bold font-display mt-1 ${getScoreColor(pair.score)}`}>
            {pair.score}
          </div>
          <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded-full bg-background/30 text-muted-foreground font-medium">
            {pair.category}
          </span>
          {/* Tooltip on hover */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border rounded px-2 py-1 text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
            {pair.fullName}
          </div>
        </motion.button>
      ))}
    </div>
  );
}

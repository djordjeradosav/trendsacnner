import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import type { SectorStat, MarketSentiment } from "@/hooks/useSectorStats";

interface MarketSentimentBarProps {
  sentiment: MarketSentiment;
}

export function MarketSentimentBar({ sentiment }: MarketSentimentBarProps) {
  const overallLabel =
    sentiment.overallTrend === "bullish"
      ? "Broadly Bullish"
      : sentiment.overallTrend === "bearish"
        ? "Broadly Bearish"
        : "Mixed / Neutral";

  return (
    <div className="rounded-lg border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-display font-semibold text-foreground">Market Pulse</span>
          <span className="text-xs text-muted-foreground font-body">— {sentiment.totalPairs} pairs —</span>
          <span
            className={`text-xs font-display font-bold px-2 py-0.5 rounded-md border ${
              sentiment.overallTrend === "bullish"
                ? "bg-bullish/15 text-bullish border-bullish/30"
                : sentiment.overallTrend === "bearish"
                  ? "bg-bearish/15 text-bearish border-bearish/30"
                  : "bg-muted text-neutral-tone border-border"
            }`}
          >
            {overallLabel}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-display">
          <span className="text-bullish">{sentiment.bullishPct}% Bull</span>
          <span className="text-neutral-tone">{sentiment.neutralPct}% Neutral</span>
          <span className="text-bearish">{sentiment.bearishPct}% Bear</span>
        </div>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden flex">
        <div
          className="h-full bg-bullish transition-all duration-700 ease-out"
          style={{ width: `${sentiment.bullishPct}%` }}
        />
        <div
          className="h-full bg-neutral-tone transition-all duration-700 ease-out delay-100"
          style={{ width: `${sentiment.neutralPct}%` }}
        />
        <div
          className="h-full bg-bearish transition-all duration-700 ease-out delay-200"
          style={{ width: `${sentiment.bearishPct}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground font-body mt-2.5 leading-relaxed">{sentiment.summary}</p>
    </div>
  );
}

interface SectorCardsProps {
  sectors: SectorStat[];
}

function MiniDonut({ bull, neutral, bear }: { bull: number; neutral: number; bear: number }) {
  const total = bull + neutral + bear;
  if (total === 0) return null;
  const bullPct = (bull / total) * 100;
  const neutralPct = (neutral / total) * 100;
  const bearPct = (bear / total) * 100;

  // SVG donut
  const r = 16;
  const c = 2 * Math.PI * r;
  const bullLen = (bullPct / 100) * c;
  const neutralLen = (neutralPct / 100) * c;
  const bearLen = (bearPct / 100) * c;

  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
      <circle
        cx="20" cy="20" r={r} fill="none"
        stroke="hsl(var(--bullish))" strokeWidth="5"
        strokeDasharray={`${bullLen} ${c - bullLen}`}
        strokeDashoffset={c * 0.25}
        className="transition-all duration-500"
      />
      <circle
        cx="20" cy="20" r={r} fill="none"
        stroke="hsl(var(--neutral-tone))" strokeWidth="5"
        strokeDasharray={`${neutralLen} ${c - neutralLen}`}
        strokeDashoffset={c * 0.25 - bullLen}
        className="transition-all duration-500"
      />
      <circle
        cx="20" cy="20" r={r} fill="none"
        stroke="hsl(var(--bearish))" strokeWidth="5"
        strokeDasharray={`${bearLen} ${c - bearLen}`}
        strokeDashoffset={c * 0.25 - bullLen - neutralLen}
        className="transition-all duration-500"
      />
    </svg>
  );
}

function trendBorder(trend: string): string {
  if (trend === "bullish") return "border-bullish/40";
  if (trend === "bearish") return "border-bearish/40";
  return "border-border";
}

function trendTextColor(trend: string): string {
  if (trend === "bullish") return "text-bullish";
  if (trend === "bearish") return "text-bearish";
  return "text-neutral-tone";
}

export function SectorCards({ sectors }: SectorCardsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="mb-6">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {sectors.map((s) => (
          <button
            key={s.name}
            onClick={() => setExpanded(expanded === s.name ? null : s.name)}
            className={`min-w-[180px] shrink-0 rounded-lg border bg-card p-4 transition-all hover:brightness-110 cursor-pointer ${trendBorder(s.trend)} ${expanded === s.name ? "ring-1 ring-primary/30" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-left">
                <p className="text-[11px] font-body text-muted-foreground mb-1">{s.name}</p>
                <p className={`text-2xl font-display font-bold ${trendTextColor(s.trend)}`}>
                  {s.avgScore}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.totalCount} pairs</p>
              </div>
              <MiniDonut bull={s.bullishCount} neutral={s.neutralCount} bear={s.bearishCount} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1">
                {s.trend === "bullish" && <TrendingUp className="w-3 h-3 text-bullish" />}
                {s.trend === "bearish" && <TrendingDown className="w-3 h-3 text-bearish" />}
                {s.trend === "neutral" && <Minus className="w-3 h-3 text-neutral-tone" />}
                <span className={`text-[10px] font-display font-semibold ${trendTextColor(s.trend)}`}>
                  {s.trend.toUpperCase()}
                </span>
              </div>
              {expanded === s.name ? (
                <ChevronUp className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Expanded sector detail */}
      {expanded && (() => {
        const sector = sectors.find((s) => s.name === expanded);
        if (!sector) return null;
        return (
          <div className="mt-3 rounded-lg border border-border bg-card p-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-display font-semibold text-foreground">{sector.name}</h4>
              <div className="flex items-center gap-3 text-[11px] font-display">
                <span className="text-bullish">{sector.bullishCount} bull</span>
                <span className="text-neutral-tone">{sector.neutralCount} neutral</span>
                <span className="text-bearish">{sector.bearishCount} bear</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-body text-muted-foreground">
              {sector.strongestPair && (
                <span>Strongest: <span className="text-bullish font-display font-semibold">{sector.strongestPair.symbol}</span> ({sector.strongestPair.score})</span>
              )}
              {sector.weakestPair && (
                <span>Weakest: <span className="text-bearish font-display font-semibold">{sector.weakestPair.symbol}</span> ({sector.weakestPair.score})</span>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

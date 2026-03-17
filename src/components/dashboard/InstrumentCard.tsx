import React from "react";
import { ScoreExplanation, ScoreFreshnessBadge } from "@/components/score/ScoreExplanation";

interface InstrumentCardProps {
  symbol: string;
  percentChange: number | null;
  trendLabel: string;
  confidence: number;
  aiAnalysis: string | null;
  loading?: boolean;
  newsScore?: number | null;
  dataQuality?: "full" | "no-social" | "no-news" | "technical-only";
  scannedAt?: string | null;
  explanationLines?: string[];
}

export function InstrumentCard({
  symbol,
  percentChange,
  trendLabel,
  confidence,
  aiAnalysis,
  loading,
  newsScore,
  dataQuality = "technical-only",
  scannedAt,
  explanationLines = [],
}: InstrumentCardProps) {
  const changeColor =
    percentChange === null
      ? "hsl(var(--muted-foreground))"
      : percentChange >= 0
      ? "hsl(var(--bullish))"
      : "hsl(var(--destructive))";

  const changeStr =
    percentChange === null
      ? "—"
      : `${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(2)}%`;

  const trendBg =
    trendLabel === "Bullish"
      ? "hsl(var(--bullish) / 0.1)"
      : trendLabel === "Bearish"
      ? "hsl(var(--bearish) / 0.1)"
      : "hsl(var(--accent))";
  const trendColor =
    trendLabel === "Bullish"
      ? "hsl(var(--bullish))"
      : trendLabel === "Bearish"
      ? "hsl(var(--destructive))"
      : "hsl(var(--muted-foreground))";

  const barColor =
    confidence > 70
      ? "hsl(var(--bullish))"
      : confidence >= 50
      ? "#f5a623"
      : "hsl(var(--destructive))";

  return (
    <div
      className="rounded-lg p-3.5 transition-colors"
      style={{
        background: "hsl(var(--secondary))",
        border: "0.5px solid hsl(var(--border))",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--ring))";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))";
      }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold" style={{ fontSize: "15px", color: "hsl(var(--foreground))" }}>
            {symbol}
          </span>
          <span className="font-display" style={{ fontSize: "13px", color: changeColor }}>
            {changeStr}
          </span>
          {explanationLines.length > 0 && (
            <ScoreExplanation symbol={symbol} score={confidence} explanationLines={explanationLines} scannedAt={scannedAt} />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <ScoreFreshnessBadge dataQuality={dataQuality} scannedAt={scannedAt} />
          <span
            className="font-display"
            style={{ fontSize: "10px", borderRadius: "4px", padding: "2px 7px", background: trendBg, color: trendColor }}
          >
            {trendLabel}
          </span>
        </div>
      </div>

      {/* Confidence row */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">Confidence</span>
        <span className="font-display" style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>{confidence}%</span>
      </div>
      <div className="mt-1 w-full rounded-full overflow-hidden" style={{ height: "3px", background: "hsl(var(--border))" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(confidence, 100)}%`, background: barColor }} />
      </div>

      {/* News sentiment indicator */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span style={{
          fontSize: "9px",
          color: newsScore != null && newsScore >= 7
            ? "hsl(var(--bullish))"
            : newsScore != null && newsScore <= 4
            ? "hsl(var(--destructive))"
            : "hsl(var(--muted-foreground))",
        }}>
          {newsScore != null && newsScore >= 7 ? "🟢 News positive" : newsScore != null && newsScore <= 4 ? "🔴 News negative" : "⚪ News neutral"}
        </span>
      </div>

      {/* AI Analysis */}
      <div className="mt-2">
        <span className="font-display" style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--bullish))" }}>
          ⚡ AI Analysis
        </span>
        {loading ? (
          <div className="mt-1 space-y-1">
            <div className="h-3 w-full rounded bg-border/30 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-border/30 animate-pulse" />
          </div>
        ) : (
          <p className="mt-1" style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {aiAnalysis || "Run a scan to generate AI analysis."}
          </p>
        )}
      </div>
    </div>
  );
}

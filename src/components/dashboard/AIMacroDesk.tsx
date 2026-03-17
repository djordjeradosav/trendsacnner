import { useEffect, useMemo } from "react";
import { Sparkles, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useScoresStore, loadAllTimeframeScores, type ScoreEntry } from "@/stores/useScoresStore";
import { trendColor, trendBadgeStyle, trendArrow, timeAgo, TIMEFRAME_CONFIG } from "@/lib/display";
import { Button } from "@/components/ui/button";

export function AIMacroDesk({ timeframe }: { timeframe: string }) {
  const navigate = useNavigate();
  const allScores = useScoresStore((s) => s.getAll(timeframe));

  // Top 8 by absolute deviation from 50
  const topPairs = useMemo(() => {
    return [...allScores]
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
      .slice(0, 8);
  }, [allScores]);

  const hasScores = allScores.length > 0;

  if (!hasScores) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <Sparkles className="w-4 h-4" style={{ color: "hsl(var(--bullish))" }} />
          <span className="font-semibold" style={{ fontSize: "14px", color: "hsl(var(--foreground))" }}>
            AI Macro Desk
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <p className="text-sm text-muted-foreground text-center">No scan data — click Scan to load</p>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => loadAllTimeframeScores()}
          >
            <Zap className="w-3.5 h-3.5" /> Load Data
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" style={{ color: "hsl(var(--bullish))" }} />
            <span className="font-semibold" style={{ fontSize: "14px", color: "hsl(var(--foreground))" }}>
              AI Macro Desk
            </span>
          </div>
          <p style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginTop: "2px" }}>
            Top 8 trending · {TIMEFRAME_CONFIG[timeframe]?.label ?? timeframe}
          </p>
        </div>
        <button
          onClick={() => navigate("/scanner")}
          className="font-display transition-opacity hover:opacity-80"
          style={{ fontSize: "12px", color: "hsl(var(--bullish))" }}
        >
          View All →
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-2">
        {topPairs.map((score, idx) => (
          <div
            key={score.symbol}
            className="anim-fade-up cursor-pointer"
            style={{ animationDelay: `${200 + idx * 50}ms` }}
            onClick={() => navigate(`/pair/${score.symbol}`)}
          >
            <MacroDeskCard score={score} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MacroDeskCard({ score }: { score: ScoreEntry }) {
  const trend = score.trend;
  const tc = trendColor(trend);
  const badge = trendBadgeStyle(trend);
  const confidence = Math.round(score.score);
  const barColor = confidence > 65 ? "#00ff7f" : confidence >= 35 ? "#f59e0b" : "#ff3b3b";

  // EMA alignment
  const emaLabel =
    score.ema20 != null && score.ema50 != null
      ? score.ema20 > score.ema50
        ? "↑ Aligned"
        : score.ema20 < score.ema50
        ? "↓ Inverse"
        : "~ Mixed"
      : "—";
  const emaColor =
    score.ema20 != null && score.ema50 != null
      ? score.ema20 > score.ema50
        ? "#00ff7f"
        : "#ff3b3b"
      : "#7a99b0";

  // MACD
  const macdLabel =
    score.macd_hist != null
      ? score.macd_hist > 0
        ? "▲ Positive"
        : "▼ Negative"
      : "—";
  const macdColor = score.macd_hist != null ? (score.macd_hist > 0 ? "#00ff7f" : "#ff3b3b") : "#7a99b0";

  // RSI
  const rsiVal = score.rsi;
  const rsiColor =
    rsiVal != null ? (rsiVal > 70 ? "#ff3b3b" : rsiVal < 30 ? "#00ff7f" : "#7a99b0") : "#7a99b0";

  // ADX
  const adxVal = score.adx;
  const adxColor = adxVal != null && adxVal > 25 ? "#00ff7f" : "#7a99b0";

  return (
    <div
      className="rounded-lg p-3.5 transition-colors hover:brightness-110"
      style={{
        background: "hsl(var(--secondary))",
        border: "0.5px solid hsl(var(--border))",
      }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold" style={{ fontSize: "15px", color: "hsl(var(--foreground))" }}>
            {score.symbol}
          </span>
          <span className="font-display font-bold" style={{ fontSize: "13px", color: tc }}>
            {confidence}/100
          </span>
        </div>
        <span
          className="font-display text-[10px] px-2 py-0.5 rounded"
          style={{ background: badge.background, color: badge.color }}
        >
          {trend.charAt(0).toUpperCase() + trend.slice(1)}
        </span>
      </div>

      {/* Confidence bar */}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10px]" style={{ color: "#7a99b0" }}>Confidence</span>
        <span className="text-[10px] font-display" style={{ color: "#7a99b0" }}>{confidence}%</span>
      </div>
      <div className="mt-1 w-full rounded-full overflow-hidden" style={{ height: "3px", background: "hsl(var(--border))" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(confidence, 100)}%`,
            background: barColor,
            transition: "width 0.6s ease",
          }}
        />
      </div>

      {/* Indicator 2×2 grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px]" style={{ color: "#7a99b0" }}>RSI</span>
          <span className="text-[10px] font-display font-semibold" style={{ color: rsiColor }}>
            {rsiVal != null ? rsiVal.toFixed(1) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px]" style={{ color: "#7a99b0" }}>ADX</span>
          <span className="text-[10px] font-display font-semibold" style={{ color: adxColor }}>
            {adxVal != null ? adxVal.toFixed(1) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px]" style={{ color: "#7a99b0" }}>EMA</span>
          <span className="text-[10px] font-display font-semibold" style={{ color: emaColor }}>
            {emaLabel}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px]" style={{ color: "#7a99b0" }}>MACD</span>
          <span className="text-[10px] font-display font-semibold" style={{ color: macdColor }}>
            {macdLabel}
          </span>
        </div>
      </div>

      {/* Timestamp */}
      <div className="mt-2" style={{ fontSize: "10px", color: "#3d5a70" }}>
        Scanned {timeAgo(score.scanned_at)}
      </div>
    </div>
  );
}

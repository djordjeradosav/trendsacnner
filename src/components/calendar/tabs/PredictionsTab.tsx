import { useEffect, useState, useMemo } from "react";
import type { EconomicEvent } from "@/hooks/useEconomicCalendar";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Loader2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Scenario {
  label: string;
  probability: string;
  expectedMove: string;
  pairsToWatch: string[];
  direction: string;
}

interface Prediction {
  prediction: "beat" | "miss" | "inline";
  confidence: number;
  predictedValue: string;
  reasoning: string;
  primaryScenario: Scenario;
  altScenario: Scenario;
  keyRisk: string;
  analystConsensus: string;
  dataSignals?: {
    beatRate: string;
    beatCount: number;
    totalReleases: number;
    newsSentiment: string;
    newsCount: number;
    socialSentiment: string;
    socialCount: number;
    cbLanguage: string;
    trendDirection: string;
  };
}

interface PredictionRow {
  id: string;
  event_name: string;
  currency: string;
  scheduled_at: string;
  prediction: Prediction;
  was_correct: boolean | null;
  actual_outcome: string | null;
  created_at: string;
}

interface Props {
  event: EconomicEvent;
}

function parseFigure(val: string | null): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

// Confidence arc gauge
function ConfidenceGauge({ confidence }: { confidence: number }) {
  const angle = (confidence / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const r = 40;
  const cx = 50, cy = 48;
  const x = cx + r * Math.cos(Math.PI - rad);
  const y = cy - r * Math.sin(Math.PI - rad);
  const large = angle > 90 ? 1 : 0;
  const color = confidence >= 70 ? "hsl(var(--bullish))" : confidence >= 40 ? "hsl(var(--caution))" : "hsl(var(--destructive))";

  return (
    <svg viewBox="0 0 100 55" className="w-24 h-14">
      <path d={`M 10 48 A 40 40 0 0 1 90 48`} fill="none" stroke="hsl(var(--border))" strokeWidth="6" strokeLinecap="round" />
      <path d={`M 10 48 A 40 40 0 ${large} 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
      <text x="50" y="46" textAnchor="middle" fill={color} fontSize="14" fontWeight="bold" fontFamily="monospace">{confidence}%</text>
    </svg>
  );
}

function ScenarioCard({ scenario, variant }: { scenario: Scenario; variant: "primary" | "alt" }) {
  const isBullish = scenario.direction === "bullish";
  const bgColor = isBullish ? "hsl(var(--bullish) / 0.06)" : "hsl(var(--destructive) / 0.06)";
  const borderColor = isBullish ? "hsl(var(--bullish))" : "hsl(var(--destructive))";
  const labelColor = isBullish ? "hsl(var(--bullish))" : "hsl(var(--destructive))";

  return (
    <div
      className="rounded-lg p-3 border flex-1"
      style={{ background: bgColor, borderColor: "hsl(var(--border))", borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium" style={{ color: labelColor }}>
          {variant === "primary" ? "Primary" : "Alternative"}: {scenario.label}
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary" style={{ color: borderColor }}>
          {scenario.probability}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-1">Expected: {scenario.expectedMove}</p>
      {scenario.pairsToWatch.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-1">
          {scenario.pairsToWatch.map((p) => (
            <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border bg-card text-primary">{p}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function PredictionsTab({ event }: Props) {
  const [predRow, setPredRow] = useState<PredictionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [accuracy, setAccuracy] = useState<PredictionRow[]>([]);
  const [signalsOpen, setSignalsOpen] = useState(false);

  const isReleased = event.actual != null;

  // Fetch existing prediction
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("event_predictions")
        .select("*")
        .eq("event_name", event.event_name)
        .eq("currency", event.currency || "")
        .eq("scheduled_at", event.scheduled_at)
        .limit(1);

      if (data && data.length > 0) {
        setPredRow(data[0] as unknown as PredictionRow);
      } else {
        setPredRow(null);
      }
      setLoading(false);
    };
    fetch();
  }, [event.event_name, event.currency, event.scheduled_at]);

  // Fetch accuracy history for this event type
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("event_predictions")
        .select("*")
        .eq("event_name", event.event_name)
        .eq("currency", event.currency || "")
        .not("was_correct", "is", null)
        .order("scheduled_at", { ascending: false })
        .limit(20);

      setAccuracy((data || []) as unknown as PredictionRow[]);
    };
    fetch();
  }, [event.event_name, event.currency]);

  // Generate prediction on demand
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-event-prediction", {
        body: {
          event_name: event.event_name,
          currency: event.currency,
          scheduled_at: event.scheduled_at,
          forecast: event.forecast,
          previous: event.previous,
          impact: event.impact,
        },
      });
      if (data?.results?.[0]?.prediction) {
        // Refetch
        const { data: refreshed } = await supabase
          .from("event_predictions")
          .select("*")
          .eq("event_name", event.event_name)
          .eq("currency", event.currency || "")
          .eq("scheduled_at", event.scheduled_at)
          .limit(1);
        if (refreshed && refreshed.length > 0) {
          setPredRow(refreshed[0] as unknown as PredictionRow);
        }
      }
    } catch (e) {
      console.error("Failed to generate prediction:", e);
    } finally {
      setGenerating(false);
    }
  };

  const pred = predRow?.prediction;

  // Consensus bar
  const forecast = parseFigure(event.forecast);
  const previous = parseFigure(event.previous);
  const actual = parseFigure(event.actual);

  // Accuracy stats
  const correctCount = accuracy.filter((a) => a.was_correct).length;
  const accuracyRate = accuracy.length > 0 ? Math.round((correctCount / accuracy.length) * 100) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading predictions...
      </div>
    );
  }

  // No prediction yet
  if (!pred) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center py-8">
          <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            No AI prediction generated for this event yet.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              opacity: generating ? 0.6 : 1,
            }}
          >
            {generating ? (
              <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Generating...</span>
            ) : (
              "Generate AI Prediction"
            )}
          </button>
          <p className="text-[10px] text-muted-foreground mt-2">
            Predictions auto-generate 2h before high-impact events
          </p>
        </div>

        {/* Still show consensus if data available */}
        {forecast !== null && previous !== null && <ConsensusSection forecast={forecast} previous={previous} actual={actual} />}
      </div>
    );
  }

  const predLabel = pred.prediction.toUpperCase();
  const predColor =
    pred.prediction === "beat" ? "hsl(var(--bullish))" :
    pred.prediction === "miss" ? "hsl(var(--destructive))" :
    "hsl(var(--muted-foreground))";
  const predBg =
    pred.prediction === "beat" ? "hsl(var(--bullish) / 0.1)" :
    pred.prediction === "miss" ? "hsl(var(--destructive) / 0.1)" :
    "hsl(var(--secondary))";

  const timeAgo = predRow?.created_at
    ? formatTimeAgo(new Date(predRow.created_at))
    : "";

  return (
    <div className="p-4 space-y-4">
      {/* POST-RELEASE OUTCOME BANNER */}
      {isReleased && predRow?.actual_outcome && (
        <div
          className="rounded-lg p-3 border"
          style={{
            background: predRow.was_correct ? "hsl(var(--bullish) / 0.08)" : "hsl(var(--destructive) / 0.08)",
            borderColor: predRow.was_correct ? "hsl(var(--bullish) / 0.3)" : "hsl(var(--destructive) / 0.3)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            {predRow.was_correct ? (
              <CheckCircle className="w-4 h-4" style={{ color: "hsl(var(--bullish))" }} />
            ) : (
              <XCircle className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />
            )}
            <span className="text-[12px] font-medium text-foreground">
              OUTCOME: {predRow.actual_outcome.toUpperCase()} {predRow.was_correct ? "✓" : "✗"}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Predicted: <strong style={{ color: predColor }}>{predLabel}</strong> · Actual: <strong>{predRow.actual_outcome.toUpperCase()}</strong>
            {" "}{predRow.was_correct ? "— Correct ✓" : "— Incorrect ✗"}
          </p>
        </div>
      )}

      {/* AI PREDICTION CARD */}
      <div className="rounded-lg border border-border p-4" style={{ background: "hsl(var(--card))" }}>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-[12px] font-medium text-foreground">AI Prediction</h3>
        </div>

        <div className="flex items-center gap-4 mb-3">
          {/* Prediction badge */}
          <div
            className="px-3 py-1.5 rounded-lg text-[13px] font-bold font-mono"
            style={{ background: predBg, color: predColor, border: `1px solid ${predColor}40` }}
          >
            {predLabel} EXPECTED
          </div>
          {/* Confidence gauge */}
          <ConfidenceGauge confidence={pred.confidence} />
        </div>

        {/* Predicted value */}
        <div className="rounded bg-secondary px-3 py-2 mb-3">
          <p className="text-[11px] text-muted-foreground">
            AI predicts: <span className="text-foreground font-mono font-medium">{pred.predictedValue}</span>
            {event.forecast && <span> (vs {event.forecast} forecast)</span>}
          </p>
        </div>

        {/* Reasoning */}
        <p className="text-[11px] text-foreground leading-relaxed mb-2">{pred.reasoning}</p>

        <p className="text-[9px] text-muted-foreground">
          Generated {timeAgo}
          {pred.dataSignals && ` · Based on ${pred.dataSignals.totalReleases} historical releases + news sentiment`}
        </p>
      </div>

      {/* SCENARIO CARDS */}
      <div className="flex gap-2">
        <ScenarioCard scenario={pred.primaryScenario} variant="primary" />
        <ScenarioCard scenario={pred.altScenario} variant="alt" />
      </div>

      {/* KEY RISK */}
      {pred.keyRisk && (
        <div className="flex items-start gap-2 rounded-lg p-2.5 border border-border" style={{ background: "hsl(var(--caution) / 0.06)" }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "hsl(var(--caution))" }} />
          <p className="text-[10px] text-muted-foreground">{pred.keyRisk}</p>
        </div>
      )}

      {/* DATA SIGNALS (collapsible) */}
      {pred.dataSignals && (
        <Collapsible open={signalsOpen} onOpenChange={setSignalsOpen}>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full">
            {signalsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Data signals used
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1.5 pl-1">
              <SignalRow label="Historical beat rate" value={`${pred.dataSignals.beatRate} (${pred.dataSignals.beatCount}/${pred.dataSignals.totalReleases})`} />
              <SignalRow label="News sentiment" value={pred.dataSignals.newsSentiment} sentiment={pred.dataSignals.newsSentiment} count={pred.dataSignals.newsCount} />
              <SignalRow label="Social buzz" value={pred.dataSignals.socialSentiment} sentiment={pred.dataSignals.socialSentiment} count={pred.dataSignals.socialCount} />
              <SignalRow label="CB language" value={pred.dataSignals.cbLanguage} />
              <SignalRow label="Trend direction" value={pred.dataSignals.trendDirection} trend={pred.dataSignals.trendDirection} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* CONSENSUS */}
      {forecast !== null && previous !== null && <ConsensusSection forecast={forecast} previous={previous} actual={actual} />}

      {/* ACCURACY TRACKER */}
      {accuracy.length > 0 && (
        <div>
          <h3 className="text-[12px] font-medium text-foreground mb-2">
            📊 AI Accuracy for {event.currency} {event.event_name}: {correctCount}/{accuracy.length} correct ({accuracyRate}%)
          </h3>
          <div className="rounded border border-border overflow-hidden">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Date</th>
                  <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Predicted</th>
                  <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Actual</th>
                  <th className="text-center px-2 py-1.5 text-muted-foreground font-medium">Correct?</th>
                </tr>
              </thead>
              <tbody>
                {accuracy.slice(0, 10).map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">
                      {new Date(row.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                    </td>
                    <td className="px-2 py-1.5 capitalize" style={{ color: row.prediction.prediction === "beat" ? "hsl(var(--bullish))" : row.prediction.prediction === "miss" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}>
                      {row.prediction.prediction}
                    </td>
                    <td className="px-2 py-1.5 capitalize" style={{ color: row.actual_outcome === "beat" ? "hsl(var(--bullish))" : row.actual_outcome === "miss" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}>
                      {row.actual_outcome}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {row.was_correct ? <span style={{ color: "hsl(var(--bullish))" }}>✓</span> : <span style={{ color: "hsl(var(--destructive))" }}>✗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components

function ConsensusSection({ forecast, previous, actual }: { forecast: number; previous: number; actual: number | null }) {
  const rangeHalf = Math.abs(forecast * 0.1) || 0.1;

  return (
    <div>
      <h3 className="text-[12px] font-medium text-foreground mb-2">Market Consensus</h3>
      <div className="space-y-2">
        <div className="relative h-8 rounded bg-secondary overflow-hidden">
          <div className="absolute top-0 h-full rounded opacity-20" style={{ background: "hsl(var(--info))", left: `${Math.max(0, ((forecast - rangeHalf - (previous - rangeHalf * 2)) / (rangeHalf * 4)) * 100)}%`, width: `${Math.min(100, (rangeHalf * 2 / (rangeHalf * 4)) * 100)}%` }} />
          <div className="absolute top-0 h-full w-0.5" style={{ background: "hsl(var(--muted-foreground))", left: "25%" }} />
          <div className="absolute top-0 h-full w-0.5" style={{ background: "hsl(var(--info))", left: "50%" }} />
          {actual !== null && (
            <div className="absolute top-0 h-full w-1 rounded" style={{ background: actual > forecast ? "hsl(var(--bullish))" : actual < forecast ? "hsl(var(--destructive))" : "hsl(var(--foreground))", left: `${50 + ((actual - forecast) / (rangeHalf * 2)) * 25}%` }} />
          )}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
          <span>Previous: {previous}</span>
          <span>Forecast: {forecast}</span>
          {actual !== null && <span>Actual: {actual}</span>}
        </div>
      </div>
    </div>
  );
}

function SignalRow({ label, value, sentiment, count, trend }: { label: string; value: string; sentiment?: string; count?: number; trend?: string }) {
  let indicator = "";
  let color = "hsl(var(--muted-foreground))";

  if (sentiment) {
    if (sentiment === "positive" || sentiment === "bullish") { indicator = "🟢"; color = "hsl(var(--bullish))"; }
    else if (sentiment === "negative" || sentiment === "bearish") { indicator = "🔴"; color = "hsl(var(--destructive))"; }
    else { indicator = "⚪"; }
  }

  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono flex items-center gap-1" style={{ color }}>
        {indicator && <span>{indicator}</span>}
        {trend === "up" && <TrendingUp className="w-3 h-3" style={{ color: "hsl(var(--bullish))" }} />}
        {trend === "down" && <TrendingDown className="w-3 h-3" style={{ color: "hsl(var(--destructive))" }} />}
        {trend === "flat" && <Minus className="w-3 h-3" />}
        {value}
        {count != null && <span className="text-muted-foreground"> ({count})</span>}
      </span>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

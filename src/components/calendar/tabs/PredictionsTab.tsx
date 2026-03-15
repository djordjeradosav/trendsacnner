import { useEffect, useState, useMemo } from "react";
import type { EconomicEvent } from "@/hooks/useEconomicCalendar";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Loader2 } from "lucide-react";

interface Scenario {
  scenario: string;
  condition: string;
  probability: string;
  impact: string;
  pairsToWatch: string[];
  expectedMove: string;
}

interface Props {
  event: EconomicEvent;
}

function parseFigure(val: string | null): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

export function PredictionsTab({ event }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<EconomicEvent[]>([]);

  // Fetch history for surprise chart
  useEffect(() => {
    supabase
      .from("economic_events")
      .select("*")
      .eq("event_name", event.event_name)
      .eq("currency", event.currency || "")
      .not("actual", "is", null)
      .order("scheduled_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setHistory((data as EconomicEvent[]) || []));
  }, [event.event_name, event.currency]);

  // Fetch or generate AI scenarios
  useEffect(() => {
    const fetchAnalysis = async () => {
      // Check cache
      const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { data: cached } = await supabase
        .from("event_analyses")
        .select("*")
        .eq("event_name", event.event_name)
        .eq("currency", event.currency || "")
        .gte("created_at", sixHoursAgo)
        .order("created_at", { ascending: false })
        .limit(1);

      if (cached && cached.length > 0) {
        setScenarios((cached[0] as any).analysis as Scenario[]);
        return;
      }

      // Generate via edge function
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("analyze-event", {
          body: {
            event_name: event.event_name,
            currency: event.currency,
            forecast: event.forecast,
            previous: event.previous,
            history: history.map((e) => e.actual).filter(Boolean),
          },
        });
        if (data?.scenarios) {
          setScenarios(data.scenarios);
        }
      } catch (e) {
        console.error("Failed to fetch predictions", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, [event.event_name, event.currency, event.forecast, event.previous, history]);

  // Consensus bar
  const forecast = parseFigure(event.forecast);
  const previous = parseFigure(event.previous);
  const actual = parseFigure(event.actual);
  const rangeHalf = forecast ? Math.abs(forecast * 0.1) || 0.1 : 0.2;

  // Surprise bars
  const surprises = useMemo(() => {
    return history.map((e) => {
      const a = parseFigure(e.actual);
      const f = parseFigure(e.forecast);
      return {
        date: new Date(e.scheduled_at).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        surprise: a !== null && f !== null ? a - f : 0,
      };
    }).reverse();
  }, [history]);

  const maxSurprise = Math.max(0.01, ...surprises.map((s) => Math.abs(s.surprise)));

  const SCENARIO_STYLES: Record<string, { bg: string; border: string; label: string }> = {
    Beat: { bg: "hsl(var(--bullish) / 0.06)", border: "hsl(var(--bullish))", label: "🟢" },
    "In-line": { bg: "hsl(var(--secondary))", border: "hsl(var(--muted-foreground))", label: "⚪" },
    Miss: { bg: "hsl(var(--destructive) / 0.06)", border: "hsl(var(--destructive))", label: "🔴" },
  };

  return (
    <div className="p-4 space-y-4">
      {/* Consensus section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-[12px] font-medium text-foreground">Market Consensus</h3>
        </div>

        {forecast !== null && previous !== null && (
          <div className="space-y-2">
            <div className="relative h-8 rounded bg-secondary overflow-hidden">
              {/* Range band */}
              <div
                className="absolute top-0 h-full rounded opacity-20"
                style={{
                  background: "hsl(var(--info))",
                  left: `${Math.max(0, ((forecast - rangeHalf - (previous - rangeHalf * 2)) / (rangeHalf * 4)) * 100)}%`,
                  width: `${Math.min(100, (rangeHalf * 2 / (rangeHalf * 4)) * 100)}%`,
                }}
              />
              {/* Previous marker */}
              <div
                className="absolute top-0 h-full w-0.5"
                style={{ background: "hsl(var(--muted-foreground))", left: "25%" }}
              />
              {/* Forecast marker */}
              <div
                className="absolute top-0 h-full w-0.5"
                style={{ background: "hsl(var(--info))", left: "50%" }}
              />
              {/* Actual marker */}
              {actual !== null && (
                <div
                  className="absolute top-0 h-full w-1 rounded"
                  style={{
                    background: actual > forecast ? "hsl(var(--bullish))" : actual < forecast ? "hsl(var(--destructive))" : "hsl(var(--foreground))",
                    left: `${50 + ((actual - forecast) / (rangeHalf * 2)) * 25}%`,
                  }}
                />
              )}
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
              <span>Previous: {previous}</span>
              <span>Forecast: {forecast}</span>
              {actual !== null && <span>Actual: {actual}</span>}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Markets expect a {forecast > previous ? "higher" : forecast < previous ? "lower" : "unchanged"} reading vs previous.
            </p>
          </div>
        )}
      </div>

      {/* AI Scenarios */}
      <div>
        <h3 className="text-[12px] font-medium text-foreground mb-3">AI Scenarios</h3>
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Generating scenarios...
          </div>
        ) : scenarios ? (
          <div className="space-y-2">
            {scenarios.map((s, i) => {
              const style = SCENARIO_STYLES[s.scenario] || SCENARIO_STYLES["In-line"];
              return (
                <div
                  key={i}
                  className="rounded-lg p-3 border"
                  style={{
                    background: style.bg,
                    borderColor: "hsl(var(--border))",
                    borderLeft: `3px solid ${style.border}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-foreground">
                      {style.label} {s.scenario}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                      style={{ background: "hsl(var(--secondary))", color: style.border }}
                    >
                      {s.probability}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-1">{s.condition}</p>
                  <p className="text-[11px] text-foreground">{s.impact}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Expected move: {s.expectedMove}</p>
                  {s.pairsToWatch.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {s.pairsToWatch.map((p) => (
                        <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border bg-card text-primary">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-4">
            Unable to generate predictions.
          </div>
        )}
      </div>

      {/* Surprise pattern */}
      {surprises.length > 0 && (
        <div>
          <h3 className="text-[12px] font-medium text-foreground mb-3">Recent Surprises</h3>
          <div className="flex items-end gap-2 h-16">
            {surprises.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex flex-col items-center relative" style={{ height: "40px" }}>
                  <div
                    className="absolute rounded-sm"
                    style={{
                      background: s.surprise >= 0 ? "hsl(var(--bullish))" : "hsl(var(--destructive))",
                      width: "100%",
                      height: `${Math.max(2, (Math.abs(s.surprise) / maxSurprise) * 20)}px`,
                      bottom: s.surprise >= 0 ? "20px" : undefined,
                      top: s.surprise < 0 ? "20px" : undefined,
                    }}
                  />
                  <div className="absolute w-full h-px bg-border" style={{ top: "20px" }} />
                </div>
                <span className="text-[8px] text-muted-foreground">{s.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

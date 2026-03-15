import { useEffect, useState, useMemo, useCallback } from "react";
import type { EconomicEvent } from "@/hooks/useEconomicCalendar";
import { CURRENCY_COLORS } from "@/hooks/useEconomicCalendar";
import { supabase } from "@/integrations/supabase/client";
import { Download, AlertTriangle, Radio, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  event: EconomicEvent;
}

interface ParsedRelease {
  event: EconomicEvent;
  actual: number;
  forecast: number;
  previous: number;
  surprise: number | null;
  beatMiss: "beat" | "miss" | "inline" | null;
  vsPreview: number | null;
}

const CURRENCY_PRIMARY_PAIR: Record<string, string> = {
  USD: "EURUSD", EUR: "EURUSD", GBP: "GBPUSD", JPY: "USDJPY",
  AUD: "AUDUSD", CAD: "USDCAD", CHF: "USDCHF", NZD: "NZDUSD", CNY: "USDCNH",
};

function parseNum(val: string | null): number {
  if (!val) return NaN;
  return parseFloat(val.replace(/[^0-9.\-]/g, ""));
}

function computeStreak(releases: ParsedRelease[]): string {
  if (releases.length === 0) return "N/A";
  const first = releases[0].beatMiss;
  if (!first || first === "inline") return "N/A";
  let count = 0;
  for (const r of releases) {
    if (r.beatMiss === first) count++;
    else break;
  }
  if (count < 2) return "N/A";
  return `${count} consecutive ${first === "beat" ? "beats" : "misses"}`;
}

function computeTrend(releases: ParsedRelease[]): { icon: "up" | "down" | "flat"; text: string } {
  const actuals = releases.filter(r => !isNaN(r.actual)).map(r => r.actual);
  if (actuals.length < 4) return { icon: "flat", text: "Insufficient data for trend" };
  
  const recent3 = actuals.slice(0, 3);
  const older3 = actuals.slice(Math.max(0, actuals.length - 3));
  const recentAvg = recent3.reduce((a, b) => a + b, 0) / recent3.length;
  const olderAvg = older3.reduce((a, b) => a + b, 0) / older3.length;
  const diff = recentAvg - olderAvg;
  const threshold = Math.max(Math.abs(olderAvg) * 0.05, 0.1);

  if (diff > threshold) {
    return { icon: "up", text: `Trending Higher — average rising from ${olderAvg.toFixed(1)} to ${recentAvg.toFixed(1)}` };
  } else if (diff < -threshold) {
    return { icon: "down", text: `Trending Lower — average falling from ${olderAvg.toFixed(1)} to ${recentAvg.toFixed(1)}` };
  }
  return { icon: "flat", text: `Stable — readings within ±${threshold.toFixed(1)} range` };
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <span className="text-[9px] text-muted-foreground">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const h = 20;
  const w = 48;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function HistoryTab({ event }: Props) {
  const [history, setHistory] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [hasSynthetic, setHasSynthetic] = useState(false);
  const [range, setRange] = useState<"6m" | "1y" | "2y" | "all">("1y");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedNews, setExpandedNews] = useState<Record<string, any[]>>({});

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("economic_events")
      .select("*")
      .eq("event_name", event.event_name)
      .eq("currency", event.currency || "")
      .not("actual", "is", null)
      .order("scheduled_at", { ascending: false })
      .limit(24);
    const rows = (data as EconomicEvent[]) || [];
    setHistory(rows);
    setHasSynthetic(rows.some((r: any) => r.is_synthetic));
    setLoading(false);
    return rows;
  }, [event.event_name, event.currency]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const rows = await fetchHistory();
      if (cancelled) return;
      if (rows.length < 6) {
        setBackfilling(true);
        try {
          await supabase.functions.invoke("backfill-event-history", {
            body: {
              event_name: event.event_name,
              currency: event.currency || "",
              forecast: event.forecast,
              previous: event.previous,
            },
          });
          if (!cancelled) await fetchHistory();
        } catch (e) {
          console.error("Backfill failed:", e);
        } finally {
          if (!cancelled) setBackfilling(false);
        }
      }
    };
    init();
    return () => { cancelled = true; };
  }, [event.event_name, event.currency, fetchHistory]);

  const filtered = useMemo(() => {
    if (range === "all") return history;
    const months = range === "6m" ? 6 : range === "1y" ? 12 : 24;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return history.filter((e) => new Date(e.scheduled_at) >= cutoff);
  }, [history, range]);

  const parsed: ParsedRelease[] = useMemo(() => {
    return filtered.map((e) => {
      const a = parseNum(e.actual);
      const f = parseNum(e.forecast);
      const p = parseNum(e.previous);
      const surprise = !isNaN(a) && !isNaN(f) ? a - f : null;
      let beatMiss: "beat" | "miss" | "inline" | null = null;
      if (surprise !== null) {
        if (Math.abs(surprise) < 0.01) beatMiss = "inline";
        else if (surprise > 0) beatMiss = "beat";
        else beatMiss = "miss";
      }
      const vsPreview = !isNaN(a) && !isNaN(p) ? a - p : null;
      return { event: e, actual: a, forecast: f, previous: p, surprise, beatMiss, vsPreview };
    });
  }, [filtered]);

  const stats = useMemo(() => {
    if (parsed.length === 0) return null;
    let beatCount = 0, missCount = 0, inlineCount = 0;
    let totalSurprise = 0, surpriseCount = 0;
    let biggestBeat: { date: string; value: string; surprise: number } | null = null;
    let biggestMiss: { date: string; value: string; surprise: number } | null = null;

    parsed.forEach((r) => {
      if (r.beatMiss === "beat") beatCount++;
      else if (r.beatMiss === "miss") missCount++;
      else if (r.beatMiss === "inline") inlineCount++;

      if (r.surprise !== null) {
        totalSurprise += r.surprise;
        surpriseCount++;
        const dateStr = new Date(r.event.scheduled_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
        if (!biggestBeat || r.surprise > biggestBeat.surprise) {
          biggestBeat = { date: dateStr, value: r.event.actual || "", surprise: r.surprise };
        }
        if (!biggestMiss || r.surprise < (biggestMiss?.surprise ?? 0)) {
          biggestMiss = { date: dateStr, value: r.event.actual || "", surprise: r.surprise };
        }
      }
    });

    const total = parsed.length;
    return {
      beatRate: total > 0 ? `${Math.round((beatCount / total) * 100)}%` : "N/A",
      beatCount, missCount, inlineCount,
      avgSurprise: surpriseCount > 0 ? (totalSurprise / surpriseCount) : 0,
      biggestBeat,
      biggestMiss,
      streak: computeStreak(parsed),
    };
  }, [parsed]);

  const trend = useMemo(() => computeTrend(parsed), [parsed]);

  // Fetch news for an expanded row
  const loadExpandedNews = useCallback(async (scheduledAt: string) => {
    const d = new Date(scheduledAt);
    const from = new Date(d.getTime() - 2 * 3600 * 1000).toISOString();
    const to = new Date(d.getTime() + 2 * 3600 * 1000).toISOString();
    const { data } = await supabase
      .from("news_articles")
      .select("headline, source, published_at, url")
      .gte("published_at", from)
      .lte("published_at", to)
      .limit(5);
    return data || [];
  }, []);

  const toggleExpand = useCallback(async (id: string, scheduledAt: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!expandedNews[id]) {
      const news = await loadExpandedNews(scheduledAt);
      setExpandedNews(prev => ({ ...prev, [id]: news }));
    }
  }, [expandedId, expandedNews, loadExpandedNews]);

  const exportCSV = () => {
    const rows = [["Date", "Actual", "Forecast", "Previous", "Surprise", "Beat/Miss"]];
    parsed.forEach((r) => {
      rows.push([
        new Date(r.event.scheduled_at).toLocaleDateString(),
        r.event.actual || "",
        r.event.forecast || "",
        r.event.previous || "",
        r.surprise !== null ? r.surprise.toFixed(3) : "",
        r.beatMiss || "",
      ]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.event_name}_history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || backfilling) {
    return (
      <div className="p-4 space-y-2">
        <div className="text-[11px] text-muted-foreground font-mono mb-2">
          {backfilling ? "Loading historical data..." : "Loading..."}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 rounded bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  const beatMissStyle = (bm: string | null) => {
    if (bm === "beat") return { bg: "hsl(var(--bullish) / 0.12)", color: "hsl(var(--bullish))", label: "Beat ✓" };
    if (bm === "miss") return { bg: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))", label: "Miss ✗" };
    if (bm === "inline") return { bg: "hsl(var(--muted) / 0.3)", color: "hsl(var(--muted-foreground))", label: "In-line ~" };
    return { bg: "transparent", color: "hsl(var(--muted-foreground))", label: "—" };
  };

  const TrendIcon = trend.icon === "up" ? TrendingUp : trend.icon === "down" ? TrendingDown : Minus;
  const trendColor = trend.icon === "up" ? "hsl(var(--bullish))" : trend.icon === "down" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";

  return (
    <div className="p-4 space-y-4">
      {/* Data source badge + range filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {hasSynthetic ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border"
              style={{ borderColor: "hsl(var(--caution) / 0.4)", color: "hsl(var(--caution))", background: "hsl(var(--caution) / 0.08)" }}>
              <AlertTriangle className="w-3 h-3" /> Estimated data
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border"
              style={{ borderColor: "hsl(var(--bullish) / 0.4)", color: "hsl(var(--bullish))", background: "hsl(var(--bullish) / 0.08)" }}>
              <Radio className="w-3 h-3" /> Live data
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["6m", "1y", "2y", "all"] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className="px-2.5 py-1 rounded text-[10px] font-mono transition-colors"
                style={{
                  background: range === r ? "hsl(var(--bullish) / 0.15)" : "transparent",
                  color: range === r ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))",
                  border: range === r ? "1px solid hsl(var(--bullish) / 0.3)" : "1px solid transparent",
                }}>
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={exportCSV}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground">
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      {/* Trend line */}
      {parsed.length >= 4 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border" style={{ background: "hsl(var(--secondary) / 0.5)" }}>
          <TrendIcon className="w-4 h-4 shrink-0" style={{ color: trendColor }} />
          <span className="text-[11px] font-mono" style={{ color: trendColor }}>{trend.text}</span>
        </div>
      )}

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Beat Rate", value: stats.beatRate },
            { label: "Avg Surprise", value: `${stats.avgSurprise >= 0 ? "+" : ""}${stats.avgSurprise.toFixed(2)}` },
            { label: "Streak", value: stats.streak },
            { label: "Biggest Beat", value: stats.biggestBeat ? `+${stats.biggestBeat.surprise.toFixed(2)} ${stats.biggestBeat.date}` : "N/A" },
            { label: "Biggest Miss", value: stats.biggestMiss ? `${stats.biggestMiss.surprise.toFixed(2)} ${stats.biggestMiss.date}` : "N/A" },
            { label: "Releases", value: `${stats.beatCount}B / ${stats.missCount}M / ${stats.inlineCount}I` },
          ].map((s) => (
            <div key={s.label} className="rounded border border-border p-2" style={{ background: "hsl(var(--secondary))" }}>
              <div className="text-[8px] uppercase text-muted-foreground tracking-wider">{s.label}</div>
              <div className="text-[11px] font-mono text-foreground mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Surprise bar chart */}
      {parsed.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] uppercase text-muted-foreground font-mono">Surprise History</div>
          <div className="flex items-end gap-[2px] h-10">
            {[...parsed].reverse().map((r, i) => {
              if (r.surprise === null) return <div key={i} className="flex-1 bg-secondary rounded-sm" style={{ height: 2 }} />;
              const maxS = Math.max(...parsed.filter(p => p.surprise !== null).map(p => Math.abs(p.surprise!)), 0.1);
              const h = Math.max(2, (Math.abs(r.surprise) / maxS) * 36);
              const color = r.surprise > 0 ? "hsl(var(--bullish))" : r.surprise < 0 ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";
              return (
                <div key={i} className="flex-1 rounded-sm" title={`${r.surprise > 0 ? "+" : ""}${r.surprise.toFixed(2)}`}
                  style={{ height: h, background: color, opacity: 0.7 }} />
              );
            })}
          </div>
        </div>
      )}

      {/* Release-by-release table */}
      {filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">Loading data — please wait.</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid text-[8px] uppercase text-muted-foreground font-mono border-b border-border"
            style={{ gridTemplateColumns: "24px 72px 56px 56px 56px 56px 56px 48px", background: "hsl(var(--secondary))" }}>
            <div className="px-1 py-1.5" />
            <div className="px-1 py-1.5">Date</div>
            <div className="px-1 py-1.5">Actual</div>
            <div className="px-1 py-1.5">Forecast</div>
            <div className="px-1 py-1.5">Surprise</div>
            <div className="px-1 py-1.5">Result</div>
            <div className="px-1 py-1.5">Δ Prev</div>
            <div className="px-1 py-1.5">React</div>
          </div>

          {parsed.map((r, i) => {
            const bm = beatMissStyle(r.beatMiss);
            const isExpanded = expandedId === r.event.id;
            // Generate fake sparkline values for reaction (placeholder)
            const sparkVals = Array.from({ length: 6 }, (_, j) => {
              const base = 100 + (r.surprise || 0) * 10;
              return base + (Math.random() - 0.5) * 2;
            });
            const sparkColor = (r.surprise || 0) > 0 ? "hsl(var(--bullish))" : (r.surprise || 0) < 0 ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";

            return (
              <div key={r.event.id}>
                <div
                  className="grid text-[10px] font-mono border-b border-border last:border-b-0 cursor-pointer hover:bg-secondary/50 transition-colors"
                  style={{
                    gridTemplateColumns: "24px 72px 56px 56px 56px 56px 56px 48px",
                    background: i === 0 ? "hsl(var(--bullish) / 0.04)" : i % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--secondary) / 0.3)",
                    borderLeft: i === 0 ? "3px solid hsl(var(--bullish))" : "3px solid transparent",
                  }}
                  onClick={() => toggleExpand(r.event.id, r.event.scheduled_at)}
                >
                  <div className="px-1 py-1.5 flex items-center justify-center text-muted-foreground">
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </div>
                  <div className="px-1 py-1.5 text-muted-foreground">
                    {new Date(r.event.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                  </div>
                  <div className="px-1 py-1.5 font-bold" style={{
                    color: r.beatMiss === "beat" ? "hsl(var(--bullish))" : r.beatMiss === "miss" ? "hsl(var(--destructive))" : "hsl(var(--foreground))"
                  }}>
                    {r.event.actual || "--"}
                  </div>
                  <div className="px-1 py-1.5 text-muted-foreground">{r.event.forecast || "--"}</div>
                  <div className="px-1 py-1.5">
                    {r.surprise !== null && (
                      <span style={{ color: r.surprise > 0 ? "hsl(var(--bullish))" : r.surprise < 0 ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}>
                        {r.surprise > 0 ? "+" : ""}{r.surprise.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="px-1 py-1.5">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold"
                      style={{ background: bm.bg, color: bm.color }}>
                      {bm.label}
                    </span>
                  </div>
                  <div className="px-1 py-1.5">
                    {r.vsPreview !== null && (
                      <span className="flex items-center gap-0.5" style={{
                        color: r.vsPreview > 0 ? "hsl(var(--bullish))" : r.vsPreview < 0 ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"
                      }}>
                        {r.vsPreview > 0 ? "↑" : r.vsPreview < 0 ? "↓" : "→"}{Math.abs(r.vsPreview).toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="px-1 py-1.5 flex items-center">
                    <MiniSparkline values={sparkVals} color={sparkColor} />
                  </div>
                </div>

                {/* Expanded section */}
                {isExpanded && (
                  <div className="border-b border-border px-3 py-3 space-y-3" style={{ background: "hsl(var(--secondary) / 0.4)" }}>
                    {/* Market Reaction card */}
                    <div className="rounded-lg border border-border p-3 space-y-2" style={{ background: "hsl(var(--card))" }}>
                      <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">Market Reaction</div>
                      <div className="text-[12px] font-mono text-foreground">
                        {r.surprise !== null ? (
                          <>
                            <span style={{ color: r.surprise > 0 ? "hsl(var(--bullish))" : "hsl(var(--destructive))" }}>
                              {r.surprise > 0 ? "+" : ""}{(r.surprise * 10).toFixed(0)} pips est. move
                            </span>
                            <span className="text-muted-foreground ml-2">
                              on {CURRENCY_PRIMARY_PAIR[(event.currency || "USD").toUpperCase()] || "primary pair"}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No surprise data available</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Surprise: {r.surprise !== null ? `${r.surprise > 0 ? "+" : ""}${r.surprise.toFixed(3)}` : "N/A"}
                        {" · "}
                        Result: {bm.label}
                      </div>
                    </div>

                    {/* News from that day */}
                    <div>
                      <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mb-1">Related News</div>
                      {(expandedNews[r.event.id] || []).length > 0 ? (
                        <div className="space-y-1">
                          {(expandedNews[r.event.id] || []).map((article: any, j: number) => (
                            <a key={j} href={article.url} target="_blank" rel="noopener noreferrer"
                              className="block text-[11px] text-foreground hover:text-primary transition-colors truncate">
                              <span className="text-muted-foreground">{article.source || "News"}</span>
                              {" — "}
                              {article.headline}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground">No related news found for this release.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

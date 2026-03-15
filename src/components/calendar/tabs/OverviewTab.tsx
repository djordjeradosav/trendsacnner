import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { EconomicEvent } from "@/hooks/useEconomicCalendar";
import { CURRENCY_COLORS } from "@/hooks/useEconomicCalendar";
import { getEventDescription, OFFICIAL_SOURCES } from "../eventDescriptions";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useEventDrawer } from "@/hooks/useEventDrawer";

const CURRENCY_PAIRS: Record<string, string[]> = {
  USD: ["EURUSD","GBPUSD","USDJPY","USDCHF","USDCAD","AUDUSD","NZDUSD","XAUUSD"],
  EUR: ["EURUSD","EURGBP","EURJPY","EURCAD","EURAUD","EURNZD","EURCHF"],
  GBP: ["GBPUSD","EURGBP","GBPJPY","GBPCAD","GBPAUD","GBPNZD","GBPCHF"],
  JPY: ["USDJPY","EURJPY","GBPJPY","AUDJPY","CADJPY","NZDJPY","CHFJPY"],
  AUD: ["AUDUSD","AUDCAD","AUDJPY","AUDNZD","AUDCHF","XAUUSD"],
  CAD: ["USDCAD","EURCAD","GBPCAD","AUDCAD","CADJPY","CADCHF"],
  CHF: ["USDCHF","EURCHF","GBPCHF","AUDCHF","CADCHF","CHFJPY"],
  NZD: ["NZDUSD","NZDJPY","NZDCAD","AUDNZD","NZDCHF","EURNZD"],
  CNY: ["USDCNY","EURCNY","GBPCNY"],
};

interface Props {
  event: EconomicEvent;
  countdown: { text: string; color: string; isLive: boolean };
}

function parseFigure(val: string | null): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

export function OverviewTab({ event, countdown }: Props) {
  const navigate = useNavigate();
  const close = useEventDrawer((s) => s.close);
  const [descOpen, setDescOpen] = useState(false);
  const [pairScores, setPairScores] = useState<Record<string, { score: number; trend: string }>>({});

  const actual = parseFigure(event.actual);
  const forecast = parseFigure(event.forecast);
  const previous = parseFigure(event.previous);
  const surprise = actual !== null && forecast !== null ? actual - forecast : null;
  const surpriseLabel = surprise === null
    ? "Pending"
    : surprise > 0.001 ? "Beat" : surprise < -0.001 ? "Missed" : "In-line";
  const surpriseColor = surprise === null
    ? "hsl(var(--muted-foreground))"
    : surprise > 0 ? "hsl(var(--bullish))" : surprise < 0 ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";

  const pairs = useMemo(() => {
    const cur = (event.currency || "").toUpperCase();
    return CURRENCY_PAIRS[cur] || [];
  }, [event.currency]);

  // Fetch scores for pairs
  useEffect(() => {
    if (pairs.length === 0) return;
    supabase
      .from("scores")
      .select("pair_id, score, trend, pairs!inner(symbol)")
      .in("pairs.symbol", pairs)
      .eq("timeframe", "1h")
      .order("scanned_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, { score: number; trend: string }> = {};
        (data as any[]).forEach((row) => {
          const sym = row.pairs?.symbol;
          if (sym && !map[sym]) {
            map[sym] = { score: row.score, trend: row.trend };
          }
        });
        setPairScores(map);
      });
  }, [pairs]);

  const description = getEventDescription(event.event_name);
  const officialSource = OFFICIAL_SOURCES[(event.currency || "").toUpperCase()];

  // Countdown timer components
  const diff = new Date(event.scheduled_at).getTime() - Date.now();
  const isPending = !event.actual && diff > 0;

  return (
    <div className="p-4 space-y-4">
      {/* Data card */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-3 text-center" style={{ background: "hsl(var(--secondary))" }}>
          <div className="text-[10px] uppercase text-muted-foreground mb-1">Actual</div>
          <div
            className="text-lg font-mono font-bold"
            style={{
              color: actual === null
                ? "hsl(var(--muted-foreground))"
                : surprise !== null && surprise > 0
                ? "hsl(var(--bullish))"
                : surprise !== null && surprise < 0
                ? "hsl(var(--destructive))"
                : "hsl(var(--foreground))",
            }}
          >
            {event.actual || "--"}
          </div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center" style={{ background: "hsl(var(--secondary))" }}>
          <div className="text-[10px] uppercase text-muted-foreground mb-1">Forecast</div>
          <div className="text-lg font-mono text-muted-foreground">{event.forecast || "--"}</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center" style={{ background: "hsl(var(--secondary))" }}>
          <div className="text-[10px] uppercase text-muted-foreground mb-1">Previous</div>
          <div className="text-lg font-mono text-muted-foreground">{event.previous || "--"}</div>
        </div>
      </div>

      {/* Surprise */}
      {surprise !== null && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Surprise:</span>
          <span className="text-[13px] font-mono font-bold" style={{ color: surpriseColor }}>
            {surprise > 0 ? "+" : ""}{surprise.toFixed(2)}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
              background: surprise > 0 ? "hsl(var(--bullish) / 0.12)" : surprise < 0 ? "hsl(var(--destructive) / 0.12)" : "hsl(var(--secondary))",
              color: surpriseColor,
            }}
          >
            {surpriseLabel}
          </span>
        </div>
      )}

      {/* Countdown */}
      {isPending && (
        <div className="rounded-lg border border-border p-4 text-center" style={{ background: "hsl(var(--secondary))" }}>
          <CountdownClock targetDate={event.scheduled_at} />
        </div>
      )}

      {/* Description */}
      <div className="rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setDescOpen(!descOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
        >
          <span className="text-[11px] font-medium text-foreground">What this event measures</span>
          {descOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        {descOpen && (
          <div className="px-3 pb-3 text-[12px] text-muted-foreground leading-relaxed border-t border-border pt-2">
            {description}
          </div>
        )}
      </div>

      {/* Impacted pairs */}
      {pairs.length > 0 && (
        <div>
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase mb-2">Pairs to watch</h3>
          <div className="flex flex-wrap gap-1.5">
            {pairs.map((p) => {
              const sc = pairScores[p];
              return (
                <button
                  key={p}
                  onClick={() => { close(); navigate(`/pair/${p}`); }}
                  className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded border border-border hover:bg-accent transition-colors"
                  style={{ background: "hsl(var(--card))" }}
                >
                  <span className="text-foreground">{p}</span>
                  {sc && (
                    <span
                      className="text-[9px] px-1 rounded"
                      style={{
                        background: sc.trend === "bullish" ? "hsl(var(--bullish) / 0.15)" : sc.trend === "bearish" ? "hsl(var(--destructive) / 0.15)" : "hsl(var(--secondary))",
                        color: sc.trend === "bullish" ? "hsl(var(--bullish))" : sc.trend === "bearish" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))",
                      }}
                    >
                      {sc.score}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Links */}
      <div className="flex flex-wrap gap-2">
        <a
          href="https://www.forexfactory.com/calendar"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground"
        >
          📰 ForexFactory <ExternalLink className="w-3 h-3" />
        </a>
        {officialSource && (
          <a
            href={officialSource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground"
          >
            🏛 {officialSource.label} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function CountdownClock({ targetDate }: { targetDate: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const diff = new Date(targetDate).getTime() - now;
  if (diff <= 0) {
    return <div className="text-destructive font-mono text-lg animate-pulse">🔴 RELEASING NOW</div>;
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  const units = [
    { val: d.toString().padStart(2, "0"), label: "DAYS" },
    { val: h.toString().padStart(2, "0"), label: "HOURS" },
    { val: m.toString().padStart(2, "0"), label: "MINS" },
    { val: s.toString().padStart(2, "0"), label: "SECS" },
  ];

  return (
    <div className="flex items-center justify-center gap-3">
      {units.map((u, i) => (
        <div key={i} className="text-center">
          <div className="text-2xl font-mono font-bold" style={{ color: "hsl(var(--bullish))" }}>
            {u.val}
          </div>
          <div className="text-[8px] uppercase text-muted-foreground tracking-widest">{u.label}</div>
        </div>
      ))}
    </div>
  );
}

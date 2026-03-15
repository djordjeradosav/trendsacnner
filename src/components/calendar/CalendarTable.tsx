import { useMemo, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type EconomicEvent,
  getFlag,
  getAffectedPairs,
  CURRENCY_COLORS,
} from "@/hooks/useEconomicCalendar";
import { Bell, BarChart3, FolderOpen, Play } from "lucide-react";

interface Props {
  events: EconomicEvent[];
}

const IMPACT_ICON: Record<string, { color: string; label: string }> = {
  high: { color: "#dc2626", label: "🟥" },
  medium: { color: "#f97316", label: "🟧" },
  low: { color: "#eab308", label: "🟨" },
  holiday: { color: "#6b7280", label: "⬜" },
};

function formatTime12h(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDateLabel(dateStr: string): { weekday: string; date: string } {
  const d = new Date(dateStr);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isLive(dateStr: string): boolean {
  const diff = Math.abs(Date.now() - new Date(dateStr).getTime());
  return diff < 5 * 60 * 1000;
}

function isBetterThanForecast(actual: string | null, forecast: string | null): "better" | "worse" | "match" | null {
  if (!actual) return null;
  if (!forecast) return "match";
  const a = parseFloat(actual.replace(/[^0-9.\-]/g, ""));
  const f = parseFloat(forecast.replace(/[^0-9.\-]/g, ""));
  if (isNaN(a) || isNaN(f)) return "match";
  if (a > f) return "better";
  if (a < f) return "worse";
  return "match";
}

export function CalendarTable({ events }: Props) {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group events by date key
  const grouped = useMemo(() => {
    const dayKeys: string[] = [];
    const map: Record<string, EconomicEvent[]> = {};
    events.forEach((ev) => {
      const key = new Date(ev.scheduled_at).toDateString();
      if (!map[key]) {
        map[key] = [];
        dayKeys.push(key);
      }
      map[key].push(ev);
    });
    return { dayKeys, map };
  }, [events]);

  // Auto-scroll to next upcoming event
  useEffect(() => {
    const now = Date.now();
    const nextIdx = events.findIndex(
      (e) => new Date(e.scheduled_at).getTime() > now && !e.actual
    );
    if (nextIdx >= 0) {
      setTimeout(() => {
        const row = tableRef.current?.querySelector(`[data-row-index="${nextIdx}"]`);
        row?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  }, [events]);

  let globalIndex = 0;

  return (
    <div ref={tableRef} className="w-full text-sm">
      {/* Header */}
      <div
        className="grid sticky top-0 z-10 border-b border-border"
        style={{
          gridTemplateColumns: "80px 90px 60px 40px 1fr 32px 32px 80px 80px 80px 32px",
          background: "hsl(var(--card))",
        }}
      >
        {["Date", "Time", "Cur", "", "Event", "", "", "Actual", "Forecast", "Previous", ""].map(
          (h, i) => (
            <div
              key={i}
              className="px-2 py-2 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider"
            >
              {h}
            </div>
          )
        )}
      </div>

      {/* Body */}
      {grouped.dayKeys.map((dayKey) => {
        const dayEvents = grouped.map[dayKey];
        const today = isToday(dayEvents[0].scheduled_at);

        return dayEvents.map((ev, dayIdx) => {
          const rowIndex = globalIndex++;
          const impact = IMPACT_ICON[ev.impact] || IMPACT_ICON.low;
          const curColor = CURRENCY_COLORS[(ev.currency || "").toUpperCase()] || "hsl(var(--muted-foreground))";
          const live = isLive(ev.scheduled_at);
          const comparison = isBetterThanForecast(ev.actual, ev.forecast);
          const isPast = !!ev.actual;
          const isExpanded = expandedId === ev.id;
          const pairs = getAffectedPairs(ev);
          const { weekday, date } = formatDateLabel(ev.scheduled_at);
          const showDate = dayIdx === 0;

          return (
            <div key={ev.id}>
              <div
                data-row-index={rowIndex}
                className="grid items-center cursor-pointer transition-colors"
                style={{
                  gridTemplateColumns: "80px 90px 60px 40px 1fr 32px 32px 80px 80px 80px 32px",
                  height: "44px",
                  borderBottom: "1px solid hsl(var(--border))",
                  background: live
                    ? "hsl(var(--primary) / 0.06)"
                    : rowIndex % 2 === 0
                    ? "hsl(var(--card))"
                    : "hsl(var(--secondary) / 0.5)",
                  borderLeft: live ? "3px solid hsl(var(--primary))" : "3px solid transparent",
                  opacity: isPast ? 0.7 : 1,
                }}
                onClick={() => setExpandedId(isExpanded ? null : ev.id)}
              >
                {/* Date column */}
                <div
                  className="px-2 text-center h-full flex flex-col items-center justify-center"
                  style={{ background: showDate ? "hsl(var(--secondary))" : "transparent" }}
                >
                  {showDate && (
                    <>
                      {today && (
                        <span className="text-[9px] font-bold text-primary uppercase">Today</span>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground leading-tight">
                        {weekday}
                      </span>
                      <span className="text-[10px] font-mono text-foreground leading-tight">
                        {date}
                      </span>
                    </>
                  )}
                </div>

                {/* Time */}
                <div className="px-2 flex items-center gap-1">
                  {live && <Play className="w-3 h-3 text-primary fill-primary" />}
                  <span
                    className="text-[11px] font-mono"
                    style={{
                      color: live ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                      fontStyle: ev.is_tentative ? "italic" : "normal",
                    }}
                  >
                    {ev.is_tentative ? "Tentative" : formatTime12h(ev.scheduled_at)}
                  </span>
                </div>

                {/* Currency */}
                <div className="px-2">
                  <span className="text-[11px] font-mono font-bold" style={{ color: curColor }}>
                    {ev.currency || ""}
                  </span>
                </div>

                {/* Impact */}
                <div className="px-2 flex items-center justify-center">
                  <span
                    className="w-4 h-4 rounded-sm inline-flex items-center justify-center text-[10px]"
                    style={{ background: impact.color + "22", color: impact.color }}
                  >
                    {ev.impact === "high" ? "■" : ev.impact === "medium" ? "■" : ev.impact === "holiday" ? "—" : "■"}
                  </span>
                </div>

                {/* Event name */}
                <div className="px-2 truncate">
                  <span className="text-[13px] text-foreground">{ev.event_name}</span>
                </div>

                {/* Bell */}
                <div className="flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5 text-muted-foreground/40" />
                </div>

                {/* Detail */}
                <div className="flex items-center justify-center">
                  <FolderOpen className="w-3.5 h-3.5 text-muted-foreground/40" />
                </div>

                {/* Actual */}
                <div className="px-2">
                  {ev.actual && (
                    <span
                      className="text-[12px] font-mono font-bold"
                      style={{
                        color:
                          comparison === "better"
                            ? "hsl(var(--primary))"
                            : comparison === "worse"
                            ? "hsl(var(--destructive))"
                            : "hsl(var(--foreground))",
                      }}
                    >
                      {ev.actual}
                    </span>
                  )}
                </div>

                {/* Forecast */}
                <div className="px-2">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {ev.forecast || ""}
                  </span>
                </div>

                {/* Previous */}
                <div className="px-2">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {ev.previous || ""}
                  </span>
                </div>

                {/* Chart */}
                <div className="flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5 text-muted-foreground/40" />
                </div>
              </div>

              {/* Expanded row: affected pairs */}
              {isExpanded && pairs.length > 0 && (
                <div
                  className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-border"
                  style={{ background: "hsl(var(--secondary) / 0.6)", paddingLeft: "230px" }}
                >
                  <span className="text-[10px] text-muted-foreground mr-1 self-center">
                    Affected pairs:
                  </span>
                  {pairs.map((p) => (
                    <button
                      key={p}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/pair/${p}`);
                      }}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-card text-primary hover:bg-accent transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        });
      })}
    </div>
  );
}

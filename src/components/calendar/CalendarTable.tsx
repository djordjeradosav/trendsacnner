import { useMemo, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type EconomicEvent,
  getAffectedPairs,
  CURRENCY_COLORS,
} from "@/hooks/useEconomicCalendar";
import { FolderOpen, Play, ChevronDown, ChevronRight } from "lucide-react";
import { useEventDrawer } from "@/hooks/useEventDrawer";

interface Props {
  events: EconomicEvent[];
}

const IMPACT_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
  holiday: "#6b7280",
};

const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function getLocalDateKey(utcTimestamp: string): string {
  return new Date(utcTimestamp).toLocaleDateString("en-US", {
    timeZone: userTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatLocalTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    timeZone: userTimezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getDayLabel(dateStr: string): { weekday: string; monthDay: string } {
  const d = new Date(dateStr);
  return {
    weekday: d.toLocaleDateString("en-US", { timeZone: userTimezone, weekday: "short" }),
    monthDay: d.toLocaleDateString("en-US", { timeZone: userTimezone, month: "short", day: "numeric" }),
  };
}

function isTodayLocal(utcTimestamp: string): boolean {
  const eventLocal = getLocalDateKey(utcTimestamp);
  const todayLocal = new Date().toLocaleDateString("en-US", {
    timeZone: userTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return eventLocal === todayLocal;
}

function isLive(dateStr: string): boolean {
  return Math.abs(Date.now() - new Date(dateStr).getTime()) < 5 * 60 * 1000;
}

function isImminent(dateStr: string): boolean {
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff > 0 && diff < 15 * 60 * 1000;
}

// ── Beat/Miss detection ──────────────────────────────────

const LOWER_IS_BETTER = new Set([
  "unemployment",
  "jobless",
  "initial claims",
  "continuing claims",
  "cpi",
  "ppi",
  "inflation",
  "trade deficit",
  "budget deficit",
]);

function parseNumericValue(v: string): number {
  return parseFloat(v.replace(/[%KMBkmb,]/g, ""));
}

function isBeat(
  eventName: string,
  actual: string | null,
  forecast: string | null
): boolean | null {
  if (!actual || !forecast) return null;
  const a = parseNumericValue(actual);
  const f = parseNumericValue(forecast);
  if (isNaN(a) || isNaN(f)) return null;
  if (Math.abs(a - f) < 0.01) return null; // in-line

  const eventLower = eventName.toLowerCase();
  const lowerIsBetter = [...LOWER_IS_BETTER].some((k) => eventLower.includes(k));
  return lowerIsBetter ? a < f : a > f;
}

// ─────────────────────────────────────────────────────────

interface DayGroup {
  dateKey: string;
  label: { weekday: string; monthDay: string };
  isToday: boolean;
  events: EconomicEvent[];
  highCount: number;
}

export function CalendarTable({ events }: Props) {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const openDrawer = useEventDrawer((s) => s.open);

  // Deduplicate
  const deduped = useMemo(() => {
    const seen = new Set<string>();
    const real = events.filter((e) => e.currency && !e.is_tentative);
    real.forEach((e) => seen.add(`${e.event_name}|${e.scheduled_at}`));
    const tentativeOnly = events.filter(
      (e) => (!e.currency || e.is_tentative) && !seen.has(`${e.event_name}|${e.scheduled_at}`)
    );
    return [...real, ...tentativeOnly].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
  }, [events]);

  // Group by LOCAL date
  const days: DayGroup[] = useMemo(() => {
    const map: Record<string, EconomicEvent[]> = {};
    const orderedKeys: string[] = [];

    deduped.forEach((ev) => {
      const key = getLocalDateKey(ev.scheduled_at);
      if (!map[key]) {
        map[key] = [];
        orderedKeys.push(key);
      }
      map[key].push(ev);
    });

    orderedKeys.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return orderedKeys.map((k) => ({
      dateKey: k,
      label: getDayLabel(map[k][0].scheduled_at),
      isToday: isTodayLocal(map[k][0].scheduled_at),
      events: map[k],
      highCount: map[k].filter((e) => e.impact === "high").length,
    }));
  }, [deduped]);

  // Auto-scroll to today
  useEffect(() => {
    setTimeout(() => {
      todayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
  }, [days]);

  const COLS = "80px 80px 64px 52px 1fr 36px 100px 90px 90px";

  return (
    <div
      ref={tableRef}
      className="w-full text-[13px]"
      style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}
    >
      {/* Column Headers */}
      <div
        className="grid sticky top-0 z-20 bg-secondary"
        style={{
          gridTemplateColumns: COLS,
          borderBottom: "2px solid hsl(var(--border))",
        }}
      >
        {[
          { label: "Time", align: "left" },
          { label: "", align: "center" },
          { label: "Currency", align: "center" },
          { label: "Impact", align: "center" },
          { label: "Event", align: "left" },
          { label: "", align: "center" },
          { label: "Actual", align: "center" },
          { label: "Forecast", align: "center" },
          { label: "Previous", align: "center" },
        ].map((col, i) => (
          <div
            key={i}
            className="py-2 px-2 text-[11px] font-semibold tracking-wide uppercase text-muted-foreground"
            style={{
              textAlign: col.align as any,
              borderRight: i < 8 ? "1px solid hsl(var(--border))" : "none",
            }}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Day groups */}
      {days.map((day) => {
        let prevTimeStr = "";

        return (
          <div key={day.dateKey} ref={day.isToday ? todayRef : undefined} id={day.isToday ? "today-section" : undefined}>
            {/* Day separator header */}
            <div
              className="flex items-center gap-3 px-3 py-1.5 sticky top-[38px] z-10"
              style={{
                background: day.isToday ? "hsl(var(--primary) / 0.08)" : "#0d1117",
                borderBottom: "1px solid hsl(var(--border))",
                borderLeft: day.isToday ? "3px solid hsl(var(--primary))" : "3px solid transparent",
              }}
            >
              {day.isToday && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
                >
                  Today
                </span>
              )}
              <span className="text-[12px] font-semibold text-foreground/80">{day.label.weekday}</span>
              <span className="text-[12px] font-mono text-muted-foreground">{day.label.monthDay}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {day.events.length} events
                {day.highCount > 0 && (
                  <span className="ml-1.5" style={{ color: "#ef4444" }}>
                    · {day.highCount} 🔴 high
                  </span>
                )}
              </span>
            </div>

            {/* Events */}
            {day.events.map((ev, evIdx) => {
              const impact = ev.impact || "low";
              const impactColor = IMPACT_COLORS[impact] || IMPACT_COLORS.low;
              const live = isLive(ev.scheduled_at);
              const imminent = !live && isImminent(ev.scheduled_at);
              const beat = isBeat(ev.event_name, ev.actual, ev.forecast);
              const isPast = !!ev.actual;
              const isExpanded = expandedId === ev.id;
              const pairs = getAffectedPairs(ev);
              const curColor = CURRENCY_COLORS[(ev.currency || "").toUpperCase()] || "hsl(var(--muted-foreground))";

              const timeStr = ev.is_tentative ? "Tentative" : formatLocalTime(ev.scheduled_at);
              const showTime = timeStr !== prevTimeStr;
              prevTimeStr = timeStr;

              return (
                <div key={ev.id}>
                  <div
                    className="grid items-center cursor-pointer transition-colors hover:bg-secondary"
                    onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                    style={{
                      gridTemplateColumns: COLS,
                      minHeight: "40px",
                      borderBottom: "1px solid hsl(var(--border))",
                      background: live
                        ? "hsl(var(--primary) / 0.05)"
                        : evIdx % 2 === 0
                          ? "hsl(var(--card))"
                          : "hsl(var(--background))",
                      borderLeft: live
                        ? "3px solid hsl(var(--primary))"
                        : imminent
                          ? "3px solid hsl(var(--caution, 45 100% 50%))"
                          : "3px solid transparent",
                      opacity: isPast ? 0.75 : 1,
                    }}
                  >
                    {/* Time */}
                    <div className="px-2" style={{ borderRight: "1px solid hsl(var(--border))" }}>
                      {showTime && (
                        <span
                          className="text-[12px] font-mono"
                          style={{
                            color: live
                              ? "hsl(var(--primary))"
                              : ev.is_tentative
                                ? "hsl(var(--muted-foreground))"
                                : "hsl(var(--secondary-foreground))",
                            fontStyle: ev.is_tentative ? "italic" : "normal",
                          }}
                        >
                          {timeStr}
                        </span>
                      )}
                    </div>

                    {/* Status indicator */}
                    <div className="px-2 text-center" style={{ borderRight: "1px solid hsl(var(--border))" }}>
                      {live ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                          <Play className="w-3 h-3 fill-current" /> LIVE
                        </span>
                      ) : imminent ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: "hsl(var(--caution, 45 100% 50%))" }}>
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "hsl(var(--primary))" }} />
                          SOON
                        </span>
                      ) : null}
                    </div>

                    {/* Currency */}
                    <div className="px-2 text-center" style={{ borderRight: "1px solid hsl(var(--border))" }}>
                      <span className="text-[12px] font-mono font-bold" style={{ color: curColor }}>
                        {ev.currency || "—"}
                      </span>
                    </div>

                    {/* Impact */}
                    <div className="px-2 flex items-center justify-center" style={{ borderRight: "1px solid hsl(var(--border))" }}>
                      <div className="flex gap-[2px]">
                        {impact === "high" ? (
                          <>
                            <span className="w-[5px] h-4 rounded-[1px]" style={{ background: impactColor }} />
                            <span className="w-[5px] h-4 rounded-[1px]" style={{ background: impactColor }} />
                            <span className="w-[5px] h-4 rounded-[1px]" style={{ background: impactColor }} />
                          </>
                        ) : impact === "medium" ? (
                          <>
                            <span className="w-[5px] h-4 rounded-[1px]" style={{ background: impactColor }} />
                            <span className="w-[5px] h-4 rounded-[1px]" style={{ background: impactColor }} />
                            <span className="w-[5px] h-4 rounded-[1px] bg-border" />
                          </>
                        ) : impact === "holiday" ? (
                          <span className="text-[10px]" style={{ color: impactColor }}>—</span>
                        ) : (
                          <>
                            <span className="w-[5px] h-4 rounded-[1px]" style={{ background: impactColor }} />
                            <span className="w-[5px] h-4 rounded-[1px] bg-border" />
                            <span className="w-[5px] h-4 rounded-[1px] bg-border" />
                          </>
                        )}
                      </div>
                    </div>

                    {/* Event name */}
                    <div className="px-3 flex items-center gap-2 truncate" style={{ borderRight: "1px solid hsl(var(--border))" }}>
                      <span className="text-[13px] truncate text-foreground">
                        {ev.event_name}
                      </span>
                      {pairs.length > 0 && (
                        isExpanded
                          ? <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                          : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
                      )}
                    </div>

                    {/* Detail button */}
                    <div className="flex items-center justify-center" style={{ borderRight: "1px solid hsl(var(--border))" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); openDrawer(ev, "overview"); }}
                        className="p-1 rounded hover:bg-secondary transition-colors"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Actual — with beat/miss coloring */}
                    <div className="px-2 text-center" style={{ borderRight: "1px solid hsl(var(--border))" }}>
                      {ev.actual ? (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="text-[13px] font-mono font-bold"
                            style={{
                              color:
                                beat === true
                                  ? "#22c55e"
                                  : beat === false
                                    ? "#ef4444"
                                    : "hsl(var(--foreground))",
                            }}
                          >
                            {ev.actual}
                          </span>
                          {beat !== null && (
                            <span
                              className="text-[8px] font-semibold"
                              style={{ color: beat ? "#22c55e" : "#ef4444" }}
                            >
                              {beat ? "↑Beat" : "↓Miss"}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* Forecast */}
                    <div className="px-2 text-center" style={{ borderRight: "1px solid hsl(var(--border))" }}>
                      <span className="text-[13px] font-mono text-muted-foreground">
                        {ev.forecast || "—"}
                      </span>
                    </div>

                    {/* Previous */}
                    <div className="px-2 text-center">
                      <span className="text-[13px] font-mono text-muted-foreground">
                        {ev.previous || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded: affected pairs */}
                  {isExpanded && pairs.length > 0 && (
                    <div
                      className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-secondary"
                      style={{
                        borderBottom: "1px solid hsl(var(--border))",
                        paddingLeft: "280px",
                      }}
                    >
                      <span className="text-[10px] mr-1 text-muted-foreground">Affected:</span>
                      {pairs.map((p) => (
                        <button
                          key={p}
                          onClick={(e) => { e.stopPropagation(); navigate(`/pair/${p}`); }}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors bg-accent border border-border text-primary"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

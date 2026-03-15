import { useMemo, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type EconomicEvent,
  getAffectedPairs,
  getFlag,
  CURRENCY_COLORS,
} from "@/hooks/useEconomicCalendar";
import { Bell, FolderOpen, Play, ChevronDown, ChevronRight } from "lucide-react";
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

const IMPACT_LABELS: Record<string, string> = {
  high: "High",
  medium: "Med",
  low: "Low",
  holiday: "Holiday",
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function getDayLabel(dateStr: string): { weekday: string; monthDay: string } {
  const d = new Date(dateStr);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    monthDay: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function isLive(dateStr: string): boolean {
  return Math.abs(Date.now() - new Date(dateStr).getTime()) < 5 * 60 * 1000;
}

function compareResult(actual: string | null, forecast: string | null): "better" | "worse" | "match" | null {
  if (!actual) return null;
  if (!forecast) return "match";
  const a = parseFloat(actual.replace(/[^0-9.\-]/g, ""));
  const f = parseFloat(forecast.replace(/[^0-9.\-]/g, ""));
  if (isNaN(a) || isNaN(f)) return "match";
  if (a > f) return "better";
  if (a < f) return "worse";
  return "match";
}

interface DayGroup {
  dateKey: string;
  label: { weekday: string; monthDay: string };
  isToday: boolean;
  events: EconomicEvent[];
}

export function CalendarTable({ events }: Props) {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const openDrawer = useEventDrawer((s) => s.open);

  // Filter out tentative duplicates (no currency) when a real version exists
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

  const days: DayGroup[] = useMemo(() => {
    const map: Record<string, EconomicEvent[]> = {};
    const keys: string[] = [];
    deduped.forEach((ev) => {
      const key = new Date(ev.scheduled_at).toDateString();
      if (!map[key]) { map[key] = []; keys.push(key); }
      map[key].push(ev);
    });
    return keys.map((k) => ({
      dateKey: k,
      label: getDayLabel(map[k][0].scheduled_at),
      isToday: isToday(map[k][0].scheduled_at),
      events: map[k],
    }));
  }, [deduped]);

  // Auto-scroll to next upcoming event
  useEffect(() => {
    const now = Date.now();
    const nextIdx = deduped.findIndex((e) => new Date(e.scheduled_at).getTime() > now && !e.actual);
    if (nextIdx >= 0) {
      setTimeout(() => {
        tableRef.current?.querySelector(`[data-idx="${nextIdx}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [deduped]);

  const COLS = "72px 80px 64px 52px 1fr 36px 90px 90px 90px";

  let globalIdx = 0;

  return (
    <div ref={tableRef} className="w-full text-[13px]">
      {/* Column Headers — ForexFactory style */}
      <div
        className="grid sticky top-0 z-10"
        style={{
          gridTemplateColumns: COLS,
          background: "#283848",
          borderBottom: "2px solid #1a2a38",
        }}
      >
        {[
          { label: "Date", align: "center" },
          { label: "Time", align: "left" },
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
            className="py-2 px-2 text-[11px] font-semibold tracking-wide uppercase"
            style={{
              color: "#8fa3b8",
              textAlign: col.align as any,
              borderRight: i < 8 ? "1px solid #1e2d3d" : "none",
            }}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Day groups */}
      {days.map((day) => (
        <div key={day.dateKey}>
          {/* Day separator header */}
          <div
            className="flex items-center gap-3 px-3 py-1.5"
            style={{
              background: day.isToday ? "hsl(var(--primary) / 0.08)" : "#1a2535",
              borderBottom: "1px solid #1e2d3d",
              borderLeft: day.isToday ? "3px solid hsl(var(--primary))" : "3px solid transparent",
            }}
          >
            {day.isToday && (
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "hsl(var(--primary))" }}>
                Today
              </span>
            )}
            <span className="text-[12px] font-semibold" style={{ color: "#c0d0e0" }}>
              {day.label.weekday}
            </span>
            <span className="text-[12px] font-mono" style={{ color: "#8fa3b8" }}>
              {day.label.monthDay}
            </span>
          </div>

          {/* Events */}
          {day.events.map((ev) => {
            const idx = globalIdx++;
            const impact = ev.impact || "low";
            const impactColor = IMPACT_COLORS[impact] || IMPACT_COLORS.low;
            const live = isLive(ev.scheduled_at);
            const comparison = compareResult(ev.actual, ev.forecast);
            const isPast = !!ev.actual;
            const isExpanded = expandedId === ev.id;
            const pairs = getAffectedPairs(ev);
            const curColor = CURRENCY_COLORS[(ev.currency || "").toUpperCase()] || "#8fa3b8";

            return (
              <div key={ev.id}>
                <div
                  data-idx={idx}
                  className="grid items-center cursor-pointer transition-colors hover:bg-[#1a2535]"
                  onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                  style={{
                    gridTemplateColumns: COLS,
                    height: "40px",
                    borderBottom: "1px solid #1e2d3d",
                    background: live
                      ? "hsl(var(--primary) / 0.05)"
                      : idx % 2 === 0
                      ? "#0d1117"
                      : "#111820",
                    borderLeft: live
                      ? "3px solid hsl(var(--primary))"
                      : "3px solid transparent",
                    opacity: isPast ? 0.75 : 1,
                  }}
                >
                  {/* Date — empty, handled by day header */}
                  <div className="px-2 text-center" style={{ borderRight: "1px solid #1e2d3d" }}>
                    {live && (
                      <span className="inline-flex items-center gap-1">
                        <Play className="w-3 h-3 fill-current" style={{ color: "hsl(var(--primary))" }} />
                      </span>
                    )}
                  </div>

                  {/* Time */}
                  <div className="px-2" style={{ borderRight: "1px solid #1e2d3d" }}>
                    <span
                      className="text-[12px] font-mono"
                      style={{
                        color: live ? "hsl(var(--primary))" : ev.is_tentative ? "#5a7080" : "#8fa3b8",
                        fontStyle: ev.is_tentative ? "italic" : "normal",
                      }}
                    >
                      {ev.is_tentative ? "Tentative" : formatTime(ev.scheduled_at)}
                    </span>
                  </div>

                  {/* Currency */}
                  <div className="px-2 text-center" style={{ borderRight: "1px solid #1e2d3d" }}>
                    <span className="text-[12px] font-mono font-bold" style={{ color: curColor }}>
                      {ev.currency || "—"}
                    </span>
                  </div>

                  {/* Impact */}
                  <div className="px-2 flex items-center justify-center" style={{ borderRight: "1px solid #1e2d3d" }}>
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
                          <span className="w-[5px] h-4 rounded-[1px]" style={{ background: "#1e2d3d" }} />
                        </>
                      ) : impact === "holiday" ? (
                        <span className="text-[10px]" style={{ color: impactColor }}>—</span>
                      ) : (
                        <>
                          <span className="w-[5px] h-4 rounded-[1px]" style={{ background: impactColor }} />
                          <span className="w-[5px] h-4 rounded-[1px]" style={{ background: "#1e2d3d" }} />
                          <span className="w-[5px] h-4 rounded-[1px]" style={{ background: "#1e2d3d" }} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Event name */}
                  <div className="px-3 flex items-center gap-2 truncate" style={{ borderRight: "1px solid #1e2d3d" }}>
                    <span className="text-[13px] truncate" style={{ color: "#e0ecf4" }}>
                      {ev.event_name}
                    </span>
                    {pairs.length > 0 && (
                      isExpanded
                        ? <ChevronDown className="w-3 h-3 shrink-0" style={{ color: "#5a7080" }} />
                        : <ChevronRight className="w-3 h-3 shrink-0" style={{ color: "#5a7080" }} />
                    )}
                  </div>

                  {/* Detail button */}
                  <div className="flex items-center justify-center" style={{ borderRight: "1px solid #1e2d3d" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); openDrawer(ev, "overview"); }}
                      className="p-1 rounded hover:bg-[#1e2d3d] transition-colors"
                    >
                      <FolderOpen className="w-3.5 h-3.5" style={{ color: "#5a7080" }} />
                    </button>
                  </div>

                  {/* Actual */}
                  <div className="px-2 text-center" style={{ borderRight: "1px solid #1e2d3d" }}>
                    {ev.actual ? (
                      <span
                        className="text-[13px] font-mono font-bold"
                        style={{
                          color:
                            comparison === "better"
                              ? "#22c55e"
                              : comparison === "worse"
                              ? "#ef4444"
                              : "#e0ecf4",
                        }}
                      >
                        {ev.actual}
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: "#3d5a70" }}>—</span>
                    )}
                  </div>

                  {/* Forecast */}
                  <div className="px-2 text-center" style={{ borderRight: "1px solid #1e2d3d" }}>
                    <span className="text-[13px] font-mono" style={{ color: "#8fa3b8" }}>
                      {ev.forecast || "—"}
                    </span>
                  </div>

                  {/* Previous */}
                  <div className="px-2 text-center">
                    <span className="text-[13px] font-mono" style={{ color: "#8fa3b8" }}>
                      {ev.previous || "—"}
                    </span>
                  </div>
                </div>

                {/* Expanded: affected pairs */}
                {isExpanded && pairs.length > 0 && (
                  <div
                    className="flex flex-wrap items-center gap-1.5 px-4 py-2"
                    style={{
                      background: "#131a22",
                      borderBottom: "1px solid #1e2d3d",
                      paddingLeft: "268px",
                    }}
                  >
                    <span className="text-[10px] mr-1" style={{ color: "#5a7080" }}>Affected:</span>
                    {pairs.map((p) => (
                      <button
                        key={p}
                        onClick={(e) => { e.stopPropagation(); navigate(`/pair/${p}`); }}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors"
                        style={{
                          background: "#1a2535",
                          border: "1px solid #1e2d3d",
                          color: "hsl(var(--primary))",
                        }}
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
      ))}
    </div>
  );
}

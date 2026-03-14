import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useEconomicCalendar, getFlag, getAffectedPairs } from "@/hooks/useEconomicCalendar";
import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const FILTER_OPTIONS = ["All", "High Impact", "USD", "EUR", "GBP", "JPY"] as const;

function CountdownTimer({ event }: { event: { event_name: string; scheduled_at: string } | null }) {
  const [now, setNow] = useState(Date.now());

  // Refresh every second
  useState(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  });

  if (!event) return null;

  const diff = new Date(event.scheduled_at).getTime() - now;
  if (diff <= 0) return null;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const isUrgent = diff < 30 * 60 * 1000;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card"
      style={isUrgent ? { borderColor: "hsl(var(--caution))", animation: "pulse 1.5s infinite" } : {}}
    >
      <Clock className="w-3.5 h-3.5" style={{ color: isUrgent ? "hsl(var(--caution))" : "hsl(var(--info))" }} />
      <span className="text-xs font-mono" style={{ color: isUrgent ? "hsl(var(--caution))" : "hsl(var(--foreground))" }}>
        Next: {event.event_name.slice(0, 20)} in {days > 0 ? `${days}d ` : ""}{hours}h {mins}m
      </span>
    </div>
  );
}

export default function CalendarPage() {
  const { events, loading, nextHighImpact } = useEconomicCalendar(200);
  const [filter, setFilter] = useState<string>("All");
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (filter === "All") return events;
    if (filter === "High Impact") return events.filter((e) => e.impact === "high");
    return events.filter((e) => (e.currency || "").toUpperCase() === filter);
  }, [events, filter]);

  // Group by day
  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    filtered.forEach((ev) => {
      const day = new Date(ev.scheduled_at).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      if (!map[day]) map[day] = [];
      map[day].push(ev);
    });
    return Object.entries(map);
  }, [filtered]);

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-info" />
          <h1 className="text-lg font-semibold text-foreground">Economic Calendar</h1>
        </div>
        <CountdownTimer event={nextHighImpact} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-md text-xs font-mono transition-colors border"
            style={{
              background: filter === f ? "hsl(var(--secondary))" : "transparent",
              borderColor: filter === f ? "hsl(var(--border))" : "transparent",
              color: filter === f ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming events found.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayEvents]) => (
            <div key={day}>
              <h2 className="text-xs font-mono font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                {day}
              </h2>
              <div className="space-y-1">
                {dayEvents.map((ev) => {
                  const isHigh = ev.impact === "high";
                  const isMed = ev.impact === "medium";
                  const time = new Date(ev.scheduled_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
                  const pairs = getAffectedPairs(ev);

                  return (
                    <div
                      key={ev.id}
                      className="flex items-start gap-3 py-2.5 px-3 rounded-lg border border-border bg-card"
                      style={{
                        borderLeftWidth: "3px",
                        borderLeftColor: isHigh
                          ? "hsl(var(--destructive))"
                          : isMed
                          ? "hsl(var(--caution))"
                          : "hsl(var(--border))",
                      }}
                    >
                      {/* Impact dot */}
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{
                          background: isHigh
                            ? "hsl(var(--destructive))"
                            : isMed
                            ? "hsl(var(--caution))"
                            : "hsl(var(--muted-foreground))",
                        }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-mono text-muted-foreground">{time}</span>
                          <span className="text-[11px]">
                            {getFlag(ev.currency)}{" "}
                            <span className="font-mono text-muted-foreground">{ev.currency || ""}</span>
                          </span>
                        </div>

                        <p className="text-sm font-medium text-foreground leading-snug">{ev.event_name}</p>

                        <div className="flex items-center gap-3 mt-1.5">
                          {ev.forecast && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              Forecast: {ev.forecast}
                            </span>
                          )}
                          {ev.previous && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              Previous: {ev.previous}
                            </span>
                          )}
                          {ev.actual && (
                            <span className="text-[10px] font-mono text-bullish">
                              Actual: {ev.actual}
                            </span>
                          )}
                        </div>

                        {pairs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {pairs.map((p) => (
                              <button
                                key={p}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/pair/${p}`);
                                }}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-secondary text-info hover:bg-accent transition-colors"
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

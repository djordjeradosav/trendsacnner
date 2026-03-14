import { Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEconomicCalendar, getFlag, getAffectedPairs } from "@/hooks/useEconomicCalendar";

export function CalendarWidget() {
  const { events, loading } = useEconomicCalendar(4);
  const navigate = useNavigate();

  return (
    <div
      className="rounded-[10px] border border-border bg-card p-4 mt-4 cursor-pointer"
      onClick={() => navigate("/calendar")}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-info" />
          <span className="text-xs font-semibold text-foreground">Calendar</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          View all →
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 rounded bg-secondary animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No upcoming events</p>
      ) : (
        <div className="space-y-1">
          {events.map((ev) => {
            const isHigh = ev.impact === "high";
            const time = new Date(ev.scheduled_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
            const pairs = getAffectedPairs(ev);

            return (
              <div
                key={ev.id}
                className="flex items-center gap-2 py-1.5 px-1 rounded"
                style={{
                  borderLeft: isHigh
                    ? "2px solid hsl(var(--destructive))"
                    : "2px solid transparent",
                }}
              >
                {/* Impact dot */}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    background:
                      ev.impact === "high"
                        ? "hsl(var(--destructive))"
                        : ev.impact === "medium"
                        ? "hsl(var(--caution))"
                        : "hsl(var(--muted-foreground))",
                  }}
                />

                {/* Time */}
                <span className="text-[11px] font-mono text-muted-foreground w-10 shrink-0">
                  {time}
                </span>

                {/* Flag + currency */}
                <span className="text-[11px] shrink-0">
                  {getFlag(ev.currency)}{" "}
                  <span className="font-mono text-muted-foreground">
                    {ev.currency || ""}
                  </span>
                </span>

                {/* Event name */}
                <span className="text-xs text-foreground truncate flex-1" title={ev.event_name}>
                  {ev.event_name.length > 24
                    ? ev.event_name.slice(0, 24) + "…"
                    : ev.event_name}
                </span>

                {/* Forecast/Previous */}
                <span className="text-[10px] font-mono text-muted-foreground shrink-0 hidden sm:inline">
                  {ev.forecast ? `F:${ev.forecast}` : ""}
                  {ev.previous ? ` P:${ev.previous}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

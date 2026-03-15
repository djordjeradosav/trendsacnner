import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEconomicCalendar, getFlag, CURRENCY_COLORS } from "@/hooks/useEconomicCalendar";

function Countdown({ targetDate }: { targetDate: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = new Date(targetDate).getTime() - now;
  if (diff <= 0) return <span className="text-[10px] font-mono text-primary">NOW</span>;

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <span className="text-[10px] font-mono text-destructive tabular-nums">
      {d > 0 ? `${d}d ` : ""}{h}h {m}m {s}s
    </span>
  );
}

export function CalendarWidget() {
  const { events, loading } = useEconomicCalendar(20);
  const navigate = useNavigate();

  // Filter to only high-impact upcoming events
  const highImpact = events.filter((e) => e.impact === "high").slice(0, 5);
  const next = highImpact[0] || null;

  return (
    <div
      className="rounded-[10px] border border-border bg-card p-3 h-full flex flex-col cursor-pointer"
      onClick={() => navigate("/calendar")}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Calendar</span>
        </div>
        {next && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <Countdown targetDate={next.scheduled_at} />
          </div>
        )}
      </div>

      {/* Events list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 rounded bg-secondary animate-pulse" />
          ))
        ) : highImpact.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No upcoming high-impact events</p>
        ) : (
          highImpact.map((ev) => {
            const curColor = CURRENCY_COLORS[(ev.currency || "").toUpperCase()] || "hsl(var(--muted-foreground))";
            const time = new Date(ev.scheduled_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
            return (
              <div
                key={ev.id}
                className="flex items-center gap-1.5 py-1 px-1 rounded"
                style={{ borderLeft: "2px solid hsl(var(--destructive))" }}
              >
                <span className="w-2 h-2 rounded-sm shrink-0 bg-destructive" />
                <span className="text-[10px] font-mono text-muted-foreground w-[52px] shrink-0">
                  {time}
                </span>
                <span className="text-[10px] font-mono font-bold shrink-0" style={{ color: curColor }}>
                  {ev.currency || ""}
                </span>
                <span className="text-[11px] text-foreground truncate flex-1" title={ev.event_name}>
                  {ev.event_name.length > 22 ? ev.event_name.slice(0, 22) + "…" : ev.event_name}
                </span>
                {ev.forecast && (
                  <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                    {ev.forecast}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-1 text-center shrink-0">
        <span className="text-[9px] font-mono text-muted-foreground">View full calendar →</span>
      </div>
    </div>
  );
}

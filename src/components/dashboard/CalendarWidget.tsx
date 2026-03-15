import { useState, useEffect } from "react";
import { Calendar, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEconomicCalendar, getFlag, CURRENCY_COLORS } from "@/hooks/useEconomicCalendar";

function Countdown({ targetDate }: { targetDate: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = new Date(targetDate).getTime() - now;
  if (diff <= 0) return <span className="text-[10px] font-mono font-bold" style={{ color: "hsl(var(--primary))" }}>LIVE NOW</span>;

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <span className="text-[10px] font-mono tabular-nums" style={{ color: "#ef4444" }}>
      {h > 0 ? `${h}h ` : ""}{m}m {s}s
    </span>
  );
}

const IMPACT_DOTS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

export function CalendarWidget() {
  const { events, loading } = useEconomicCalendar(30);
  const navigate = useNavigate();

  const highImpact = events.filter((e) => e.impact === "high" || e.impact === "medium").slice(0, 6);
  const next = highImpact[0] || null;

  return (
    <div
      className="rounded-lg p-3 h-full flex flex-col cursor-pointer transition-colors"
      style={{ background: "#0d1117", border: "1px solid #1e2d3d" }}
      onClick={() => navigate("/calendar")}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#2a3f55"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1e2d3d"; }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
          <span className="text-[12px] font-semibold" style={{ color: "#e0ecf4" }}>Economic Calendar</span>
        </div>
        {next && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" style={{ color: "#ef4444" }} />
            <Countdown targetDate={next.scheduled_at} />
          </div>
        )}
      </div>

      {/* Events list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 rounded animate-pulse" style={{ background: "#131a22" }} />
          ))
        ) : highImpact.length === 0 ? (
          <p className="text-[10px]" style={{ color: "#5a7080" }}>No upcoming impact events</p>
        ) : (
          highImpact.map((ev) => {
            const curColor = CURRENCY_COLORS[(ev.currency || "").toUpperCase()] || "#8fa3b8";
            const impactColor = IMPACT_DOTS[ev.impact] || IMPACT_DOTS.low;
            const time = new Date(ev.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
            return (
              <div
                key={ev.id}
                className="flex items-center gap-1.5 py-1 px-1.5 rounded"
                style={{ borderLeft: `2px solid ${impactColor}` }}
              >
                <span className="text-[10px] font-mono shrink-0" style={{ color: "#5a7080", width: "50px" }}>
                  {time}
                </span>
                <span className="text-[10px] font-mono font-bold shrink-0" style={{ color: curColor, width: "28px" }}>
                  {ev.currency || ""}
                </span>
                <span className="text-[11px] truncate flex-1" style={{ color: "#c0d0e0" }} title={ev.event_name}>
                  {ev.event_name.length > 26 ? ev.event_name.slice(0, 26) + "…" : ev.event_name}
                </span>
                {ev.forecast && (
                  <span className="text-[9px] font-mono shrink-0" style={{ color: "#5a7080" }}>
                    F: {ev.forecast}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-1 text-center shrink-0">
        <span className="text-[9px] font-mono" style={{ color: "#5a7080" }}>View full calendar →</span>
      </div>
    </div>
  );
}

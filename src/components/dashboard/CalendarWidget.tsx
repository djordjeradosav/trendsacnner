import { useState, useEffect } from "react";
import { Calendar, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CURRENCY_COLORS } from "@/hooks/useEconomicCalendar";
import { supabase } from "@/integrations/supabase/client";

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
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodayEvents = async () => {
      setLoading(true);
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      const { data } = await supabase
        .from("economic_events")
        .select("*")
        .gte("scheduled_at", startOfDay)
        .lte("scheduled_at", endOfDay)
        .order("scheduled_at", { ascending: true });

      setEvents(data || []);
      setLoading(false);

      // If no events found for today, try fetching from external source
      if (!data || data.length === 0) {
        try {
          await supabase.functions.invoke("fetch-calendar");
          const { data: refreshed } = await supabase
            .from("economic_events")
            .select("*")
            .gte("scheduled_at", startOfDay)
            .lte("scheduled_at", endOfDay)
            .order("scheduled_at", { ascending: true });
          if (refreshed && refreshed.length > 0) {
            setEvents(refreshed);
          }
        } catch {
          // silently fail — edge function may not exist
        }
      }
    };
    fetchTodayEvents();
  }, []);

  const highImpact = events.filter((e) => e.impact === "high" || e.impact === "medium").slice(0, 6);
  const next = highImpact[0] || null;

  return (
    <div
      className="rounded-lg p-3 h-full flex flex-col cursor-pointer transition-colors bg-card border border-border hover:border-accent-foreground/20"
      onClick={() => navigate("/calendar")}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
          <span className="text-[12px] font-semibold text-card-foreground">Economic Calendar</span>
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
            <div key={i} className="h-6 rounded animate-pulse bg-secondary" />
          ))
        ) : highImpact.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No high-impact events today</p>
        ) : (
          highImpact.map((ev) => {
            const curColor = CURRENCY_COLORS[(ev.currency || "").toUpperCase()] || "hsl(var(--muted-foreground))";
            const impactColor = IMPACT_DOTS[ev.impact] || IMPACT_DOTS.low;
            const time = new Date(ev.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
            return (
              <div
                key={ev.id}
                className="flex items-center gap-1.5 py-1 px-1.5 rounded"
                style={{ borderLeft: `2px solid ${impactColor}` }}
              >
                <span className="text-[10px] font-mono shrink-0 text-muted-foreground" style={{ width: "50px" }}>
                  {time}
                </span>
                <span className="text-[10px] font-mono font-bold shrink-0" style={{ color: curColor, width: "28px" }}>
                  {ev.currency || ""}
                </span>
                <span className="text-[11px] truncate flex-1 text-foreground/80" title={ev.event_name}>
                  {ev.event_name.length > 26 ? ev.event_name.slice(0, 26) + "…" : ev.event_name}
                </span>
                {ev.forecast && (
                  <span className="text-[9px] font-mono shrink-0 text-muted-foreground">
                    F: {ev.forecast}
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

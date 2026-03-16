import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type EconomicEvent, getAffectedPairs, CURRENCY_COLORS } from "@/hooks/useEconomicCalendar";
import { Zap } from "lucide-react";

function formatCountdown(ms: number): { text: string; imminent: boolean } {
  if (ms <= 0) return { text: "NOW", imminent: true };

  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const imminent = totalSec < 300; // < 5 min

  if (d > 0) return { text: `${d}d ${h}h ${m}m`, imminent };
  if (h > 0) return { text: `${h}h ${m}m`, imminent };
  if (m > 0) return { text: `${m}m ${s.toString().padStart(2, "0")}s`, imminent };
  return { text: `${s}s`, imminent };
}

const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function NextEventCountdown({ variant = "full" }: { variant?: "full" | "pill" }) {
  const [event, setEvent] = useState<EconomicEvent | null>(null);
  const [now, setNow] = useState(Date.now());

  // Fetch next high-impact event
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("economic_events")
        .select("*")
        .eq("impact", "high")
        .eq("is_tentative", false)
        .is("actual", null)
        .gt("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) setEvent(data as EconomicEvent);
    };
    fetch();
    const id = setInterval(fetch, 60_000); // re-check every minute
    return () => clearInterval(id);
  }, []);

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!event) return null;

  const ms = new Date(event.scheduled_at).getTime() - now;
  const { text, imminent } = formatCountdown(ms);

  const timeLocal = new Date(event.scheduled_at).toLocaleTimeString("en-US", {
    timeZone: userTimezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const dayLocal = new Date(event.scheduled_at).toLocaleDateString("en-US", {
    timeZone: userTimezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const pairs = getAffectedPairs(event);
  const curColor = CURRENCY_COLORS[(event.currency || "").toUpperCase()] || "hsl(var(--muted-foreground))";

  // ── Pill variant (for MarketSessionBar / dashboard) ──
  if (variant === "pill") {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-md shrink-0 cursor-default"
        style={{
          background: imminent ? "hsl(0 70% 50% / 0.12)" : "hsl(var(--accent))",
          border: `1px solid ${imminent ? "hsl(0 70% 50% / 0.3)" : "hsl(var(--border))"}`,
        }}
        title={`${event.currency} ${event.event_name} at ${timeLocal}`}
      >
        <span className="text-[9px]">🔴</span>
        <span className="text-[10px] font-mono font-bold" style={{ color: curColor }}>
          {event.currency}
        </span>
        <span className="text-[10px] font-mono text-foreground/70 truncate max-w-[100px]">
          {event.event_name}
        </span>
        <span className="text-[9px] text-muted-foreground">·</span>
        <span
          className={`text-[10px] font-mono font-bold ${imminent ? "animate-pulse" : ""}`}
          style={{ color: imminent ? "#ef4444" : "hsl(var(--primary))" }}
        >
          {text}
        </span>
      </div>
    );
  }

  // ── Full variant (for CalendarPage) ──
  return (
    <div
      className="rounded-lg px-4 py-3 mb-3 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{
        background: imminent
          ? "hsl(0 70% 50% / 0.06)"
          : "hsl(var(--primary) / 0.04)",
        border: `1px solid ${imminent ? "hsl(0 70% 50% / 0.25)" : "hsl(var(--primary) / 0.15)"}`,
      }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <Zap
          className="w-4 h-4"
          style={{ color: imminent ? "#ef4444" : "hsl(var(--primary))" }}
        />
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: imminent ? "#ef4444" : "hsl(var(--primary))" }}
        >
          Next High Impact
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap flex-1">
        <span className="text-[12px] font-mono font-bold" style={{ color: curColor }}>
          {event.currency}
        </span>
        <span className="text-[13px] font-semibold text-foreground">
          {event.event_name}
        </span>
        <span className="text-[11px] text-muted-foreground font-mono">
          {dayLocal} at {timeLocal}
        </span>
        {event.forecast && (
          <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-accent border border-border">
            F: {event.forecast}{event.previous ? ` · P: ${event.previous}` : ""}
          </span>
        )}
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`text-lg font-mono font-bold tabular-nums ${imminent ? "animate-pulse" : ""}`}
          style={{ color: imminent ? "#ef4444" : "hsl(var(--primary))" }}
        >
          {text}
        </span>
      </div>

      {/* Pair chips */}
      {pairs.length > 0 && (
        <div className="flex items-center gap-1 shrink-0">
          {pairs.slice(0, 4).map((p) => (
            <span
              key={p}
              className="text-[9px] font-mono px-1 py-0.5 rounded bg-accent border border-border text-muted-foreground"
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

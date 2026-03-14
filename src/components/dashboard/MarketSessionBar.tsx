import { useState, useEffect, useMemo } from "react";

interface SessionInfo {
  name: string;
  status: "open" | "premarket" | "closed";
  label: string;
  countdown: string;
}

function getSessionInfo(now: Date): SessionInfo[] {
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const t = utcH * 60 + utcM;

  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
  };

  const session = (
    name: string,
    openMin: number,
    closeMin: number,
    preStart?: number
  ): SessionInfo => {
    const wraps = closeMin < openMin; // e.g. Sydney 22:00–06:00

    let isOpen: boolean;
    if (wraps) {
      isOpen = t >= openMin || t < closeMin;
    } else {
      isOpen = t >= openMin && t < closeMin;
    }

    const isPre = preStart !== undefined && !isOpen && t >= preStart && t < openMin;

    if (isOpen) {
      let remaining: number;
      if (wraps && t >= openMin) {
        remaining = 1440 - t + closeMin;
      } else if (wraps) {
        remaining = closeMin - t;
      } else {
        remaining = closeMin - t;
      }
      return { name, status: "open", label: "OPEN", countdown: `closes in ${fmt(remaining)}` };
    }

    if (isPre) {
      const remaining = openMin - t;
      return { name, status: "premarket", label: "PREMARKET", countdown: `opens in ${fmt(remaining)}` };
    }

    // closed — calculate time until open
    let untilOpen: number;
    if (wraps) {
      untilOpen = t < openMin ? openMin - t : openMin - t + 1440;
    } else {
      untilOpen = t < openMin ? openMin - t : 1440 - t + openMin;
    }
    return { name, status: "closed", label: "CLOSED", countdown: `opens in ${fmt(untilOpen)}` };
  };

  return [
    session("LONDON", 480, 990),          // 08:00–16:30
    session("NEW YORK", 810, 1200, 780),   // 13:30–20:00, pre 13:00
    session("SYDNEY", 1320, 360),          // 22:00–06:00
    session("ASIA", 0, 480),              // 00:00–08:00
  ];
}

function padZ(n: number) {
  return n.toString().padStart(2, "0");
}

export function MarketSessionBar() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const sessions = useMemo(() => getSessionInfo(now), [now]);

  // EST clock (UTC-5, simplified — no DST handling)
  const estOffset = -5;
  const estDate = new Date(now.getTime() + estOffset * 3600_000);
  const estStr = `${padZ(estDate.getUTCHours())}:${padZ(estDate.getUTCMinutes())}:${padZ(estDate.getUTCSeconds())} EST`;
  const utcStr = `${padZ(now.getUTCHours())}:${padZ(now.getUTCMinutes())}:${padZ(now.getUTCSeconds())} UTC`;

  return (
    <div
      className="flex items-center gap-6 rounded-lg px-3 py-3 overflow-x-auto"
      style={{
        background: "hsl(var(--card))",
        border: "0.5px solid hsl(var(--border))",
      }}
    >
      {sessions.map((s) => (
        <div key={s.name} className="flex items-center gap-2 shrink-0">
          {/* Status dot */}
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background:
                s.status === "open"
                  ? "hsl(var(--bullish))"
                  : s.status === "premarket"
                  ? "hsl(var(--caution))"
                  : "hsl(var(--border))",
            }}
          />
          {/* Session name */}
          <span
            className="font-display"
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {s.name}
          </span>
          {/* Status + countdown */}
          <span
            className="font-display"
            style={{
              fontSize: "10px",
              color:
                s.status === "open"
                  ? "hsl(var(--bullish))"
                  : s.status === "premarket"
                  ? "hsl(var(--caution))"
                  : "hsl(var(--muted-foreground))",
            }}
          >
            {s.label} {s.countdown}
          </span>
        </div>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Live clocks */}
      <div className="flex items-center gap-4 shrink-0">
        <span
          className="font-display tabular-nums"
          style={{ fontSize: "12px", color: "hsl(var(--bullish))", letterSpacing: "0.04em" }}
        >
          {estStr}
        </span>
        <span
          className="font-display tabular-nums"
          style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", letterSpacing: "0.04em" }}
        >
          {utcStr}
        </span>
      </div>
    </div>
  );
}

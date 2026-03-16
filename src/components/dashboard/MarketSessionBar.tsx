import { useState, useEffect, useMemo } from "react";
import { NextEventCountdown } from "@/components/calendar/NextEventCountdown";

interface SessionInfo {
  name: string;
  status: "open" | "premarket" | "closed";
  label: string;
  countdown: string;
}

function isForexWeekend(now: Date): boolean {
  // Forex market closes Friday 22:00 UTC and reopens Sunday 22:00 UTC
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  const utcH = now.getUTCHours();
  if (day === 6) return true; // All Saturday
  if (day === 0 && utcH < 22) return true; // Sunday before 22:00 UTC
  if (day === 5 && utcH >= 22) return true; // Friday after 22:00 UTC
  return false;
}

function getSessionInfo(now: Date): SessionInfo[] {
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const t = utcH * 60 + utcM;
  const weekend = isForexWeekend(now);

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
    // Force closed on weekends
    if (weekend) {
      return { name, status: "closed", label: "CLOSED", countdown: "weekend" };
    }

    const wraps = closeMin < openMin;

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

    let untilOpen: number;
    if (wraps) {
      untilOpen = t < openMin ? openMin - t : openMin - t + 1440;
    } else {
      untilOpen = t < openMin ? openMin - t : 1440 - t + openMin;
    }
    return { name, status: "closed", label: "CLOSED", countdown: `opens in ${fmt(untilOpen)}` };
  };

  return [
    session("LONDON", 480, 990),
    session("NEW YORK", 810, 1200, 780),
    session("SYDNEY", 1320, 360),
    session("ASIA", 0, 480),
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

  // Use Intl to get real US Eastern time (handles EST/EDT automatically)
  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  const etH = etParts.find(p => p.type === "hour")!.value;
  const etM = etParts.find(p => p.type === "minute")!.value;
  const etS = etParts.find(p => p.type === "second")!.value;
  const isDST = (() => {
    const jan = new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
    const nyOffset = -new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" })).getTimezoneOffset();
    // Compare NY offset: -5 in winter (EST), -4 in summer (EDT)
    const nyNow = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "short" }).format(now);
    return nyNow.includes("EDT");
  })();
  const etLabel = isDST ? "EDT" : "EST";
  const estStr = `${etH}:${etM}:${etS} ${etLabel}`;
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

      <NextEventCountdown variant="pill" />
      <div className="flex-1" />

      {/* Live clocks — seconds pulse */}
      <div className="flex items-center gap-4 shrink-0">
        <span
          className="font-display tabular-nums"
          style={{ fontSize: "12px", color: "hsl(var(--bullish))", letterSpacing: "0.04em" }}
        >
          {estStr.slice(0, -4)}
          <span className="anim-sec-pulse">{estStr.slice(-4)}</span>
        </span>
        <span
          className="font-display tabular-nums"
          style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", letterSpacing: "0.04em" }}
        >
          {utcStr.slice(0, -4)}
          <span className="anim-sec-pulse">{utcStr.slice(-4)}</span>
        </span>
      </div>
    </div>
  );
}

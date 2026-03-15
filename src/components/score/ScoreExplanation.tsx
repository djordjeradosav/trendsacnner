import React, { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ScoreExplanationProps {
  symbol: string;
  score: number;
  explanationLines: string[];
  scannedAt?: string | null;
}

export function ScoreExplanation({ symbol, score, explanationLines, scannedAt }: ScoreExplanationProps) {
  const timeAgo = scannedAt ? formatTimeAgo(new Date(scannedAt)) : "unknown";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center justify-center w-4 h-4 rounded-full transition-colors hover:bg-secondary"
          title="Why this score?"
        >
          <HelpCircle className="w-3 h-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 border-border"
        style={{ background: "hsl(var(--card))" }}
        side="bottom"
        align="start"
      >
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-foreground">
              {symbol} Trend Score: {score}/100
            </span>
          </div>
        </div>
        <div className="p-3 space-y-0.5 max-h-64 overflow-y-auto">
          {explanationLines.map((line, i) => {
            const isHeader = !line.startsWith("  ") && !line.startsWith("⚡");
            const isPositive = line.includes("✓");
            const isNegative = line.includes("✗");
            const isWarning = line.includes("⚠") || line.includes("⚡");

            return (
              <p
                key={i}
                className="font-mono"
                style={{
                  fontSize: isHeader ? "10px" : "9px",
                  fontWeight: isHeader ? 600 : 400,
                  color: isPositive
                    ? "hsl(var(--bullish))"
                    : isNegative
                    ? "hsl(var(--destructive))"
                    : isWarning
                    ? "hsl(var(--caution))"
                    : isHeader
                    ? "hsl(var(--foreground))"
                    : "hsl(var(--muted-foreground))",
                  marginTop: isHeader && i > 0 ? "6px" : "0",
                }}
              >
                {line}
              </p>
            );
          })}
        </div>
        <div className="px-3 py-2 border-t border-border">
          <span className="text-[9px] text-muted-foreground">Last updated: {timeAgo}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Score Freshness Badge ──────────────────────────────────────────────────

interface ScoreFreshnessProps {
  dataQuality: "full" | "no-social" | "no-news" | "technical-only";
  scannedAt?: string | null;
}

export function ScoreFreshnessBadge({ dataQuality, scannedAt }: ScoreFreshnessProps) {
  const minutesAgo = scannedAt
    ? (Date.now() - new Date(scannedAt).getTime()) / 60000
    : Infinity;

  let label: string;
  let color: string;
  let bgColor: string;

  if (dataQuality === "technical-only") {
    label = "Technical only";
    color = "hsl(var(--muted-foreground))";
    bgColor = "hsl(var(--muted) / 0.5)";
  } else if (dataQuality === "no-social" || dataQuality === "no-news") {
    label = dataQuality === "no-social" ? "Stale social" : "Stale news";
    color = "hsl(var(--caution))";
    bgColor = "hsl(var(--caution) / 0.1)";
  } else if (minutesAgo <= 15) {
    label = "Live";
    color = "hsl(var(--bullish))";
    bgColor = "hsl(var(--bullish) / 0.1)";
  } else if (minutesAgo <= 60) {
    label = "Recent";
    color = "hsl(var(--caution))";
    bgColor = "hsl(var(--caution) / 0.1)";
  } else {
    label = "Stale";
    color = "hsl(var(--muted-foreground))";
    bgColor = "hsl(var(--muted) / 0.5)";
  }

  return (
    <span
      className="text-[8px] font-mono px-1.5 py-0.5 rounded-full"
      style={{ color, background: bgColor, border: `1px solid ${color}30` }}
    >
      {label === "Live" && "● "}{label}
    </span>
  );
}

// ─── Event Risk Flag ────────────────────────────────────────────────────────

interface EventRiskFlagProps {
  eventName: string | null;
  eventTime: string | null;
}

export function EventRiskFlag({ eventName, eventTime }: EventRiskFlagProps) {
  if (!eventName) return null;

  const hoursAway = eventTime
    ? ((new Date(eventTime).getTime() - Date.now()) / 3600000).toFixed(1)
    : "?";

  return (
    <span
      className="text-[8px] font-mono px-1.5 py-0.5 rounded-full"
      style={{
        color: "hsl(var(--caution))",
        background: "hsl(var(--caution) / 0.1)",
        border: "1px solid hsl(var(--caution) / 0.3)",
      }}
    >
      ⚡ {eventName} in {hoursAway}h
    </span>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

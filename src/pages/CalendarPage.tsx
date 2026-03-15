import { useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useCalendarWeek,
  type EconomicEvent,
} from "@/hooks/useEconomicCalendar";
import { CalendarFilters } from "@/components/calendar/CalendarFilters";
import { CalendarTable } from "@/components/calendar/CalendarTable";
import { EventDetailDrawer } from "@/components/calendar/EventDetailDrawer";
import { ChevronLeft, ChevronRight, Calendar, RefreshCw } from "lucide-react";

const formatWeekRange = (start: Date, end: Date) => {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
};

export default function CalendarPage() {
  const {
    events, loading, weekStart, weekEnd,
    goNextWeek, goPrevWeek, goThisWeek, weekOffset, refetch,
  } = useCalendarWeek();

  const [impactFilter, setImpactFilter] = useState<string>("All");
  const [currencyFilters, setCurrencyFilters] = useState<string[]>([]);

  const toggleCurrency = useCallback((cur: string) => {
    setCurrencyFilters((prev) =>
      prev.includes(cur) ? prev.filter((c) => c !== cur) : [...prev, cur]
    );
  }, []);

  const filtered = useMemo(() => {
    let result = events;
    if (impactFilter === "High Impact Only") {
      result = result.filter((e) => e.impact === "high");
    } else if (impactFilter === "Medium+") {
      result = result.filter((e) => e.impact === "high" || e.impact === "medium");
    }
    if (currencyFilters.length > 0) {
      result = result.filter((e) =>
        currencyFilters.includes((e.currency || "").toUpperCase())
      );
    }
    return result;
  }, [events, impactFilter, currencyFilters]);

  const eventCount = filtered.length;
  const highCount = filtered.filter((e) => e.impact === "high").length;

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg shrink-0 bg-secondary border border-border">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-primary" />
            <h1 className="text-[15px] font-semibold text-foreground">
              Economic Calendar
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent text-muted-foreground">
              {eventCount} events · {highCount} high impact
            </span>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={goPrevWeek}
              className="p-1.5 rounded transition-colors hover:bg-accent"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="flex items-center gap-2 px-3 py-1 rounded bg-accent border border-border">
              <span className="text-[12px] font-semibold text-foreground">
                This Week:
              </span>
              <span className="text-[12px] font-mono text-primary">
                {formatWeekRange(weekStart, weekEnd)}
              </span>
            </div>

            <button
              onClick={goNextWeek}
              className="p-1.5 rounded transition-colors hover:bg-accent"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {weekOffset !== 0 && (
              <button
                onClick={goThisWeek}
                className="text-[10px] font-mono px-2 py-1 rounded transition-colors ml-1 bg-accent border border-border text-primary"
              >
                Today
              </button>
            )}

            <button
              onClick={refetch}
              className="p-1.5 rounded transition-colors hover:bg-accent ml-1"
              title="Refresh data"
            >
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <CalendarFilters
          impactFilter={impactFilter}
          setImpactFilter={setImpactFilter}
          currencyFilters={currencyFilters}
          toggleCurrency={toggleCurrency}
        />

        {/* Legend */}
        <div className="flex items-center gap-4 mb-2 px-1">
          <div className="flex items-center gap-1">
            <span className="flex gap-[1px]">
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#ef4444" }} />
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#ef4444" }} />
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#ef4444" }} />
            </span>
            <span className="text-[10px] text-muted-foreground">High</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex gap-[1px]">
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#f59e0b" }} />
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#f59e0b" }} />
              <span className="w-[4px] h-3 rounded-[1px] bg-border" />
            </span>
            <span className="text-[10px] text-muted-foreground">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex gap-[1px]">
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#22c55e" }} />
              <span className="w-[4px] h-3 rounded-[1px] bg-border" />
              <span className="w-[4px] h-3 rounded-[1px] bg-border" />
            </span>
            <span className="text-[10px] text-muted-foreground">Low</span>
          </div>
          <span className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-bullish">Green</span>
            <span className="text-[10px] text-muted-foreground">= Better than forecast</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-bearish">Red</span>
            <span className="text-[10px] text-muted-foreground">= Worse than forecast</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
          {loading ? (
            <div className="space-y-0">
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse"
                  style={{
                    borderBottom: "1px solid hsl(var(--border))",
                    background: i % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--background))",
                  }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              No events found for this week.
            </div>
          ) : (
            <CalendarTable events={filtered} />
          )}
        </div>
      </div>
      <EventDetailDrawer />
    </AppLayout>
  );
}

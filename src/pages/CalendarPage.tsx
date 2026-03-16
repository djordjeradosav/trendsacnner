import { useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useCalendarWeek,
  type EconomicEvent,
} from "@/hooks/useEconomicCalendar";
import { CalendarFilters } from "@/components/calendar/CalendarFilters";
import { CalendarTable } from "@/components/calendar/CalendarTable";
import { EventDetailDrawer } from "@/components/calendar/EventDetailDrawer";
import { NextEventCountdown } from "@/components/calendar/NextEventCountdown";
import { ChevronLeft, ChevronRight, Calendar, RefreshCw, Loader2 } from "lucide-react";

const formatWeekRange = (start: Date, end: Date) => {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const yearOpts: Intl.DateTimeFormatOptions = { ...opts, year: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", yearOpts)}`;
};

export default function CalendarPage() {
  const {
    events, loading, refreshing, weekStart, weekEnd,
    goNextWeek, goPrevWeek, goThisWeek, weekOffset, refetch,
  } = useCalendarWeek();

  const [impactFilter, setImpactFilter] = useState<string>("All");
  const [currencyFilters, setCurrencyFilters] = useState<string[]>([]);
  const [hideHolidays, setHideHolidays] = useState(true);

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
    if (hideHolidays) {
      result = result.filter((e) => e.impact !== "holiday");
    }
    if (currencyFilters.length > 0) {
      result = result.filter((e) =>
        currencyFilters.includes((e.currency || "").toUpperCase())
      );
    }
    return result;
  }, [events, impactFilter, currencyFilters, hideHolidays]);

  const eventCount = filtered.length;
  const highCount = filtered.filter((e) => e.impact === "high").length;
  const medCount = filtered.filter((e) => e.impact === "medium").length;
  const lowCount = filtered.filter((e) => e.impact === "low").length;

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 px-3 py-2 rounded-lg shrink-0 bg-secondary border border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-[15px] font-semibold text-foreground">
              Economic Calendar
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent text-muted-foreground whitespace-nowrap">
              {eventCount} events · {highCount} high · {medCount} med · {lowCount} low
            </span>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={goPrevWeek}
              className="p-1.5 rounded transition-colors hover:bg-accent"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent border border-border">
              {weekOffset === 0 && (
                <span className="text-[11px] font-semibold text-foreground hidden sm:inline">
                  This Week:
                </span>
              )}
              <span className="text-[11px] font-mono text-primary">
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
                className="text-[10px] font-mono px-2 py-1 rounded transition-colors bg-accent border border-border text-primary"
              >
                Today
              </button>
            )}

            <button
              onClick={refetch}
              disabled={refreshing}
              className="p-1.5 rounded transition-colors hover:bg-accent disabled:opacity-50"
              title="Refresh calendar data"
            >
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Filters */}
        <CalendarFilters
          impactFilter={impactFilter}
          setImpactFilter={setImpactFilter}
          currencyFilters={currencyFilters}
          toggleCurrency={toggleCurrency}
          hideHolidays={hideHolidays}
          setHideHolidays={setHideHolidays}
        />

        {/* Legend */}
        <div className="flex items-center gap-3 mb-2 px-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 shrink-0">
            <span className="flex gap-[1px]">
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#ef4444" }} />
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#ef4444" }} />
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#ef4444" }} />
            </span>
            <span className="text-[10px] text-muted-foreground">High</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="flex gap-[1px]">
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#f59e0b" }} />
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#f59e0b" }} />
              <span className="w-[4px] h-3 rounded-[1px] bg-border" />
            </span>
            <span className="text-[10px] text-muted-foreground">Medium</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="flex gap-[1px]">
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#22c55e" }} />
              <span className="w-[4px] h-3 rounded-[1px] bg-border" />
              <span className="w-[4px] h-3 rounded-[1px] bg-border" />
            </span>
            <span className="text-[10px] text-muted-foreground">Low</span>
          </div>
          <span className="w-px h-4 bg-border shrink-0" />
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-bold text-bullish">Green</span>
            <span className="text-[10px] text-muted-foreground">= Beat</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-bold text-bearish">Red</span>
            <span className="text-[10px] text-muted-foreground">= Miss</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">Loading calendar data...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <span className="text-sm text-muted-foreground">No events found for this week.</span>
              <button
                onClick={refetch}
                className="text-xs text-primary hover:underline"
              >
                Refresh calendar data
              </button>
            </div>
          ) : (
            <div className="min-w-[700px]">
              <CalendarTable events={filtered} />
            </div>
          )}
        </div>
      </div>
      <EventDetailDrawer />
    </AppLayout>
  );
}

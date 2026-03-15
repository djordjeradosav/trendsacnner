import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useCalendarWeek,
  getFlag,
  getAffectedPairs,
  CURRENCY_COLORS,
  type EconomicEvent,
} from "@/hooks/useEconomicCalendar";
import { CalendarFilters } from "@/components/calendar/CalendarFilters";
import { CalendarTable } from "@/components/calendar/CalendarTable";
import { EventDetailDrawer } from "@/components/calendar/EventDetailDrawer";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const formatWeekRange = (start: Date, end: Date) => {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
};

export default function CalendarPage() {
  const {
    events, loading, weekStart, weekEnd,
    goNextWeek, goPrevWeek, goThisWeek, weekOffset,
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
    }
    if (currencyFilters.length > 0) {
      result = result.filter((e) =>
        currencyFilters.includes((e.currency || "").toUpperCase())
      );
    }
    return result;
  }, [events, impactFilter, currencyFilters]);

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Economic Calendar</h1>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goPrevWeek}
              className="p-1.5 rounded hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-xs font-mono text-foreground min-w-[160px] text-center">
              {formatWeekRange(weekStart, weekEnd)}
            </span>
            <button
              onClick={goNextWeek}
              className="p-1.5 rounded hover:bg-secondary transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={goThisWeek}
                className="text-[10px] font-mono px-2 py-1 rounded border border-border bg-secondary text-primary hover:bg-accent transition-colors ml-1"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <CalendarFilters
          impactFilter={impactFilter}
          setImpactFilter={setImpactFilter}
          currencyFilters={currencyFilters}
          toggleCurrency={toggleCurrency}
        />

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
          {loading ? (
            <div className="space-y-0">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 border-b border-border animate-pulse"
                  style={{ background: i % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--secondary))" }}
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
    </AppLayout>
  );
}

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
        {/* Top bar — ForexFactory style */}
        <div
          className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg shrink-0"
          style={{ background: "#131a22", border: "1px solid #1e2d3d" }}
        >
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
            <h1 className="text-[15px] font-semibold" style={{ color: "#e0ecf4" }}>
              Economic Calendar
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: "#1a2535", color: "#5a7080" }}>
              {eventCount} events · {highCount} high impact
            </span>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={goPrevWeek}
              className="p-1.5 rounded transition-colors hover:bg-[#1a2535]"
            >
              <ChevronLeft className="w-4 h-4" style={{ color: "#8fa3b8" }} />
            </button>

            <div
              className="flex items-center gap-2 px-3 py-1 rounded"
              style={{ background: "#1a2535", border: "1px solid #2a3f55" }}
            >
              <span className="text-[12px] font-semibold" style={{ color: "#e0ecf4" }}>
                This Week:
              </span>
              <span className="text-[12px] font-mono" style={{ color: "hsl(var(--primary))" }}>
                {formatWeekRange(weekStart, weekEnd)}
              </span>
            </div>

            <button
              onClick={goNextWeek}
              className="p-1.5 rounded transition-colors hover:bg-[#1a2535]"
            >
              <ChevronRight className="w-4 h-4" style={{ color: "#8fa3b8" }} />
            </button>

            {weekOffset !== 0 && (
              <button
                onClick={goThisWeek}
                className="text-[10px] font-mono px-2 py-1 rounded transition-colors ml-1"
                style={{ background: "#1a2535", border: "1px solid #2a3f55", color: "hsl(var(--primary))" }}
              >
                Today
              </button>
            )}

            <button
              onClick={refetch}
              className="p-1.5 rounded transition-colors hover:bg-[#1a2535] ml-1"
              title="Refresh data"
            >
              <RefreshCw className="w-3.5 h-3.5" style={{ color: "#5a7080" }} />
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
            <span className="text-[10px]" style={{ color: "#5a7080" }}>High</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex gap-[1px]">
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#f59e0b" }} />
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#f59e0b" }} />
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#1e2d3d" }} />
            </span>
            <span className="text-[10px]" style={{ color: "#5a7080" }}>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex gap-[1px]">
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#22c55e" }} />
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#1e2d3d" }} />
              <span className="w-[4px] h-3 rounded-[1px]" style={{ background: "#1e2d3d" }} />
            </span>
            <span className="text-[10px]" style={{ color: "#5a7080" }}>Low</span>
          </div>
          <span className="w-px h-4" style={{ background: "#1e2d3d" }} />
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold" style={{ color: "#22c55e" }}>Green</span>
            <span className="text-[10px]" style={{ color: "#5a7080" }}>= Better than forecast</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold" style={{ color: "#ef4444" }}>Red</span>
            <span className="text-[10px]" style={{ color: "#5a7080" }}>= Worse than forecast</span>
          </div>
        </div>

        {/* Table */}
        <div
          className="flex-1 min-h-0 overflow-auto rounded-lg"
          style={{ border: "1px solid #1e2d3d" }}
        >
          {loading ? (
            <div className="space-y-0">
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse"
                  style={{
                    borderBottom: "1px solid #1e2d3d",
                    background: i % 2 === 0 ? "#0d1117" : "#111820",
                  }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: "#5a7080" }}>
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

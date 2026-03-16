import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EconomicEvent {
  id: string;
  event_name: string;
  country: string | null;
  impact: string;
  scheduled_at: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  currency: string | null;
  is_tentative?: boolean;
}

const COUNTRY_FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
  CHF: "🇨🇭", AUD: "🇦🇺", CAD: "🇨🇦", NZD: "🇳🇿",
  CNY: "🇨🇳", US: "🇺🇸", EU: "🇪🇺", GB: "🇬🇧",
  JP: "🇯🇵", CH: "🇨🇭", AU: "🇦🇺", CA: "🇨🇦", NZ: "🇳🇿",
};

export const CURRENCY_COLORS: Record<string, string> = {
  USD: "#2563eb",
  EUR: "#16a34a",
  GBP: "#7c3aed",
  JPY: "#dc2626",
  AUD: "#d97706",
  CAD: "#ea580c",
  CHF: "#0891b2",
  NZD: "#0d9488",
  CNY: "#dc2626",
};

const CURRENCY_PAIRS: Record<string, string[]> = {
  USD: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "USDCAD", "USDCHF", "AUDUSD", "NZDUSD"],
  EUR: ["EURUSD", "EURGBP", "EURJPY", "EURCHF", "EURAUD", "EURCAD"],
  GBP: ["GBPUSD", "EURGBP", "GBPJPY", "GBPAUD", "GBPCAD"],
  JPY: ["USDJPY", "EURJPY", "GBPJPY", "AUDJPY", "CADJPY"],
  AUD: ["AUDUSD", "AUDCAD", "AUDJPY", "AUDNZD", "XAUUSD"],
  CAD: ["USDCAD", "AUDCAD", "CADJPY", "EURCAD"],
  CHF: ["USDCHF", "EURCHF", "GBPCHF"],
  NZD: ["NZDUSD", "AUDNZD", "NZDJPY"],
  CNY: ["USDCNH"],
};

const EVENT_PAIR_MAP: Record<string, string[]> = {
  NFP: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"],
  "Non-Farm": ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"],
  CPI: ["EURUSD", "GBPUSD", "USDJPY"],
  "Interest Rate": ["EURUSD", "GBPUSD", "USDJPY", "USDCHF"],
  GDP: ["EURUSD", "GBPUSD", "USDJPY"],
  PMI: ["EURUSD", "GBPUSD"],
  Unemployment: ["EURUSD", "GBPUSD", "USDJPY"],
};

export function getFlag(currency: string | null): string {
  if (!currency) return "🌐";
  return COUNTRY_FLAGS[currency.toUpperCase()] || "🌐";
}

export function getAffectedPairs(event: EconomicEvent): string[] {
  for (const [keyword, pairs] of Object.entries(EVENT_PAIR_MAP)) {
    if (event.event_name.toLowerCase().includes(keyword.toLowerCase())) {
      return pairs;
    }
  }
  const cur = (event.currency || "").toUpperCase();
  if (!cur) return [];
  return CURRENCY_PAIRS[cur] || [];
}

/** Get the start of a week (Sunday) for a given date */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function useEconomicCalendar(limit?: number) {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      const now = new Date().toISOString();
      let q = supabase
        .from("economic_events")
        .select("*")
        .gte("scheduled_at", now)
        .order("scheduled_at", { ascending: true });

      if (limit) q = q.limit(limit);

      const { data } = await q;
      setEvents((data as EconomicEvent[]) || []);
      setLoading(false);
    };
    fetchEvents();
  }, [limit]);

  const nextHighImpact = useMemo(() => {
    return events.find((e) => e.impact === "high") || null;
  }, [events]);

  return { events, loading, nextHighImpact };
}

/** Full calendar hook with week navigation — fetches 3 weeks of data */
export function useCalendarWeek() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const weekStart = useMemo(() => {
    const now = new Date();
    const start = getWeekStart(now);
    start.setDate(start.getDate() + weekOffset * 7);
    return start;
  }, [weekOffset]);

  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);

  const fetchWeek = useCallback(async () => {
    setLoading(true);

    // Fetch the selected week's events
    const { data } = await supabase
      .from("economic_events")
      .select("*")
      .gte("scheduled_at", weekStart.toISOString())
      .lte("scheduled_at", weekEnd.toISOString())
      .order("scheduled_at", { ascending: true });

    const fetched = (data as EconomicEvent[]) || [];
    setEvents(fetched);
    setLoading(false);

    // If no events found, auto-trigger the edge function to populate data
    if (fetched.length === 0 && !refreshing) {
      triggerCalendarRefresh().then(() => {
        // Refetch after the edge function has had time to populate
        setTimeout(async () => {
          const { data: retryData } = await supabase
            .from("economic_events")
            .select("*")
            .gte("scheduled_at", weekStart.toISOString())
            .lte("scheduled_at", weekEnd.toISOString())
            .order("scheduled_at", { ascending: true });
          if (retryData && retryData.length > 0) {
            setEvents(retryData as EconomicEvent[]);
          }
        }, 3000);
      });
    }
  }, [weekStart, weekEnd]);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  const triggerCalendarRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("fetch-ff-calendar");
    } catch (e) {
      console.warn("Calendar refresh failed:", e);
    }
    setRefreshing(false);
  }, []);

  const refetch = useCallback(async () => {
    await triggerCalendarRefresh();
    // Wait a moment for data to be inserted, then refetch
    setTimeout(() => fetchWeek(), 2000);
  }, [triggerCalendarRefresh, fetchWeek]);

  return {
    events,
    loading,
    refreshing,
    weekStart,
    weekEnd,
    weekOffset,
    goNextWeek: () => setWeekOffset((o) => o + 1),
    goPrevWeek: () => setWeekOffset((o) => o - 1),
    goThisWeek: () => setWeekOffset(0),
    refetch,
  };
}

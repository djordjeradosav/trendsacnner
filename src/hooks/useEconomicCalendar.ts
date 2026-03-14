import { useState, useEffect, useMemo } from "react";
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
}

const COUNTRY_FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
  CHF: "🇨🇭", AUD: "🇦🇺", CAD: "🇨🇦", NZD: "🇳🇿",
  CNY: "🇨🇳", US: "🇺🇸", EU: "🇪🇺", GB: "🇬🇧",
  JP: "🇯🇵", CH: "🇨🇭", AU: "🇦🇺", CA: "🇨🇦", NZ: "🇳🇿",
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
  // Check keyword-based mapping
  for (const [keyword, pairs] of Object.entries(EVENT_PAIR_MAP)) {
    if (event.event_name.toLowerCase().includes(keyword.toLowerCase())) {
      return pairs;
    }
  }
  // Fallback: currency-based
  const cur = (event.currency || "").toUpperCase();
  if (!cur) return [];
  const majorPairs: Record<string, string[]> = {
    USD: ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD"],
    EUR: ["EURUSD", "EURGBP", "EURJPY"],
    GBP: ["GBPUSD", "EURGBP", "GBPJPY"],
    JPY: ["USDJPY", "EURJPY", "GBPJPY"],
    AUD: ["AUDUSD", "AUDCAD"],
    CAD: ["USDCAD", "AUDCAD"],
    CHF: ["USDCHF", "EURCHF"],
    NZD: ["NZDUSD"],
  };
  return majorPairs[cur] || [];
}

export function useEconomicCalendar(limit?: number) {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
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
    fetch();
  }, [limit]);

  const nextHighImpact = useMemo(() => {
    return events.find((e) => e.impact === "high") || null;
  }, [events]);

  return { events, loading, nextHighImpact };
}

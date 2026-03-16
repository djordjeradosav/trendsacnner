import { useState, useCallback } from "react";
import { TIMEFRAME_ORDER, TIMEFRAME_CONFIG, type TimeframeConfig } from "@/config/timeframes";

export interface TimeframeOption {
  value: string;
  label: string;
}

// Legacy export for backwards compat
export const timeframeOptions: TimeframeOption[] = TIMEFRAME_ORDER.map((tf) => ({
  value: tf,
  label: TIMEFRAME_CONFIG[tf].label,
}));

const STORAGE_KEY = "trendscan_timeframe";

function getStoredTimeframe(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && TIMEFRAME_ORDER.includes(stored as any)) {
      return stored;
    }
  } catch {}
  return "1h";
}

export function useTimeframe() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(getStoredTimeframe);

  const setTimeframe = useCallback((tf: string) => {
    setSelectedTimeframe(tf);
    try {
      localStorage.setItem(STORAGE_KEY, tf);
    } catch {}
  }, []);

  const currentConfig: TimeframeConfig = TIMEFRAME_CONFIG[selectedTimeframe] ?? TIMEFRAME_CONFIG["1h"];

  return { selectedTimeframe, setTimeframe, timeframeOptions, currentConfig };
}

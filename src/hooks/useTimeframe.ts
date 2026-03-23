import { useState, useCallback } from "react";

export interface TimeframeOption {
  value: string;
  label: string;
}

export const timeframeOptions: TimeframeOption[] = [
  { value: "5min", label: "5M" },
  { value: "15min", label: "15M" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1day", label: "1D" },
];

const STORAGE_KEY = "trendscan_timeframe";

function getStoredTimeframe(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && timeframeOptions.some((o) => o.value === stored)) {
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

  return { selectedTimeframe, setTimeframe, timeframeOptions };
}

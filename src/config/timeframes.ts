export interface TimeframeConfig {
  label: string;
  apiInterval: string;
  candleLimit: number;
  emaFast: number;
  emaMid: number;
  emaSlow: number;
  rsiPeriod: number;
  adxPeriod: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  bbPeriod: number;
  refreshInterval: number;
  scoreLabel: string;
  color: string;
  description: string;
  group: "scalp" | "intraday" | "swing" | "daily";
}

export const TIMEFRAME_CONFIG: Record<string, TimeframeConfig> = {
  "1min": {
    label: "1M",
    apiInterval: "1min",
    candleLimit: 100,
    emaFast: 8,
    emaMid: 21,
    emaSlow: 55,
    rsiPeriod: 7,
    adxPeriod: 7,
    macdFast: 5,
    macdSlow: 13,
    macdSignal: 4,
    bbPeriod: 14,
    refreshInterval: 60,
    scoreLabel: "Scalp",
    color: "#f87171",
    description: "Scalping — extreme short term, high noise",
    group: "scalp",
  },
  "3min": {
    label: "3M",
    apiInterval: "3min",
    candleLimit: 100,
    emaFast: 8,
    emaMid: 21,
    emaSlow: 55,
    rsiPeriod: 9,
    adxPeriod: 9,
    macdFast: 6,
    macdSlow: 14,
    macdSignal: 5,
    bbPeriod: 14,
    refreshInterval: 180,
    scoreLabel: "Scalp",
    color: "#fb923c",
    description: "Short-term scalping",
    group: "scalp",
  },
  "5min": {
    label: "5M",
    apiInterval: "5min",
    candleLimit: 120,
    emaFast: 9,
    emaMid: 21,
    emaSlow: 50,
    rsiPeriod: 9,
    adxPeriod: 10,
    macdFast: 8,
    macdSlow: 17,
    macdSignal: 6,
    bbPeriod: 15,
    refreshInterval: 300,
    scoreLabel: "Intraday",
    color: "#f59e0b",
    description: "Intraday — most popular short timeframe",
    group: "intraday",
  },
  "15min": {
    label: "15M",
    apiInterval: "15min",
    candleLimit: 150,
    emaFast: 9,
    emaMid: 21,
    emaSlow: 50,
    rsiPeriod: 14,
    adxPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    bbPeriod: 20,
    refreshInterval: 900,
    scoreLabel: "Intraday",
    color: "#a3e635",
    description: "Intraday swing",
    group: "intraday",
  },
  "30min": {
    label: "30M",
    apiInterval: "30min",
    candleLimit: 150,
    emaFast: 9,
    emaMid: 21,
    emaSlow: 50,
    rsiPeriod: 14,
    adxPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    bbPeriod: 20,
    refreshInterval: 1800,
    scoreLabel: "Swing",
    color: "#22d3ee",
    description: "Short-term swing",
    group: "swing",
  },
  "1h": {
    label: "1H",
    apiInterval: "1h",
    candleLimit: 200,
    emaFast: 20,
    emaMid: 50,
    emaSlow: 200,
    rsiPeriod: 14,
    adxPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    bbPeriod: 20,
    refreshInterval: 3600,
    scoreLabel: "Swing",
    color: "#60a5fa",
    description: "Standard swing trading",
    group: "swing",
  },
  "4h": {
    label: "4H",
    apiInterval: "4h",
    candleLimit: 200,
    emaFast: 20,
    emaMid: 50,
    emaSlow: 200,
    rsiPeriod: 14,
    adxPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    bbPeriod: 20,
    refreshInterval: 14400,
    scoreLabel: "Position",
    color: "#818cf8",
    description: "Position trading",
    group: "daily",
  },
  "1day": {
    label: "1D",
    apiInterval: "1day",
    candleLimit: 250,
    emaFast: 20,
    emaMid: 50,
    emaSlow: 200,
    rsiPeriod: 14,
    adxPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    bbPeriod: 20,
    refreshInterval: 86400,
    scoreLabel: "Daily",
    color: "#a78bfa",
    description: "Daily swing and trend",
    group: "daily",
  },
};

export const TIMEFRAME_ORDER = [
  "1min",
  "3min",
  "5min",
  "15min",
  "30min",
  "1h",
  "4h",
  "1day",
] as const;

export type TimeframeKey = (typeof TIMEFRAME_ORDER)[number];

export function getTimeframeConfig(tf: string): TimeframeConfig {
  return TIMEFRAME_CONFIG[tf] ?? TIMEFRAME_CONFIG["1h"];
}

export function formatRefreshInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return "1 day";
}

export const TIMEFRAME_GROUPS = [
  { key: "scalp", label: "SCALP", timeframes: ["1min", "3min"] },
  { key: "intraday", label: "INTRADAY", timeframes: ["5min", "15min"] },
  { key: "swing", label: "SWING", timeframes: ["30min", "1h"] },
  { key: "daily", label: "POSITION", timeframes: ["4h", "1day"] },
] as const;

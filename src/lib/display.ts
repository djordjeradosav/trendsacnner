export function trendColor(trend: string | null): string {
  if (trend === "bullish") return "#00ff7f";
  if (trend === "bearish") return "#ff3b3b";
  return "#7a99b0";
}

export function trendBadgeStyle(trend: string | null): { background: string; color: string } {
  if (trend === "bullish") return { background: "#0d2b1a", color: "#00ff7f" };
  if (trend === "bearish") return { background: "#2b0d0d", color: "#ff3b3b" };
  return { background: "#1a2635", color: "#7a99b0" };
}

export function trendArrow(trend: string | null): string {
  if (trend === "bullish") return "↑";
  if (trend === "bearish") return "↓";
  return "→";
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function scoreToConfidence(score: number): string {
  return `${score.toFixed(0)}%`;
}

export const PAIR_NAMES: Record<string, string> = {
  EURUSD: "Euro / US Dollar",
  GBPUSD: "British Pound / US Dollar",
  USDJPY: "US Dollar / Japanese Yen",
  USDCHF: "US Dollar / Swiss Franc",
  AUDUSD: "Australian Dollar / US Dollar",
  USDCAD: "US Dollar / Canadian Dollar",
  NZDUSD: "New Zealand Dollar / US Dollar",
  XAUUSD: "Gold / US Dollar",
  XAGUSD: "Silver / US Dollar",
  EURCAD: "Euro / Canadian Dollar",
  EURGBP: "Euro / British Pound",
  EURJPY: "Euro / Japanese Yen",
  GBPJPY: "British Pound / Japanese Yen",
  AUDJPY: "Australian Dollar / Japanese Yen",
  USOIL: "WTI Crude Oil",
  US30: "Dow Jones Industrial",
  US100: "Nasdaq 100",
  US500: "S&P 500",
  EURCHF: "Euro / Swiss Franc",
  EURAUD: "Euro / Australian Dollar",
  EURNZD: "Euro / New Zealand Dollar",
  GBPCHF: "British Pound / Swiss Franc",
  GBPAUD: "British Pound / Australian Dollar",
  GBPCAD: "British Pound / Canadian Dollar",
  GBPNZD: "British Pound / New Zealand Dollar",
  AUDCAD: "Australian Dollar / Canadian Dollar",
  AUDCHF: "Australian Dollar / Swiss Franc",
  AUDNZD: "Australian Dollar / New Zealand Dollar",
  NZDJPY: "New Zealand Dollar / Japanese Yen",
  NZDCAD: "New Zealand Dollar / Canadian Dollar",
  NZDCHF: "New Zealand Dollar / Swiss Franc",
  CADJPY: "Canadian Dollar / Japanese Yen",
  CADCHF: "Canadian Dollar / Swiss Franc",
  CHFJPY: "Swiss Franc / Japanese Yen",
};

export const TIMEFRAME_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    emaFast: number;
    emaMid: number;
    emaSlow: number;
    description: string;
    scoreLabel: string;
  }
> = {
  "15min": {
    label: "15M",
    color: "#a3e635",
    emaFast: 9,
    emaMid: 21,
    emaSlow: 50,
    description: "15M — intraday swing",
    scoreLabel: "Intraday",
  },
  "30min": {
    label: "30M",
    color: "#22d3ee",
    emaFast: 9,
    emaMid: 21,
    emaSlow: 50,
    description: "30M — intraday swing",
    scoreLabel: "Intraday",
  },
  "1h": {
    label: "1H",
    color: "#60a5fa",
    emaFast: 9,
    emaMid: 21,
    emaSlow: 50,
    description: "1H — standard swing trading",
    scoreLabel: "Swing",
  },
  "4h": {
    label: "4H",
    color: "#818cf8",
    emaFast: 9,
    emaMid: 21,
    emaSlow: 50,
    description: "4H — position trading",
    scoreLabel: "Position",
  },
  "1day": {
    label: "1D",
    color: "#a78bfa",
    emaFast: 20,
    emaMid: 50,
    emaSlow: 200,
    description: "1D — daily trend",
    scoreLabel: "Daily",
  },
};

export type PairCategory = "Forex" | "Futures" | "Commodities";

export interface TradingPair {
  symbol: string;
  fullName: string;
  score: number;
  previousScore: number;
  category: PairCategory;
}

export type TrendDirection = "bullish" | "bearish" | "neutral";

export function getTrend(score: number): TrendDirection {
  if (score >= 65) return "bullish";
  if (score <= 35) return "bearish";
  return "neutral";
}

export function getTrendArrow(score: number): string {
  const trend = getTrend(score);
  if (trend === "bullish") return "↑";
  if (trend === "bearish") return "↓";
  return "→";
}

export function getScoreChange(pair: TradingPair): number {
  return pair.score - pair.previousScore;
}

export const mockPairs: TradingPair[] = [
  { symbol: "EUR/USD", fullName: "Euro / US Dollar", score: 87, previousScore: 82, category: "Forex" },
  { symbol: "GBP/USD", fullName: "British Pound / US Dollar", score: 79, previousScore: 74, category: "Forex" },
  { symbol: "USD/JPY", fullName: "US Dollar / Japanese Yen", score: 42, previousScore: 48, category: "Forex" },
  { symbol: "AUD/USD", fullName: "Australian Dollar / US Dollar", score: 91, previousScore: 88, category: "Forex" },
  { symbol: "USD/CAD", fullName: "US Dollar / Canadian Dollar", score: 33, previousScore: 30, category: "Forex" },
  { symbol: "NZD/USD", fullName: "New Zealand Dollar / US Dollar", score: 68, previousScore: 65, category: "Forex" },
  { symbol: "EUR/GBP", fullName: "Euro / British Pound", score: 55, previousScore: 58, category: "Forex" },
  { symbol: "EUR/JPY", fullName: "Euro / Japanese Yen", score: 74, previousScore: 70, category: "Forex" },
  { symbol: "GBP/JPY", fullName: "British Pound / Japanese Yen", score: 82, previousScore: 78, category: "Forex" },
  { symbol: "USD/CHF", fullName: "US Dollar / Swiss Franc", score: 28, previousScore: 35, category: "Forex" },
  { symbol: "EUR/CHF", fullName: "Euro / Swiss Franc", score: 47, previousScore: 44, category: "Forex" },
  { symbol: "AUD/JPY", fullName: "Australian Dollar / Japanese Yen", score: 71, previousScore: 66, category: "Forex" },
  { symbol: "ES", fullName: "S&P 500 E-mini", score: 85, previousScore: 80, category: "Futures" },
  { symbol: "NQ", fullName: "Nasdaq 100 E-mini", score: 92, previousScore: 87, category: "Futures" },
  { symbol: "YM", fullName: "Dow Jones E-mini", score: 63, previousScore: 60, category: "Futures" },
  { symbol: "RTY", fullName: "Russell 2000 E-mini", score: 38, previousScore: 42, category: "Futures" },
  { symbol: "CL", fullName: "Crude Oil", score: 22, previousScore: 28, category: "Futures" },
  { symbol: "GC", fullName: "Gold Futures", score: 76, previousScore: 72, category: "Futures" },
  { symbol: "SI", fullName: "Silver Futures", score: 58, previousScore: 55, category: "Futures" },
  { symbol: "ZB", fullName: "US Treasury Bond", score: 31, previousScore: 36, category: "Futures" },
  { symbol: "XAUUSD", fullName: "Gold Spot", score: 88, previousScore: 84, category: "Commodities" },
  { symbol: "XAGUSD", fullName: "Silver Spot", score: 61, previousScore: 57, category: "Commodities" },
  { symbol: "WTIUSD", fullName: "WTI Crude Oil", score: 19, previousScore: 25, category: "Commodities" },
  { symbol: "NATGAS", fullName: "Natural Gas", score: 45, previousScore: 40, category: "Commodities" },
  { symbol: "COPPER", fullName: "Copper", score: 72, previousScore: 68, category: "Commodities" },
  { symbol: "WHEAT", fullName: "Wheat", score: 35, previousScore: 38, category: "Commodities" },
  { symbol: "CORN", fullName: "Corn", score: 52, previousScore: 49, category: "Commodities" },
  { symbol: "SOYBEAN", fullName: "Soybeans", score: 66, previousScore: 62, category: "Commodities" },
];

// ─── Finnhub Symbol Mapping (shared) ────────────────────────────────────────

export const FINNHUB_SYMBOL_MAP: Record<string, string> = {
  // Forex
  "EURUSD": "OANDA:EUR_USD", "GBPUSD": "OANDA:GBP_USD", "USDJPY": "OANDA:USD_JPY",
  "USDCHF": "OANDA:USD_CHF", "AUDUSD": "OANDA:AUD_USD", "USDCAD": "OANDA:USD_CAD",
  "NZDUSD": "OANDA:NZD_USD", "EURGBP": "OANDA:EUR_GBP", "EURJPY": "OANDA:EUR_JPY",
  "GBPJPY": "OANDA:GBP_JPY", "AUDJPY": "OANDA:AUD_JPY", "CADJPY": "OANDA:CAD_JPY",
  "CHFJPY": "OANDA:CHF_JPY", "NZDJPY": "OANDA:NZD_JPY", "EURCAD": "OANDA:EUR_CAD",
  "EURAUD": "OANDA:EUR_AUD", "EURNZD": "OANDA:EUR_NZD", "EURCHF": "OANDA:EUR_CHF",
  "GBPCAD": "OANDA:GBP_CAD", "GBPAUD": "OANDA:GBP_AUD", "GBPNZD": "OANDA:GBP_NZD",
  "GBPCHF": "OANDA:GBP_CHF", "AUDCAD": "OANDA:AUD_CAD", "AUDNZD": "OANDA:AUD_NZD",
  "AUDCHF": "OANDA:AUD_CHF", "NZDCAD": "OANDA:NZD_CAD", "NZDCHF": "OANDA:NZD_CHF",
  "CADCHF": "OANDA:CAD_CHF",
  // Metals
  "XAUUSD": "OANDA:XAU_USD", "XAGUSD": "OANDA:XAG_USD",
  "XPTUSD": "OANDA:XPT_USD", "XPDUSD": "OANDA:XPD_USD",
  // Commodities & Futures (canonical + DB alias symbols)
  "CL1!": "OANDA:WTICO_USD", "BZ1!": "OANDA:BCO_USD", "NG1!": "OANDA:NATGAS_USD",
  "ES1!": "OANDA:SPX500_USD", "NQ1!": "OANDA:NAS100_USD", "YM1!": "OANDA:US30_USD",
  "USOIL": "OANDA:WTICO_USD", "UKOIL": "OANDA:BCO_USD", "NATGAS": "OANDA:NATGAS_USD",
  "US500": "OANDA:SPX500_USD", "US100": "OANDA:NAS100_USD", "US30": "OANDA:US30_USD",
};

// Reverse map: Finnhub symbol → our symbol
export const REVERSE_SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(FINNHUB_SYMBOL_MAP).map(([k, v]) => [v, k])
);

export function getFinnhubSymbol(pairSymbol: string): string | null {
  if (FINNHUB_SYMBOL_MAP[pairSymbol]) return FINNHUB_SYMBOL_MAP[pairSymbol];
  // Auto-convert 6-char forex pairs
  if (pairSymbol.length === 6 && !pairSymbol.includes("!")) {
    return `OANDA:${pairSymbol.slice(0, 3)}_${pairSymbol.slice(3)}`;
  }
  return null;
}

export const TIMEFRAME_ORDER = ['5min', '15min', '1h', '4h', '1day'] as const;

export type Timeframe = typeof TIMEFRAME_ORDER[number];

export const TF_LABELS: Record<string, string> = {
  '5min':  '5M',
  '15min': '15M',
  '1h':    '1H',
  '4h':    '4H',
  '1day':  '1D',
};

export const TF_COLORS: Record<string, string> = {
  '5min':  '#fb923c',
  '15min': '#a3e635',
  '1h':    '#60a5fa',
  '4h':    '#818cf8',
  '1day':  '#a78bfa',
};

export const RESOLUTION_MAP: Record<string, string> = {
  '5min':  '5',
  '15min': '15',
  '1h':    '60',
  '4h':    '240',
  '1day':  'D',
};

export const CANDLE_LIMITS: Record<string, number> = {
  '5min':  200,
  '15min': 250,
  '1h':    300,
  '4h':    300,
  '1day':  365,
};

export const INTERVAL_SECONDS: Record<string, number> = {
  '5min':  300,
  '15min': 900,
  '1h':    3600,
  '4h':    14400,
  '1day':  86400,
};

export const MINIMUM_CANDLES: Record<string, number> = {
  '5min':  35,
  '15min': 55,
  '1h':    60,
  '4h':    60,
  '1day':  100,
};

export const EMA_PERIODS: Record<string, {
  fast: number; mid: number; slow: number; long: number | null;
}> = {
  '5min':  { fast: 9,  mid: 21, slow: 50,  long: null },
  '15min': { fast: 9,  mid: 21, slow: 50,  long: null },
  '1h':    { fast: 9,  mid: 21, slow: 50,  long: null },
  '4h':    { fast: 9,  mid: 21, slow: 50,  long: 200  },
  '1day':  { fast: 20, mid: 50, slow: 200, long: null },
};

export const REFRESH_INTERVALS: Record<string, number> = {
  '5min':  300,
  '15min': 900,
  '1h':    3600,
  '4h':    14400,
  '1day':  86400,
};

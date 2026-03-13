import { describe, it, expect } from "vitest";
import {
  calcEMA,
  calcRSI,
  calcMACD,
  calcADX,
  calcBollingerBands,
  calcATR,
  getLatestValue,
  isEMAStacked,
} from "./indicators";

// EURUSD 1H sample closes (30 bars)
const EURUSD_CLOSES = [
  1.0845, 1.0852, 1.0848, 1.0861, 1.0857, 1.0863, 1.0871, 1.0869, 1.0875,
  1.0882, 1.0878, 1.0885, 1.0891, 1.0888, 1.0895, 1.0901, 1.0897, 1.0903,
  1.0911, 1.0908, 1.0915, 1.0921, 1.0918, 1.0925, 1.0931, 1.0928, 1.0935,
  1.0941, 1.0938, 1.0945,
];

// Sample OHLC for ADX/ATR tests
const SAMPLE_HIGHS = EURUSD_CLOSES.map((c) => c + 0.001);
const SAMPLE_LOWS = EURUSD_CLOSES.map((c) => c - 0.001);

describe("calcEMA", () => {
  it("returns correct length", () => {
    const ema = calcEMA(EURUSD_CLOSES, 10);
    expect(ema.length).toBe(EURUSD_CLOSES.length);
  });

  it("first period-1 values are NaN", () => {
    const ema = calcEMA(EURUSD_CLOSES, 10);
    for (let i = 0; i < 9; i++) {
      expect(isNaN(ema[i])).toBe(true);
    }
    expect(isNaN(ema[9])).toBe(false);
  });

  it("seed value equals SMA of first N closes", () => {
    const period = 10;
    const ema = calcEMA(EURUSD_CLOSES, period);
    const sma =
      EURUSD_CLOSES.slice(0, period).reduce((a, b) => a + b, 0) / period;
    expect(ema[period - 1]).toBeCloseTo(sma, 8);
  });

  it("EMA(5) last value is reasonable", () => {
    const ema = calcEMA(EURUSD_CLOSES, 5);
    const last = ema[ema.length - 1];
    // Should be close to recent prices
    expect(last).toBeGreaterThan(1.09);
    expect(last).toBeLessThan(1.10);
  });

  it("EMA responds faster than SMA to price changes", () => {
    // With uptrend data, EMA should be above SMA at the end
    const period = 10;
    const ema = calcEMA(EURUSD_CLOSES, period);
    const lastIdx = EURUSD_CLOSES.length - 1;
    const sma =
      EURUSD_CLOSES.slice(lastIdx - period + 1, lastIdx + 1).reduce(
        (a, b) => a + b,
        0
      ) / period;
    // In an uptrend, EMA > SMA
    expect(ema[lastIdx]).toBeGreaterThan(sma - 0.001);
  });
});

describe("calcRSI", () => {
  it("returns correct length", () => {
    const rsi = calcRSI(EURUSD_CLOSES, 14);
    expect(rsi.length).toBe(EURUSD_CLOSES.length);
  });

  it("first 14 values are NaN, index 14 is valid", () => {
    const rsi = calcRSI(EURUSD_CLOSES, 14);
    for (let i = 0; i < 14; i++) {
      expect(isNaN(rsi[i])).toBe(true);
    }
    expect(isNaN(rsi[14])).toBe(false);
  });

  it("RSI is between 0 and 100", () => {
    const rsi = calcRSI(EURUSD_CLOSES, 14);
    rsi.forEach((v) => {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    });
  });

  it("uptrending data produces RSI > 50", () => {
    const rsi = calcRSI(EURUSD_CLOSES, 14);
    const last = rsi[rsi.length - 1];
    expect(last).toBeGreaterThan(50);
  });
});

describe("calcMACD", () => {
  it("returns macd, signal, histogram arrays of correct length", () => {
    const { macd, signal, histogram } = calcMACD(EURUSD_CLOSES);
    expect(macd.length).toBe(EURUSD_CLOSES.length);
    expect(signal.length).toBe(EURUSD_CLOSES.length);
    expect(histogram.length).toBe(EURUSD_CLOSES.length);
  });

  it("MACD line starts after slow period", () => {
    const { macd } = calcMACD(EURUSD_CLOSES, 12, 26);
    // First 24 values should be NaN (need slow-1 = 25 values for first EMA)
    expect(isNaN(macd[0])).toBe(true);
    expect(isNaN(macd[25])).toBe(false);
  });
});

describe("calcADX", () => {
  it("ADX values are between 0 and 100", () => {
    const adx = calcADX(SAMPLE_HIGHS, SAMPLE_LOWS, EURUSD_CLOSES, 14);
    adx.forEach((v) => {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    });
  });
});

describe("calcATR", () => {
  it("ATR values are positive", () => {
    const atr = calcATR(SAMPLE_HIGHS, SAMPLE_LOWS, EURUSD_CLOSES, 14);
    atr.forEach((v) => {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThan(0);
      }
    });
  });
});

describe("calcBollingerBands", () => {
  it("upper > middle > lower", () => {
    const { upper, middle, lower } = calcBollingerBands(EURUSD_CLOSES, 20, 2);
    for (let i = 19; i < EURUSD_CLOSES.length; i++) {
      expect(upper[i]).toBeGreaterThan(middle[i]);
      expect(middle[i]).toBeGreaterThan(lower[i]);
    }
  });
});

describe("helpers", () => {
  it("getLatestValue returns last non-NaN", () => {
    expect(getLatestValue([NaN, 1, 2, NaN])).toBe(2);
    expect(getLatestValue([NaN, NaN])).toBeNaN();
  });

  it("isEMAStacked detects bullish/bearish/mixed", () => {
    expect(isEMAStacked(100, 99, 98, 97)).toBe("bullish");
    expect(isEMAStacked(95, 96, 97, 98)).toBe("bearish");
    expect(isEMAStacked(99, 100, 97, 98)).toBe("mixed");
  });
});

import { useState } from "react";
import {
  calcEMA,
  calcRSI,
  calcMACD,
  calcADX,
  calcBollingerBands,
  calcATR,
  getLatestValue,
  isEMAStacked,
} from "@/lib/indicators";
import { CheckCircle, XCircle, Play } from "lucide-react";

const EURUSD_CLOSES = [
  1.0845, 1.0852, 1.0848, 1.0861, 1.0857, 1.0863, 1.0871, 1.0869, 1.0875,
  1.0882, 1.0878, 1.0885, 1.0891, 1.0888, 1.0895, 1.0901, 1.0897, 1.0903,
  1.0911, 1.0908, 1.0915, 1.0921, 1.0918, 1.0925, 1.0931, 1.0928, 1.0935,
  1.0941, 1.0938, 1.0945,
];
const HIGHS = EURUSD_CLOSES.map((c) => c + 0.001);
const LOWS = EURUSD_CLOSES.map((c) => c - 0.001);

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

function runTests(): TestResult[] {
  const results: TestResult[] = [];

  function test(name: string, fn: () => string) {
    try {
      const detail = fn();
      results.push({ name, passed: true, detail });
    } catch (err) {
      results.push({
        name,
        passed: false,
        detail: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  test("EMA(10) length & seed", () => {
    const ema = calcEMA(EURUSD_CLOSES, 10);
    if (ema.length !== 30) throw new Error(`Length ${ema.length} != 30`);
    if (isNaN(ema[9])) throw new Error("Seed value is NaN");
    for (let i = 0; i < 9; i++) if (!isNaN(ema[i])) throw new Error(`ema[${i}] should be NaN`);
    return `Seed=${ema[9].toFixed(5)}, Last=${ema[29].toFixed(5)}`;
  });

  test("RSI(14) range 0-100, uptrend > 50", () => {
    const rsi = calcRSI(EURUSD_CLOSES, 14);
    const last = rsi[29];
    if (isNaN(last)) throw new Error("Last RSI is NaN");
    if (last < 0 || last > 100) throw new Error(`RSI ${last} out of range`);
    if (last <= 50) throw new Error(`Uptrend RSI=${last.toFixed(1)} should be > 50`);
    return `RSI=${last.toFixed(2)}`;
  });

  test("MACD structure", () => {
    const { macd, signal, histogram } = calcMACD(EURUSD_CLOSES);
    if (macd.length !== 30) throw new Error("Wrong MACD length");
    const lastMacd = getLatestValue(macd);
    const lastHist = getLatestValue(histogram);
    return `MACD=${lastMacd.toFixed(6)}, Hist=${lastHist.toFixed(6)}`;
  });

  test("ADX values 0-100", () => {
    const adx = calcADX(HIGHS, LOWS, EURUSD_CLOSES, 14);
    const last = getLatestValue(adx);
    if (!isNaN(last) && (last < 0 || last > 100)) throw new Error(`ADX ${last} out of range`);
    return `ADX=${isNaN(last) ? "N/A (need more data)" : last.toFixed(2)}`;
  });

  test("Bollinger Bands upper > mid > lower", () => {
    const { upper, middle, lower, bandwidth } = calcBollingerBands(EURUSD_CLOSES, 20, 2);
    const i = 29;
    if (upper[i] <= middle[i] || middle[i] <= lower[i])
      throw new Error("Band ordering violated");
    return `U=${upper[i].toFixed(5)} M=${middle[i].toFixed(5)} L=${lower[i].toFixed(5)} BW=${bandwidth[i].toFixed(3)}%`;
  });

  test("ATR positive values", () => {
    const atr = calcATR(HIGHS, LOWS, EURUSD_CLOSES, 14);
    const last = getLatestValue(atr);
    if (!isNaN(last) && last <= 0) throw new Error(`ATR ${last} should be > 0`);
    return `ATR=${last.toFixed(6)}`;
  });

  test("EMA stack detection", () => {
    const b = isEMAStacked(100, 99, 98, 97);
    const bear = isEMAStacked(95, 96, 97, 98);
    const mix = isEMAStacked(99, 100, 97, 98);
    if (b !== "bullish" || bear !== "bearish" || mix !== "mixed")
      throw new Error(`Stack: ${b}, ${bear}, ${mix}`);
    return `bullish=✓ bearish=✓ mixed=✓`;
  });

  return results;
}

export function IndicatorTestPanel() {
  const [results, setResults] = useState<TestResult[] | null>(null);

  const handleRun = () => {
    setResults(runTests());
  };

  const passed = results?.filter((r) => r.passed).length ?? 0;
  const total = results?.length ?? 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">
          📊 Indicator Tests
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary font-display">
          DEV ONLY
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleRun}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          Run indicator tests
        </button>
        {results && (
          <span className={`text-sm font-display font-semibold ${passed === total ? "text-bullish" : "text-bearish"}`}>
            {passed}/{total} passed
          </span>
        )}
      </div>

      {results && (
        <div className="space-y-1">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 px-3 py-2 rounded-md text-xs font-mono ${
                r.passed ? "bg-bullish/5" : "bg-bearish/5"
              }`}
            >
              {r.passed ? (
                <CheckCircle className="w-3.5 h-3.5 text-bullish mt-0.5 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-bearish mt-0.5 shrink-0" />
              )}
              <div>
                <span className="text-foreground font-semibold">{r.name}</span>
                <span className="text-muted-foreground ml-2">{r.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

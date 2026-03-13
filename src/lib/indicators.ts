/**
 * Pure TypeScript technical indicators library.
 * No external dependencies — all math computed from scratch.
 */

// ─── EMA ────────────────────────────────────────────────────────────────────

export function calcEMA(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period) return result;

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i];
  }
  result[period - 1] = sum / period;

  const k = 2 / (period + 1);
  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k);
  }

  return result;
}

// ─── RSI (Wilder's method) ──────────────────────────────────────────────────

export function calcRSI(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average gain/loss over first `period` changes
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Smoothed (Wilder's)
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

// ─── MACD ───────────────────────────────────────────────────────────────────

export function calcMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const len = closes.length;

  const macdLine: number[] = new Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i])) {
      macdLine[i] = emaFast[i] - emaSlow[i];
    }
  }

  // Find first valid MACD value
  const validMacd = macdLine.filter((v) => !isNaN(v));
  const signalLine = calcEMA(validMacd, signalPeriod);

  // Map signal back to full-length array
  const signal: number[] = new Array(len).fill(NaN);
  const histogram: number[] = new Array(len).fill(NaN);
  let si = 0;
  for (let i = 0; i < len; i++) {
    if (!isNaN(macdLine[i])) {
      signal[i] = signalLine[si];
      if (!isNaN(signal[i])) {
        histogram[i] = macdLine[i] - signal[i];
      }
      si++;
    }
  }

  return { macd: macdLine, signal, histogram };
}

// ─── True Range & ATR ───────────────────────────────────────────────────────

function calcTrueRange(
  highs: number[],
  lows: number[],
  closes: number[]
): number[] {
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < highs.length; i++) {
    tr.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
  }
  return tr;
}

export function calcATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number[] {
  const tr = calcTrueRange(highs, lows, closes);
  const result: number[] = new Array(tr.length).fill(NaN);
  if (tr.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  result[period - 1] = sum / period;

  for (let i = period; i < tr.length; i++) {
    result[i] = (result[i - 1] * (period - 1) + tr[i]) / period;
  }
  return result;
}

// ─── ADX ────────────────────────────────────────────────────────────────────

export function calcADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number[] {
  const len = highs.length;
  const result: number[] = new Array(len).fill(NaN);
  if (len < period * 2) return result;

  // +DM / -DM
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  for (let i = 1; i < len; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const tr = calcTrueRange(highs, lows, closes);

  // Wilder's smoothing for ATR, +DM, -DM
  const smoothTR: number[] = new Array(len).fill(NaN);
  const smoothPlusDM: number[] = new Array(len).fill(NaN);
  const smoothMinusDM: number[] = new Array(len).fill(NaN);

  let sumTR = 0, sumPDM = 0, sumMDM = 0;
  for (let i = 1; i <= period; i++) {
    sumTR += tr[i];
    sumPDM += plusDM[i];
    sumMDM += minusDM[i];
  }
  smoothTR[period] = sumTR;
  smoothPlusDM[period] = sumPDM;
  smoothMinusDM[period] = sumMDM;

  for (let i = period + 1; i < len; i++) {
    smoothTR[i] = smoothTR[i - 1] - smoothTR[i - 1] / period + tr[i];
    smoothPlusDM[i] = smoothPlusDM[i - 1] - smoothPlusDM[i - 1] / period + plusDM[i];
    smoothMinusDM[i] = smoothMinusDM[i - 1] - smoothMinusDM[i - 1] / period + minusDM[i];
  }

  // +DI / -DI
  const plusDI: number[] = new Array(len).fill(NaN);
  const minusDI: number[] = new Array(len).fill(NaN);
  const dx: number[] = new Array(len).fill(NaN);

  for (let i = period; i < len; i++) {
    if (!isNaN(smoothTR[i]) && smoothTR[i] !== 0) {
      plusDI[i] = (smoothPlusDM[i] / smoothTR[i]) * 100;
      minusDI[i] = (smoothMinusDM[i] / smoothTR[i]) * 100;
      const diSum = plusDI[i] + minusDI[i];
      dx[i] = diSum === 0 ? 0 : (Math.abs(plusDI[i] - minusDI[i]) / diSum) * 100;
    }
  }

  // ADX = Wilder's smoothed DX
  const adxStart = period * 2;
  if (adxStart >= len) return result;

  let adxSum = 0;
  for (let i = period; i < adxStart; i++) {
    adxSum += isNaN(dx[i]) ? 0 : dx[i];
  }
  result[adxStart - 1] = adxSum / period;

  for (let i = adxStart; i < len; i++) {
    const prevAdx = result[i - 1];
    const curDx = isNaN(dx[i]) ? 0 : dx[i];
    result[i] = (prevAdx * (period - 1) + curDx) / period;
  }

  return result;
}

// ─── Bollinger Bands ────────────────────────────────────────────────────────

export function calcBollingerBands(
  closes: number[],
  period = 20,
  stdDevMult = 2
): {
  upper: number[];
  middle: number[];
  lower: number[];
  bandwidth: number[];
} {
  const len = closes.length;
  const upper: number[] = new Array(len).fill(NaN);
  const middle: number[] = new Array(len).fill(NaN);
  const lower: number[] = new Array(len).fill(NaN);
  const bandwidth: number[] = new Array(len).fill(NaN);

  for (let i = period - 1; i < len; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    const sma = sum / period;

    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sqSum += (closes[j] - sma) ** 2;
    }
    const sd = Math.sqrt(sqSum / period);

    middle[i] = sma;
    upper[i] = sma + stdDevMult * sd;
    lower[i] = sma - stdDevMult * sd;
    bandwidth[i] = sma !== 0 ? ((upper[i] - lower[i]) / sma) * 100 : 0;
  }

  return { upper, middle, lower, bandwidth };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getLatestValue(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return NaN;
}

export function isEMAStacked(
  price: number,
  ema20: number,
  ema50: number,
  ema200: number
): "bullish" | "bearish" | "mixed" {
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) return "bullish";
  if (price < ema20 && ema20 < ema50 && ema50 < ema200) return "bearish";
  return "mixed";
}

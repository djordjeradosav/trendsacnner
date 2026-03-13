import { supabase } from "@/integrations/supabase/client";
import { fetchCandlesForPair } from "./dataService";
import { scorePair, type Candle } from "@/lib/scoreEngine";
import { checkAlertRules } from "./alertService";

const BATCH_SIZE = 8;
const BATCH_DELAY_MS = 61_000; // 61s for Twelve Data free tier

export interface ScanResult {
  totalPairs: number;
  bullish: number;
  bearish: number;
  neutral: number;
  avgScore: number;
  duration: number;
  scannedAt: string;
}

export interface ScanController {
  cancel: () => void;
}

export function createScanController(): ScanController & { isCancelled: () => boolean } {
  let cancelled = false;
  return {
    cancel: () => { cancelled = true; },
    isCancelled: () => cancelled,
  };
}

export async function runFullScan(
  timeframe: string,
  onProgress?: (done: number, total: number, currentSymbol: string) => void,
  controller?: ReturnType<typeof createScanController>
): Promise<ScanResult> {
  const startTime = Date.now();

  // 1. Load all active pairs
  const { data: pairs, error } = await supabase
    .from("pairs")
    .select("id, symbol")
    .eq("is_active", true)
    .order("symbol");

  if (error || !pairs) {
    throw new Error(`Failed to load pairs: ${error?.message}`);
  }

  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  let totalScore = 0;
  let done = 0;

  // 2. Process in batches
  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    if (controller?.isCancelled()) break;

    const batch = pairs.slice(i, i + BATCH_SIZE);

    // 3a. Fetch candles in parallel within batch
    const fetchResults = await Promise.allSettled(
      batch.map((pair) => {
        onProgress?.(done, pairs.length, pair.symbol);
        return fetchCandlesForPair(pair.id, pair.symbol, timeframe, 200);
      })
    );

    // 3b-d. For each successfully fetched pair, read candles and score
    for (let j = 0; j < batch.length; j++) {
      if (controller?.isCancelled()) break;

      const pair = batch[j];
      const fetchResult = fetchResults[j];

      if (fetchResult.status === "rejected" || !fetchResult.value.success) {
        done++;
        onProgress?.(done, pairs.length, pair.symbol);
        continue;
      }

      try {
        // Read candles from DB
        const { data: candles } = await supabase
          .from("candles")
          .select("*")
          .eq("pair_id", pair.id)
          .eq("timeframe", timeframe)
          .order("ts", { ascending: true });

        if (candles && candles.length > 0) {
          const candleData: Candle[] = candles.map((c) => ({
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            ts: c.ts,
            timeframe: c.timeframe,
            pair_id: c.pair_id,
          }));

          const result = await scorePair(pair.id, candleData, timeframe);
          totalScore += result.score;

          if (result.trend === "bullish") bullish++;
          else if (result.trend === "bearish") bearish++;
          else neutral++;
        }
      } catch (err) {
        console.warn(`Score failed for ${pair.symbol}:`, err);
      }

      done++;
      onProgress?.(done, pairs.length, pair.symbol);
    }

    // 3f. Wait before next batch (skip after last batch or if cancelled)
    if (i + BATCH_SIZE < pairs.length && !controller?.isCancelled()) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, BATCH_DELAY_MS);
        // Check cancellation every second during wait
        const checker = setInterval(() => {
          if (controller?.isCancelled()) {
            clearTimeout(timer);
            clearInterval(checker);
            resolve();
          }
        }, 1000);
        // Clean up checker when timer fires
        setTimeout(() => clearInterval(checker), BATCH_DELAY_MS + 100);
      });
    }
  }

  const scannedAt = new Date().toISOString();
  const totalPairs = done;
  const avgScore = totalPairs > 0 ? Math.round((totalScore / (bullish + bearish + neutral)) * 10) / 10 : 0;
  const duration = Math.round((Date.now() - startTime) / 1000);

  const scanResult: ScanResult = {
    totalPairs,
    bullish,
    bearish,
    neutral,
    avgScore,
    duration,
    scannedAt,
  };

  // Store scan result
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("scan_history").insert({
        user_id: user.id,
        result: scanResult as any,
        scanned_at: scannedAt,
      });
    }
  } catch (err) {
    console.warn("Failed to store scan history:", err);
  }

  return scanResult;
}

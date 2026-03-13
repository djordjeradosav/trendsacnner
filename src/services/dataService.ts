import { supabase } from "@/integrations/supabase/client";

const BATCH_SIZE = 8;
const BATCH_DELAY_MS = 500;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch candles for a single pair via the edge function.
 */
export async function fetchCandlesForPair(
  pairId: string,
  symbol: string,
  timeframe: string = "1h",
  outputsize: number = 200
) {
  const { data, error } = await supabase.functions.invoke("fetch-candles", {
    body: { pair_symbol: symbol, timeframe, outputsize },
  });

  if (error) {
    throw new Error(`Edge function error: ${error.message}`);
  }

  return data as {
    success: boolean;
    count?: number;
    pair?: string;
    error?: string;
    rate_limited?: boolean;
  };
}

/**
 * Fetch candles for ALL active pairs, batched to respect rate limits.
 */
export async function fetchAllPairs(timeframe: string = "1h") {
  const { data: pairs, error } = await supabase
    .from("pairs")
    .select("id, symbol")
    .eq("is_active", true)
    .order("symbol");

  if (error || !pairs) {
    throw new Error(`Failed to load pairs: ${error?.message}`);
  }

  const results: Array<{
    symbol: string;
    success: boolean;
    count?: number;
    error?: string;
  }> = [];

  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map((pair) =>
        fetchCandlesForPair(pair.id, pair.symbol, timeframe)
      )
    );

    batchResults.forEach((result, idx) => {
      const pair = batch[idx];
      if (result.status === "fulfilled") {
        results.push({
          symbol: pair.symbol,
          success: result.value.success,
          count: result.value.count,
          error: result.value.error,
        });
      } else {
        results.push({
          symbol: pair.symbol,
          success: false,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : "Unknown error",
        });
      }
    });

    // Delay between batches (skip after last batch)
    if (i + BATCH_SIZE < pairs.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  return results;
}

/**
 * Read latest candles from Supabase for a given pair.
 */
export async function getLatestCandles(
  pairId: string,
  timeframe: string = "1h",
  limit: number = 50
) {
  const { data, error } = await supabase
    .from("candles")
    .select("*")
    .eq("pair_id", pairId)
    .eq("timeframe", timeframe)
    .order("ts", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch candles: ${error.message}`);
  }

  return data;
}

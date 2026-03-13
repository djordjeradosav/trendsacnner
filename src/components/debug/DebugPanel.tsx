import { useState } from "react";
import { fetchCandlesForPair } from "@/services/dataService";
import { supabase } from "@/integrations/supabase/client";

interface FetchResult {
  success: boolean;
  count?: number;
  pair?: string;
  error?: string;
  rate_limited?: boolean;
}

export function DebugPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [rawCandles, setRawCandles] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setRawCandles(null);

    try {
      // Find EURUSD pair
      const { data: pair } = await supabase
        .from("pairs")
        .select("id, symbol")
        .eq("symbol", "EURUSD")
        .single();

      if (!pair) {
        setError("EURUSD pair not found in database");
        setLoading(false);
        return;
      }

      const res = await fetchCandlesForPair(pair.id, pair.symbol, "1h", 10);
      setResult(res);

      // Fetch raw candles from DB
      if (res.success) {
        const { data: candles } = await supabase
          .from("candles")
          .select("*")
          .eq("pair_id", pair.id)
          .eq("timeframe", "1h")
          .order("ts", { ascending: false })
          .limit(10);

        setRawCandles(candles);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">
          🛠 Debug: Candle Fetch
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary font-display">
          DEV ONLY
        </span>
      </div>

      <button
        onClick={handleFetch}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Fetching..." : "Fetch EURUSD 1H (10 candles)"}
      </button>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive font-mono">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground font-display">
            Edge Function Response:
          </div>
          <pre className="p-3 rounded-md bg-muted text-xs font-mono text-foreground overflow-x-auto max-h-40">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {rawCandles && rawCandles.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground font-display">
            Raw Candles from DB ({rawCandles.length}):
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1 pr-3">Timestamp</th>
                  <th className="text-right py-1 pr-3">Open</th>
                  <th className="text-right py-1 pr-3">High</th>
                  <th className="text-right py-1 pr-3">Low</th>
                  <th className="text-right py-1 pr-3">Close</th>
                  <th className="text-right py-1">Volume</th>
                </tr>
              </thead>
              <tbody>
                {rawCandles.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 text-foreground">
                    <td className="py-1 pr-3 text-muted-foreground">
                      {new Date(c.ts).toLocaleString()}
                    </td>
                    <td className="text-right py-1 pr-3">{c.open}</td>
                    <td className="text-right py-1 pr-3">{c.high}</td>
                    <td className="text-right py-1 pr-3">{c.low}</td>
                    <td className="text-right py-1 pr-3">{c.close}</td>
                    <td className="text-right py-1">{c.volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

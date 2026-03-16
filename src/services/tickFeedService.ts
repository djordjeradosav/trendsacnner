import { supabase } from "@/integrations/supabase/client";
import { getTimeframeConfig } from "@/config/timeframes";

export type WsStatus = "disconnected" | "connecting" | "live" | "paused";
export type PriceCallback = (price: number) => void;
export type StatusCallback = (status: WsStatus, pairCount: number) => void;

// Short timeframes that benefit from live feed
const LIVE_TIMEFRAMES = ["1min", "3min", "5min", "15min", "30min"];

export function isLiveEligible(timeframe: string): boolean {
  return LIVE_TIMEFRAMES.includes(timeframe);
}

// Candle interval in seconds for each timeframe
function candleIntervalSeconds(timeframe: string): number {
  switch (timeframe) {
    case "1min": return 60;
    case "3min": return 180;
    case "5min": return 300;
    case "15min": return 900;
    case "30min": return 1800;
    default: return 3600;
  }
}

class TickFeedService {
  private ws: WebSocket | null = null;
  private lastPrices: Map<string, number> = new Map();
  private lastCandleTime: Map<string, number> = new Map();
  private priceSubscribers: Map<string, Set<PriceCallback>> = new Map();
  private statusSubscribers: Set<StatusCallback> = new Set();
  private _status: WsStatus = "disconnected";
  private _symbols: string[] = [];
  private _activeTimeframe: string = "1h";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  get status(): WsStatus {
    return this._status;
  }

  get pairCount(): number {
    return this._symbols.length;
  }

  private setStatus(status: WsStatus) {
    this._status = status;
    this.statusSubscribers.forEach((fn) => fn(status, this._symbols.length));
  }

  /**
   * Start the live feed for the given timeframe.
   * Loads symbols from DB, connects to Twelve Data WS via our edge function proxy.
   */
  async start(timeframe: string) {
    this._activeTimeframe = timeframe;

    if (!isLiveEligible(timeframe)) {
      this.stop();
      this.setStatus("paused");
      return;
    }

    // Load active pair symbols
    const { data: pairs } = await supabase
      .from("pairs")
      .select("symbol")
      .eq("is_active", true);

    if (!pairs || pairs.length === 0) return;

    this._symbols = pairs.map((p) => p.symbol);
    this.connect();
  }

  private connect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    this.setStatus("connecting");

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // We proxy through an edge function to keep the API key server-side
    const wsUrl = `wss://${projectId}.supabase.co/functions/v1/tick-feed`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      // Send subscription request with auth
      this.ws?.send(
        JSON.stringify({
          action: "subscribe",
          symbols: this._symbols,
          apikey: anonKey,
        })
      );
      this.setStatus("live");
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "price" && msg.symbol && msg.price != null) {
          this.handleTick(msg.symbol, parseFloat(msg.price), msg.timestamp ?? Date.now() / 1000);
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (this._status !== "paused" && this._status !== "disconnected") {
        this.setStatus("disconnected");
        // Auto-reconnect after 3s
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: "ping" }));
      }
    }, 30_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleTick(symbol: string, price: number, timestamp: number) {
    this.lastPrices.set(symbol, price);

    // Notify price subscribers
    this.priceSubscribers.get(symbol)?.forEach((fn) => fn(price));

    // Check if a new candle just closed
    const interval = candleIntervalSeconds(this._activeTimeframe);
    const candleBucket = Math.floor(timestamp / interval) * interval;
    const lastBucket = this.lastCandleTime.get(symbol) ?? 0;

    if (candleBucket > lastBucket && lastBucket > 0) {
      this.lastCandleTime.set(symbol, candleBucket);
      // New candle closed — trigger single-pair rescan
      this.rescanSinglePair(symbol);
    } else if (lastBucket === 0) {
      this.lastCandleTime.set(symbol, candleBucket);
    }
  }

  /**
   * Rescan a single pair by calling the fast-scan edge function with just one pair.
   */
  private async rescanSinglePair(symbol: string) {
    try {
      // Look up pair_id
      const { data: pair } = await supabase
        .from("pairs")
        .select("id")
        .eq("symbol", symbol)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!pair) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const url = `https://${projectId}.supabase.co/functions/v1/fast-scan?timeframe=${encodeURIComponent(this._activeTimeframe)}&pairIds=${pair.id}`;

      await fetch(url, {
        headers: {
          apikey: anonKey,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      // The score upsert happens server-side, and the realtime subscription in useAllScores
      // will pick it up automatically.
      console.log(`[TickFeed] Rescanned ${symbol} on ${this._activeTimeframe}`);
    } catch (err) {
      console.warn(`[TickFeed] Rescan failed for ${symbol}:`, err);
    }
  }

  /**
   * Subscribe to live price updates for a symbol.
   * Returns an unsubscribe function.
   */
  subscribe(symbol: string, callback: PriceCallback): () => void {
    if (!this.priceSubscribers.has(symbol)) {
      this.priceSubscribers.set(symbol, new Set());
    }
    this.priceSubscribers.get(symbol)!.add(callback);

    return () => {
      this.priceSubscribers.get(symbol)?.delete(callback);
    };
  }

  /**
   * Subscribe to status changes.
   */
  onStatus(callback: StatusCallback): () => void {
    this.statusSubscribers.add(callback);
    // Immediately fire with current status
    callback(this._status, this._symbols.length);
    return () => {
      this.statusSubscribers.delete(callback);
    };
  }

  getLivePrice(symbol: string): number | null {
    return this.lastPrices.get(symbol) ?? null;
  }

  reconnect() {
    if (this._symbols.length > 0) {
      this.connect();
    }
  }

  stop() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }
}

// Singleton instance
export const tickFeed = new TickFeedService();

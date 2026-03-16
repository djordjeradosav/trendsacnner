import { FINNHUB_SYMBOL_MAP, REVERSE_SYMBOL_MAP } from "./finnhubSymbols";

export type TickHandler = (symbol: string, price: number, timestamp: number) => void;

interface FinnhubTrade {
  s: string;  // symbol
  p: number;  // price
  t: number;  // timestamp ms
  v: number;  // volume
}

interface FinnhubMessage {
  type: string;
  data?: FinnhubTrade[];
}

class FinnhubWebSocketService {
  private ws: WebSocket | null = null;
  private apiKey: string | null = null;
  private subscribedSymbols = new Set<string>();
  private handlers = new Set<TickHandler>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private latestPrices = new Map<string, { price: number; timestamp: number }>();

  setApiKey(key: string) {
    this.apiKey = key;
  }

  connect(apiKey?: string) {
    if (apiKey) this.apiKey = apiKey;
    if (!this.apiKey) {
      console.warn("FinnhubWS: No API key set");
      return;
    }
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;

    // Reset reconnect counter on explicit connect calls
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isConnecting = true;
    const url = `wss://ws.finnhub.io?token=${this.apiKey}`;

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.error("FinnhubWS: Failed to create WebSocket", err);
      this.isConnecting = false;
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log("FinnhubWS: Connected");
      this.isConnecting = false;
      this.reconnectAttempts = 0;

      // Re-subscribe all symbols
      this.subscribedSymbols.forEach((finnhubSymbol) => {
        this.ws?.send(JSON.stringify({ type: "subscribe", symbol: finnhubSymbol }));
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: FinnhubMessage = JSON.parse(event.data);
        if (msg.type === "trade" && msg.data) {
          msg.data.forEach((tick) => {
            const ourSymbol = REVERSE_SYMBOL_MAP[tick.s];
            if (ourSymbol) {
              const ts = Math.floor(tick.t / 1000);
              this.latestPrices.set(ourSymbol, { price: tick.p, timestamp: ts });
              this.handlers.forEach((handler) => handler(ourSymbol, tick.p, ts));
            }
          });
        }
      } catch {
        // ignore parse errors (ping frames etc)
      }
    };

    this.ws.onclose = () => {
      console.log("FinnhubWS: Disconnected");
      this.isConnecting = false;
      this.ws = null;
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error("FinnhubWS: Error", err);
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("FinnhubWS: Max reconnect attempts reached");
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    console.log(`FinnhubWS: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  subscribe(symbols: string[]) {
    symbols.forEach((ourSymbol) => {
      const finnhubSymbol = FINNHUB_SYMBOL_MAP[ourSymbol];
      if (!finnhubSymbol) return;
      if (this.subscribedSymbols.has(finnhubSymbol)) return;

      this.subscribedSymbols.add(finnhubSymbol);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "subscribe", symbol: finnhubSymbol }));
      }
    });
  }

  unsubscribe(symbols: string[]) {
    symbols.forEach((ourSymbol) => {
      const finnhubSymbol = FINNHUB_SYMBOL_MAP[ourSymbol];
      if (!finnhubSymbol) return;
      this.subscribedSymbols.delete(finnhubSymbol);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "unsubscribe", symbol: finnhubSymbol }));
      }
    });
  }

  onTick(handler: TickHandler) {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  getLatestPrice(symbol: string): { price: number; timestamp: number } | null {
    return this.latestPrices.get(symbol) ?? null;
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectAttempts = this.maxReconnectAttempts; // prevent auto-reconnect
    this.ws?.close();
    this.ws = null;
    this.subscribedSymbols.clear();
    this.handlers.clear();
    this.latestPrices.clear();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton
export const finnhubWS = new FinnhubWebSocketService();

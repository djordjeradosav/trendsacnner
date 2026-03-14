import { useEffect, useState } from "react";
import { Wifi } from "lucide-react";
import { useCurrencyStrength } from "@/hooks/useCurrencyStrength";

function padZ(n: number) {
  return n.toString().padStart(2, "0");
}

export function CapitalFlowWidget({ timeframe }: { timeframe: string }) {
  const strengths = useCurrencyStrength(timeframe);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const lastUpdate = `${padZ(now.getUTCHours())}:${padZ(now.getUTCMinutes())}`;

  return (
    <div
      className="rounded-lg p-4 mt-4"
      style={{
        background: "hsl(var(--secondary))",
        border: "0.5px solid hsl(var(--border))",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <Wifi className="w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} />
          <span className="font-semibold" style={{ fontSize: "14px", color: "hsl(var(--foreground))" }}>
            Capital Flow
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-display" style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "hsl(var(--bullish))" }} />
            Last Update {lastUpdate}
          </span>
          <span
            className="font-display"
            style={{
              fontSize: "9px",
              borderRadius: "4px",
              padding: "2px 7px",
              background: "#0d2b1a",
              color: "hsl(var(--bullish))",
            }}
          >
            Live
          </span>
        </div>
      </div>

      {/* Flow bars */}
      <div className="space-y-3">
        {strengths.map((item) => {
          const deviation = item.strength - 50;
          // Bar fill: deviation of 50 = 100% of half, deviation of 25 = 50% of half
          const fillPercent = Math.abs(deviation); // 0-50 range, represents % of half
          const isPositive = deviation >= 0;
          const displayPct = ((deviation / 50) * 5).toFixed(2); // scale to reasonable %
          const color = isPositive ? "hsl(var(--bullish))" : "hsl(var(--destructive))";
          const showDelta = item.delta !== null && Math.abs(item.delta) > 3;

          return (
            <div key={item.currency}>
              <div className="flex items-center gap-2">
                {/* Currency code */}
                <span
                  className="font-display font-bold shrink-0"
                  style={{ fontSize: "11px", color: "hsl(var(--foreground))", width: "36px" }}
                >
                  {item.currency}
                </span>

                {/* Bar */}
                <div className="flex-1 relative" style={{ height: "4px" }}>
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: "hsl(var(--border))" }}
                  />
                  {/* Center line */}
                  <div
                    className="absolute top-0 bottom-0 w-px"
                    style={{ left: "50%", background: "hsl(var(--muted-foreground) / 0.3)" }}
                  />
                  {/* Fill bar */}
                  <div
                    className="absolute top-0 bottom-0 rounded-full"
                    style={{
                      background: color,
                      transition: mounted ? "width 800ms cubic-bezier(0.16, 1, 0.3, 1)" : "none",
                      width: mounted ? `${fillPercent}%` : "0%",
                      ...(isPositive
                        ? { left: "50%" }
                        : { right: "50%" }),
                    }}
                  />
                </div>

                {/* Value */}
                <div className="shrink-0 text-right" style={{ width: "52px" }}>
                  <span
                    className="font-display"
                    style={{ fontSize: "11px", color }}
                  >
                    {isPositive ? "+" : ""}{displayPct}%
                  </span>
                  {showDelta && (
                    <div
                      className="font-display"
                      style={{
                        fontSize: "8px",
                        color: item.delta! > 0 ? "hsl(var(--bullish))" : "hsl(var(--destructive))",
                        marginTop: "-1px",
                      }}
                    >
                      {item.delta! > 0 ? "↑" : "↓"} {Math.abs(item.delta!).toFixed(1)}pts
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {strengths.length === 0 && (
          <p style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", textAlign: "center", padding: "12px 0" }}>
            Run a scan to see currency strength data
          </p>
        )}
      </div>
    </div>
  );
}

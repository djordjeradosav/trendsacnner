import { useEffect, useState, useMemo } from "react";
import type { EconomicEvent } from "@/hooks/useEconomicCalendar";
import { supabase } from "@/integrations/supabase/client";
import { Download } from "lucide-react";

interface Props {
  event: EconomicEvent;
}

export function HistoryTab({ event }: Props) {
  const [history, setHistory] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"6m" | "1y" | "2y" | "all">("1y");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("economic_events")
        .select("*")
        .eq("event_name", event.event_name)
        .eq("currency", event.currency || "")
        .not("actual", "is", null)
        .order("scheduled_at", { ascending: false })
        .limit(24);
      setHistory((data as EconomicEvent[]) || []);
      setLoading(false);
    };
    fetch();
  }, [event.event_name, event.currency]);

  const filtered = useMemo(() => {
    if (range === "all") return history;
    const months = range === "6m" ? 6 : range === "1y" ? 12 : 24;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return history.filter((e) => new Date(e.scheduled_at) >= cutoff);
  }, [history, range]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    let beatCount = 0;
    let totalSurprise = 0;
    let largestSurprise = 0;
    let largestDate = "";
    const actuals: number[] = [];

    filtered.forEach((e) => {
      const a = parseFloat((e.actual || "").replace(/[^0-9.\-]/g, ""));
      const f = parseFloat((e.forecast || "").replace(/[^0-9.\-]/g, ""));
      if (!isNaN(a)) actuals.push(a);
      if (!isNaN(a) && !isNaN(f)) {
        const s = a - f;
        totalSurprise += s;
        if (a > f) beatCount++;
        if (Math.abs(s) > Math.abs(largestSurprise)) {
          largestSurprise = s;
          largestDate = new Date(e.scheduled_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
        }
      }
    });

    const count = filtered.length;
    return {
      avgActual: actuals.length > 0 ? (actuals.reduce((a, b) => a + b, 0) / actuals.length).toFixed(2) : "N/A",
      avgSurprise: count > 0 ? (totalSurprise / count).toFixed(3) : "N/A",
      beatRate: count > 0 ? `${beatCount}/${count} (${Math.round((beatCount / count) * 100)}%)` : "N/A",
      largestSurprise: largestSurprise !== 0 ? `${largestSurprise > 0 ? "+" : ""}${largestSurprise.toFixed(2)} on ${largestDate}` : "N/A",
    };
  }, [filtered]);

  const exportCSV = () => {
    const rows = [["Date", "Actual", "Forecast", "Previous", "Surprise"]];
    filtered.forEach((e) => {
      const a = parseFloat((e.actual || "").replace(/[^0-9.\-]/g, ""));
      const f = parseFloat((e.forecast || "").replace(/[^0-9.\-]/g, ""));
      const s = !isNaN(a) && !isNaN(f) ? (a - f).toFixed(3) : "";
      rows.push([
        new Date(e.scheduled_at).toLocaleDateString(),
        e.actual || "",
        e.forecast || "",
        e.previous || "",
        s,
      ]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.event_name}_history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 rounded bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Range filter */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["6m", "1y", "2y", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-2.5 py-1 rounded text-[10px] font-mono transition-colors"
              style={{
                background: range === r ? "hsl(var(--bullish) / 0.15)" : "transparent",
                color: range === r ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))",
                border: range === r ? "1px solid hsl(var(--bullish) / 0.3)" : "1px solid transparent",
              }}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground"
        >
          <Download className="w-3 h-3" /> Export CSV
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Avg Actual", value: stats.avgActual },
            { label: "Avg Surprise", value: stats.avgSurprise },
            { label: "Beat Rate", value: stats.beatRate },
            { label: "Largest Surprise", value: stats.largestSurprise },
          ].map((s) => (
            <div key={s.label} className="rounded border border-border p-2" style={{ background: "hsl(var(--secondary))" }}>
              <div className="text-[9px] uppercase text-muted-foreground">{s.label}</div>
              <div className="text-[12px] font-mono text-foreground">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">No historical data found.</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-5 text-[9px] uppercase text-muted-foreground font-mono border-b border-border" style={{ background: "hsl(var(--secondary))" }}>
            {["Date", "Actual", "Forecast", "Previous", "Surprise"].map((h) => (
              <div key={h} className="px-2 py-1.5">{h}</div>
            ))}
          </div>
          {filtered.map((e, i) => {
            const a = parseFloat((e.actual || "").replace(/[^0-9.\-]/g, ""));
            const f = parseFloat((e.forecast || "").replace(/[^0-9.\-]/g, ""));
            const s = !isNaN(a) && !isNaN(f) ? a - f : null;
            return (
              <div
                key={e.id}
                className="grid grid-cols-5 text-[11px] font-mono border-b border-border last:border-b-0"
                style={{
                  background: i === 0 ? "hsl(var(--bullish) / 0.04)" : i % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--secondary) / 0.5)",
                  borderLeft: i === 0 ? "3px solid hsl(var(--bullish))" : "3px solid transparent",
                }}
              >
                <div className="px-2 py-1.5 text-muted-foreground">
                  {new Date(e.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                </div>
                <div className="px-2 py-1.5 font-bold text-foreground">{e.actual || "--"}</div>
                <div className="px-2 py-1.5 text-muted-foreground">{e.forecast || "--"}</div>
                <div className="px-2 py-1.5 text-muted-foreground">{e.previous || "--"}</div>
                <div className="px-2 py-1.5">
                  {s !== null && (
                    <span style={{ color: s > 0 ? "hsl(var(--bullish))" : s < 0 ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}>
                      {s > 0 ? "+" : ""}{s.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

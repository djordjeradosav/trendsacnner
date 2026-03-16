import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Clock, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface ScanResult {
  totalPairs: number;
  bullish: number;
  bearish: number;
  neutral: number;
  avgScore: number;
  duration: number;
}

interface ScanHistoryRow {
  id: string;
  scanned_at: string;
  result: Json;
}

function parseResult(json: Json): ScanResult | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const obj = json as Record<string, Json | undefined>;
  return {
    totalPairs: Number(obj.totalPairs ?? obj.total ?? 0),
    bullish: Number(obj.bullish ?? 0),
    bearish: Number(obj.bearish ?? 0),
    neutral: Number(obj.neutral ?? 0),
    avgScore: Number(obj.avgScore ?? 0),
    duration: Number(obj.duration ?? obj.durationMs ? Number(obj.durationMs) / 1000 : 0),
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ScanHistoryPage() {
  const [rows, setRows] = useState<ScanHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("scan_history")
        .select("id, scanned_at, result")
        .order("scanned_at", { ascending: false })
        .limit(50);
      if (data) setRows(data);
      setLoading(false);
    };
    fetch();
  }, []);

  // Group by date
  const grouped = rows.reduce<Record<string, ScanHistoryRow[]>>((acc, row) => {
    const key = formatDate(row.scanned_at);
    (acc[key] ??= []).push(row);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <History className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold font-display text-foreground">Scan History</h1>
          <span className="text-xs text-muted-foreground font-display">Last 50 scans</span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20">
            <History className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No scan history yet. Run your first scan!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <h2 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">{date}</h2>
                <div className="space-y-2">
                  {items.map((row) => {
                    const r = parseResult(row.result);
                    if (!r) return null;
                    return (
                      <div key={row.id} className="rounded-lg border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Time */}
                        <div className="flex items-center gap-2 sm:w-28 shrink-0">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-display font-semibold text-foreground">{formatTime(row.scanned_at)}</p>
                            <p className="text-[10px] text-muted-foreground">{formatAgo(row.scanned_at)}</p>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex flex-wrap items-center gap-4 flex-1">
                          <div className="flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 text-primary" />
                            <span className="text-sm font-display font-bold text-foreground">{r.totalPairs}</span>
                            <span className="text-[10px] text-muted-foreground">pairs</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-bullish" />
                            <span className="text-sm font-display font-bold text-bullish">{r.bullish}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Minus className="w-3.5 h-3.5 text-neutral-tone" />
                            <span className="text-sm font-display font-bold text-neutral-tone">{r.neutral}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5 text-bearish" />
                            <span className="text-sm font-display font-bold text-bearish">{r.bearish}</span>
                          </div>

                          <div className="text-xs text-muted-foreground font-display">
                            Avg: <span className="font-bold text-foreground">{r.avgScore}</span>
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="text-right shrink-0">
                          <span className="text-xs font-display text-muted-foreground">
                            {r.duration > 0 ? `${r.duration.toFixed(1)}s` : "—"}
                          </span>
                        </div>

                        {/* Trend bar */}
                        <div className="w-full sm:w-32 h-2 rounded-full bg-muted overflow-hidden flex shrink-0">
                          {r.totalPairs > 0 && (
                            <>
                              <div className="h-full bg-bullish" style={{ width: `${(r.bullish / r.totalPairs) * 100}%` }} />
                              <div className="h-full bg-neutral-tone" style={{ width: `${(r.neutral / r.totalPairs) * 100}%` }} />
                              <div className="h-full bg-bearish" style={{ width: `${(r.bearish / r.totalPairs) * 100}%` }} />
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

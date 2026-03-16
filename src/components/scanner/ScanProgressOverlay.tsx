import { useState, useEffect, useRef } from "react";
import { Zap, Check, X, ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useScanStore } from "@/store/scanStore";
import { cn } from "@/lib/utils";

function formatDuration(ms: number): string {
  return (ms / 1000).toFixed(1) + "s";
}

function TrendDot({ trend }: { trend: string }) {
  if (trend === "bullish") return <div className="w-full h-full rounded-sm bg-primary/80" />;
  if (trend === "bearish") return <div className="w-full h-full rounded-sm bg-destructive/80" />;
  if (trend === "failed") return <div className="w-full h-full rounded-sm bg-amber-500/60" />;
  return <div className="w-full h-full rounded-sm bg-muted-foreground/30" />;
}

export function ScanProgressOverlay() {
  const {
    isScanning, progress, done, total, currentSymbol, eta,
    timeframe, lastScanDuration, lastScanAt, result,
    recentSymbols,
  } = useScanStore();

  const [expanded, setExpanded] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [visible, setVisible] = useState(false);
  const prevScanning = useRef(false);
  const startTimeRef = useRef(0);
  const [speed, setSpeed] = useState(0);

  // Track speed
  useEffect(() => {
    if (isScanning && done > 0) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setSpeed(elapsed > 0 ? Math.round(done / elapsed) : 0);
    }
  }, [done, isScanning]);

  // Show/hide logic
  useEffect(() => {
    if (isScanning && !prevScanning.current) {
      setVisible(true);
      setShowComplete(false);
      startTimeRef.current = Date.now();
    }
    if (!isScanning && prevScanning.current && result) {
      setShowComplete(true);
      setExpanded(false);
      const timer = setTimeout(() => {
        setShowComplete(false);
        setVisible(false);
      }, 4000);
      prevScanning.current = isScanning;
      return () => clearTimeout(timer);
    }
    prevScanning.current = isScanning;
  }, [isScanning, result]);

  if (!visible) return null;

  // COMPLETE STATE
  if (showComplete && result) {
    return (
      <div className="fixed bottom-5 right-5 z-50 animate-fade-in">
        <div className="bg-card border border-primary/30 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 min-w-[280px]">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-display font-semibold text-foreground">
              Scan complete
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {result.scored} pairs · {timeframe.toUpperCase()} · {lastScanDuration ? formatDuration(lastScanDuration) : ""}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[9px] font-mono">
              <span className="text-primary">{result.bullish} bullish</span>
              <span className="text-muted-foreground">{result.neutral} neutral</span>
              <span className="text-destructive">{result.bearish} bearish</span>
            </div>
          </div>
          <button onClick={() => { setShowComplete(false); setVisible(false); }} className="p-1 rounded hover:bg-muted">
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  if (!isScanning) return null;

  // COLLAPSED PILL
  if (!expanded) {
    return (
      <div className="fixed bottom-5 right-5 z-50 animate-fade-in">
        <button
          onClick={() => setExpanded(true)}
          className="relative bg-card border border-border rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-2.5 hover:border-primary/40 transition-colors cursor-pointer group"
        >
          {/* Pulsing glow */}
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-primary animate-pulse" />

          <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-display font-semibold text-foreground">
            Scanning {timeframe.toUpperCase()}
          </span>
          <span className="text-xs font-mono tabular-nums text-muted-foreground">
            {done}/{total}
          </span>

          {/* Mini progress bar */}
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <span className="text-[10px] font-mono tabular-nums text-primary">
            {progress}%
          </span>

          {eta !== null && eta > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground">
              ETA {eta}s
            </span>
          )}

          <ChevronUp className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      </div>
    );
  }

  // EXPANDED CARD
  const bullishCount = recentSymbols.filter((s) => s.trend === "bullish").length;
  const bearishCount = recentSymbols.filter((s) => s.trend === "bearish").length;
  const neutralCount = recentSymbols.filter((s) => s.trend === "neutral").length;

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-xl w-[320px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-display font-semibold text-foreground">
              Scanning {timeframe.toUpperCase()}
            </span>
          </div>
          <button onClick={() => setExpanded(false)} className="p-1 rounded hover:bg-muted">
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Stats row */}
        <div className="px-4 py-2 grid grid-cols-3 gap-2 text-center border-b border-border/50">
          <div>
            <div className="text-[9px] text-muted-foreground font-mono uppercase">Progress</div>
            <div className="text-sm font-display font-bold tabular-nums text-foreground">{done}/{total}</div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground font-mono uppercase">Speed</div>
            <div className="text-sm font-display font-bold tabular-nums text-foreground">{speed}/s</div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground font-mono uppercase">ETA</div>
            <div className="text-sm font-display font-bold tabular-nums text-foreground">
              {eta !== null && eta > 0 ? `~${eta}s` : "—"}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-2">
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Current symbol ticker */}
        <div className="px-4 py-1.5 flex items-center gap-2 border-b border-border/50">
          <span className="text-[9px] text-muted-foreground font-mono">NOW →</span>
          <span
            key={currentSymbol}
            className="text-xs font-display font-bold text-primary animate-fade-in"
          >
            {currentSymbol}
          </span>
        </div>

        {/* Recent symbols grid (6×5) */}
        {recentSymbols.length > 0 && (
          <div className="px-4 py-2">
            <div className="text-[8px] text-muted-foreground font-mono uppercase mb-1.5">Recent</div>
            <div className="grid grid-cols-6 gap-1">
              {recentSymbols.map((s, i) => (
                <div
                  key={`${s.symbol}-${i}`}
                  className="flex flex-col items-center gap-0.5"
                  title={`${s.symbol}: ${s.trend}`}
                >
                  <div className="w-full h-3 rounded-sm">
                    <TrendDot trend={s.trend} />
                  </div>
                  <span className="text-[7px] font-mono text-muted-foreground truncate w-full text-center leading-none">
                    {s.symbol.replace("/", "").slice(0, 6)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary bar */}
        {recentSymbols.length > 0 && (
          <div className="px-4 py-2 border-t border-border/50 flex items-center gap-3 text-[10px] font-mono">
            <span className="flex items-center gap-1 text-primary">
              <TrendingUp className="w-3 h-3" /> {bullishCount}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Minus className="w-3 h-3" /> {neutralCount}
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <TrendingDown className="w-3 h-3" /> {bearishCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

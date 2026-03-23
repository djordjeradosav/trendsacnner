import { useEffect, useState, useRef } from "react";
import { Zap, Check } from "lucide-react";
import type { TFStatus } from "@/hooks/useFastScan";

const TF_LABELS: Record<string, string> = {
  "5min": "5M", "15min": "15M", "1h": "1H", "4h": "4H", "1day": "1D",
};

interface ScanButtonProps {
  isScanning: boolean;
  progress: number;
  done: number;
  total: number;
  currentSymbol: string;
  eta: number | null;
  lastScanDuration: number | null;
  lastScanAt: string | null;
  timeframeLabel?: string;
  tfStatuses?: Record<string, TFStatus>;
  onScan: () => void;
}

function formatDuration(ms: number): string {
  return (ms / 1000).toFixed(1) + "s";
}

function formatAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function ScanButton({
  isScanning,
  progress,
  done,
  total,
  currentSymbol,
  eta,
  lastScanDuration,
  lastScanAt,
  tfStatuses,
  onScan,
}: ScanButtonProps) {
  const [showComplete, setShowComplete] = useState(false);
  const [completeDuration, setCompleteDuration] = useState<number | null>(null);
  const [completeTotal, setCompleteTotal] = useState(0);
  const prevScanning = useRef(isScanning);
  const [agoText, setAgoText] = useState<string | null>(null);

  useEffect(() => {
    if (prevScanning.current && !isScanning && lastScanDuration) {
      setShowComplete(true);
      setCompleteDuration(lastScanDuration);
      setCompleteTotal(total);
      const timer = setTimeout(() => setShowComplete(false), 3000);
      return () => clearTimeout(timer);
    }
    prevScanning.current = isScanning;
  }, [isScanning, lastScanDuration, total]);

  useEffect(() => {
    if (!lastScanAt) return;
    const update = () => setAgoText(formatAgo(lastScanAt));
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [lastScanAt]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "S") {
        e.preventDefault();
        if (!isScanning) onScan();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isScanning, onScan]);

  const ringStyle = isScanning
    ? {
        background: `conic-gradient(hsl(var(--primary)) ${progress * 3.6}deg, hsl(var(--muted)) ${progress * 3.6}deg)`,
      }
    : {};

  // Per-TF status indicators
  const tfStatusRow = tfStatuses && Object.keys(tfStatuses).length > 0 && (
    <div className="flex items-center gap-2">
      {Object.entries(tfStatuses).map(([tf, status]) => {
        const color =
          status === "complete" ? "text-bullish"
          : status === "scanning" ? "text-yellow-500"
          : status === "error" ? "text-bearish"
          : "text-muted-foreground";
        const icon =
          status === "complete" ? "✓"
          : status === "scanning" ? "⟳"
          : status === "error" ? "✗"
          : "·";
        return (
          <span key={tf} className={`flex items-center gap-0.5 text-[10px] font-display font-medium ${color}`}>
            <span>{icon}</span>
            <span>{TF_LABELS[tf] || tf}</span>
          </span>
        );
      })}
    </div>
  );

  if (showComplete && completeDuration) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          disabled
          className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold font-display transition-all"
        >
          <Check className="w-3.5 h-3.5" />
          ✓ {completeTotal} pairs · 4 TFs · {formatDuration(completeDuration)}
        </button>
        {tfStatusRow}
      </div>
    );
  }

  if (isScanning) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          disabled
          className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold font-display bg-card border border-border text-foreground overflow-hidden"
        >
          <div className="relative w-5 h-5 shrink-0">
            <div className="absolute inset-0 rounded-full" style={ringStyle} />
            <div className="absolute inset-[2px] rounded-full bg-card" />
            <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-primary tabular-nums">
              {progress}
            </span>
          </div>
          <span className="tabular-nums">
            {done}/{total}
          </span>
          {eta !== null && eta > 0 && (
            <span className="text-muted-foreground">· ETA {eta}s</span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {tfStatusRow}
          {currentSymbol && (
            <span className="text-[9px] text-muted-foreground font-display truncate max-w-[120px]">
              {currentSymbol}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={onScan}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold font-display hover:bg-primary/90 transition-colors active:scale-95"
      >
        <Zap className="w-3.5 h-3.5" />
        Scan All
        <span className="px-1.5 py-0.5 rounded bg-primary-foreground/15 text-[10px] font-bold">
          4 TFs
        </span>
      </button>
      {lastScanAt && agoText && (
        <span className="text-[9px] text-muted-foreground font-display">
          Last: {lastScanDuration ? formatDuration(lastScanDuration) : "—"} · {agoText}
        </span>
      )}
    </div>
  );
}

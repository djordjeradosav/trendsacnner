import { Loader2, X } from "lucide-react";

interface ScanProgressProps {
  done: number;
  total: number;
  currentSymbol: string;
  onCancel: () => void;
}

export function ScanProgress({ done, total, currentSymbol, onCancel }: ScanProgressProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Estimate remaining time: 61s per batch of 8 + ~2s processing per pair
  const batchesRemaining = Math.ceil((total - done) / 8);
  const estSecondsLeft = batchesRemaining * 61;
  const minutes = Math.floor(estSecondsLeft / 60);
  const seconds = estSecondsLeft % 60;
  const etaLabel =
    estSecondsLeft > 0
      ? `~${minutes > 0 ? `${minutes}m ` : ""}${seconds}s remaining`
      : "Finishing...";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-sm font-display font-semibold text-foreground">
            Scanning {currentSymbol}...
          </span>
          <span className="text-xs text-muted-foreground font-display">
            ({done}/{total})
          </span>
        </div>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground font-display">
        <span>{pct}% complete</span>
        <span>{etaLabel}</span>
      </div>
    </div>
  );
}

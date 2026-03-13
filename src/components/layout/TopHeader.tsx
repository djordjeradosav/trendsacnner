import { User, Radar, Loader2, Clock } from "lucide-react";
import { formatCountdown } from "@/hooks/useAutoScan";
import { NotificationBell } from "./NotificationBell";

interface TopHeaderProps {
  lastScan?: string | null;
  isLive?: boolean;
  scanning?: boolean;
  scanDone?: number;
  scanTotal?: number;
  onRunScan?: () => void;
  timeUntilNextScan?: number | null;
  isAutoScanEnabled?: boolean;
  autoScanAgo?: number | null;
}

export function TopHeader({
  lastScan,
  isLive = false,
  scanning = false,
  scanDone = 0,
  scanTotal = 0,
  onRunScan,
  timeUntilNextScan,
  isAutoScanEnabled,
  autoScanAgo,
}: TopHeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-display">
          <span>Last scan:</span>
          <span className="text-foreground">
            {lastScan ?? "No scans yet"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isLive || scanning ? (
            <>
              <div className="w-2 h-2 rounded-full bg-primary pulse-live" />
              <span className="text-xs font-display text-primary">
                {scanning ? "SCANNING" : "LIVE"}
              </span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              <span className="text-xs font-display text-muted-foreground">IDLE</span>
            </>
          )}
        </div>

        {/* Auto-scan ago indicator */}
        {autoScanAgo !== null && autoScanAgo !== undefined && !scanning && (
          <span className="text-xs text-muted-foreground font-display">
            Auto-scanned {autoScanAgo < 1 ? "just now" : `${autoScanAgo}m ago`}
          </span>
        )}

        {/* Countdown to next scan */}
        {isAutoScanEnabled && !scanning && timeUntilNextScan !== null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-display">
            <Clock className="w-3 h-3" />
            <span>Next: {formatCountdown(timeUntilNextScan)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onRunScan}
          disabled={scanning}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold font-display hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {scanning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Scanning... ({scanDone}/{scanTotal})
            </>
          ) : (
            <>
              <Radar className="w-3.5 h-3.5" />
              Run scan
            </>
          )}
        </button>
        <NotificationBell />
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}

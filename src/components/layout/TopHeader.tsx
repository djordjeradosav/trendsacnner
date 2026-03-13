import { Radar, Loader2, Clock } from "lucide-react";
import { formatCountdown } from "@/hooks/useAutoScan";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { MobileMenuButton } from "./MobileMenu";

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
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-6">
      {/* Mobile: logo + hamburger. Desktop: scan info */}
      <div className="flex items-center gap-3">
        {/* Mobile logo */}
        <div className="flex md:hidden items-center gap-2">
          <Radar className="w-5 h-5 text-primary" />
          <span className="font-display font-bold text-foreground text-sm">TrendScan</span>
        </div>

        {/* Desktop scan info */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-display">
            <span>Last scan:</span>
            <span className="text-foreground">{lastScan ?? "No scans yet"}</span>
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

          {autoScanAgo !== null && autoScanAgo !== undefined && !scanning && (
            <span className="text-xs text-muted-foreground font-display">
              Auto-scanned {autoScanAgo < 1 ? "just now" : `${autoScanAgo}m ago`}
            </span>
          )}

          {isAutoScanEnabled && !scanning && timeUntilNextScan !== null && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-display">
              <Clock className="w-3 h-3" />
              <span>Next: {formatCountdown(timeUntilNextScan)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Desktop scan button */}
        <button
          onClick={onRunScan}
          disabled={scanning}
          className="hidden md:inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold font-display hover:bg-primary/90 transition-colors disabled:opacity-60"
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
        <div className="hidden md:block">
          <UserMenu />
        </div>
        <MobileMenuButton />
      </div>
    </header>
  );
}

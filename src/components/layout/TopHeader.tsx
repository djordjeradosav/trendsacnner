import { Radar, Clock } from "lucide-react";
import { formatCountdown } from "@/hooks/useAutoScan";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { MobileMenuButton } from "./MobileMenu";
import { WsStatusIndicator } from "./WsStatusIndicator";
import { type WsStatus } from "@/services/tickFeedService";

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
  wsStatus?: WsStatus;
  wsPairCount?: number;
  wsEligible?: boolean;
  onWsReconnect?: () => void;
}

export function TopHeader({
  lastScan,
  isLive = false,
  scanning = false,
  onRunScan,
  timeUntilNextScan,
  isAutoScanEnabled,
  autoScanAgo,
  wsStatus = "disconnected",
  wsPairCount = 0,
  wsEligible = false,
  onWsReconnect,
}: TopHeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-background md:bg-card/50 md:backdrop-blur-sm flex items-center justify-between px-4 md:px-6">
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
        <NotificationBell />
        <div className="hidden md:block">
          <UserMenu />
        </div>
        <MobileMenuButton />
      </div>
    </header>
  );
}

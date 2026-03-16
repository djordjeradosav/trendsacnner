import { Wifi, WifiOff } from "lucide-react";
import { type WsStatus } from "@/services/tickFeedService";

interface WsStatusIndicatorProps {
  status: WsStatus;
  pairCount: number;
  isEligible: boolean;
  onReconnect: () => void;
}

export function WsStatusIndicator({ status, pairCount, isEligible, onReconnect }: WsStatusIndicatorProps) {
  if (!isEligible) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
        <span className="hidden lg:inline">Feed paused</span>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" />
        <span className="hidden lg:inline">Connecting…</span>
      </div>
    );
  }

  if (status === "live") {
    return (
      <div className="flex items-center gap-1.5 text-xs font-mono text-primary">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-primary" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
        </span>
        <Wifi className="w-3 h-3" />
        <span className="hidden lg:inline">Live · {pairCount}</span>
      </div>
    );
  }

  // disconnected
  return (
    <button
      onClick={onReconnect}
      className="flex items-center gap-1.5 text-xs font-mono text-destructive hover:underline cursor-pointer"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
      <WifiOff className="w-3 h-3" />
      <span className="hidden lg:inline">Reconnect</span>
    </button>
  );
}

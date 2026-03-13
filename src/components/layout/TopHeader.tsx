import { User } from "lucide-react";

interface TopHeaderProps {
  lastScan?: string | null;
  isLive?: boolean;
}

export function TopHeader({ lastScan, isLive = false }: TopHeaderProps) {
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
          {isLive ? (
            <>
              <div className="w-2 h-2 rounded-full bg-primary pulse-live" />
              <span className="text-xs font-display text-primary">LIVE</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              <span className="text-xs font-display text-muted-foreground">IDLE</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}

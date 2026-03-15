import { useMemo } from "react";
import { Settings2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 24) return "Good evening";
  return "Good night";
}

export function DashboardGreeting() {
  const { user } = useAuth();
  const greeting = useMemo(() => getGreeting(), []);

  const displayName = user?.user_metadata?.full_name
    || user?.email?.split("@")[0]
    || "Trader";

  return (
    <div className="space-y-0.5">
      <h1 className="font-medium text-[22px] text-foreground">
        {greeting},{" "}
        <span className="capitalize text-primary">{displayName}</span>
      </h1>
      <p className="text-[12px] flex items-center gap-1.5 text-muted-foreground">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "hsl(var(--primary))" }} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "hsl(var(--primary))" }} />
        </span>
        Live market monitoring active · Auto-scan every 10 min
      </p>
    </div>
  );
}

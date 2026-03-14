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
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <h1
          className="font-medium text-foreground"
          style={{ fontSize: "26px" }}
        >
          {greeting},{" "}
          <span className="capitalize">{displayName}</span>.
        </h1>
        <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>
          <span style={{ color: "hsl(var(--bullish))" }}>↻</span>
          {"  "}Trading assistant that never sleeps
        </p>
      </div>

      <button
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors"
        style={{
          border: "0.5px solid hsl(var(--border))",
          color: "hsl(var(--muted-foreground))",
          background: "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "hsl(var(--secondary))";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Settings2 className="w-3.5 h-3.5" />
        Personalize
      </button>
    </div>
  );
}

import { Radar } from "lucide-react";

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Skeleton stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-muted animate-pulse" />
            <div className="h-7 w-12 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>

      {/* Skeleton filter bar */}
      <div className="flex gap-3">
        <div className="h-9 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="h-9 w-48 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Skeleton heatmap grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-muted/50 animate-pulse"
            style={{ minHeight: "90px" }}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Radar className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold font-display text-foreground">
          Awaiting first scan
        </h2>
        <p className="text-sm text-muted-foreground max-w-md text-center">
          Run your first scan to populate the dashboard with live market data, heatmaps, and trend analysis.
        </p>
        <button className="mt-2 inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors">
          <Radar className="w-4 h-4" />
          Run first scan
        </button>
      </div>
    </div>
  );
}

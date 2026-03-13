import { motion } from "framer-motion";
import { Radar } from "lucide-react";

interface EmptyStateProps {
  onRunScan: () => void;
}

export function EmptyState({ onRunScan }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 opacity-40">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="w-[100px] h-[60px] sm:w-[140px] sm:h-[80px] rounded-lg bg-muted animate-pulse"
          />
        ))}
      </div>
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold text-foreground font-display">No scan data yet</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Run your first scan to see live trends, heatmaps, and leaderboards across all your trading pairs.
        </p>
        <button
          onClick={onRunScan}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          <Radar className="w-4 h-4" />
          Run your first scan
        </button>
      </div>
    </div>
  );
}

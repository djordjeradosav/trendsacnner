import { useMTFAlignments } from "@/hooks/useMTFAlignments";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function MTFAlignmentWidget() {
  const { perfectBullish, perfectBearish, isLoading } = useMTFAlignments();
  const navigate = useNavigate();

  if (isLoading || (perfectBullish.length === 0 && perfectBearish.length === 0)) return null;

  return (
    <button
      onClick={() => navigate("/scanner")}
      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card border border-amber-500/30 hover:border-amber-500/50 transition-colors w-full text-left"
    >
      <Target className="w-4 h-4 text-amber-400 shrink-0" />
      <div className="flex items-center gap-3 text-xs font-display flex-wrap">
        {perfectBullish.length > 0 && (
          <span className="flex items-center gap-1 text-bullish">
            <TrendingUp className="w-3 h-3" />
            {perfectBullish.length} perfect bullish
          </span>
        )}
        {perfectBearish.length > 0 && (
          <span className="flex items-center gap-1 text-bearish">
            <TrendingDown className="w-3 h-3" />
            {perfectBearish.length} perfect bearish
          </span>
        )}
      </div>
      <span className="text-[9px] text-muted-foreground ml-auto font-mono">MTF 4/4</span>
    </button>
  );
}

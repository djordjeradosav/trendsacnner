import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Brain, RefreshCw, Lock, Target, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PairAnalysis {
  summary: string;
  bias: "bullish" | "neutral" | "bearish";
  keyLevel: string;
  risk: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

interface Props {
  pairId: string;
  timeframe: string;
  isAuthenticated: boolean;
}

export function PairAnalysisCard({ pairId, timeframe, isAuthenticated }: Props) {
  const [analysis, setAnalysis] = useState<PairAnalysis | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const fetchAnalysis = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-pair", {
        body: { pairId, timeframe },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.analysis) {
        setAnalysis(data.analysis);
        setCreatedAt(data.created_at);
        setCached(data.cached ?? false);
      }
    } catch (err) {
      // Silently fail on first load — user can manually trigger
      console.error("Pair analysis fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [pairId, timeframe, isAuthenticated]);

  useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

  const handleRefresh = async () => {
    setGenerating(true);
    try {
      // Force regeneration by calling without cache
      const { data, error } = await supabase.functions.invoke("analyze-pair", {
        body: { pairId, timeframe, force: true },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis);
      setCreatedAt(data.created_at);
      setCached(false);
      toast({ title: "Analysis updated" });
    } catch (err) {
      toast({
        title: "Analysis failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  // Locked state for unauthenticated
  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 relative overflow-hidden opacity-60">
        <div className="absolute inset-0 bg-card/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-2">
          <Lock className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm font-display text-foreground">Sign in to unlock AI analysis</p>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-16" />
          <Skeleton className="h-10" />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-16" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 flex flex-col items-center gap-3">
        <Brain className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No analysis available yet</p>
        <Button onClick={handleRefresh} disabled={generating} size="sm" className="gap-1.5">
          {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
          Generate Analysis
        </Button>
      </div>
    );
  }

  const biasColor =
    analysis.bias === "bullish"
      ? "bg-bullish/15 text-bullish border-bullish/30"
      : analysis.bias === "bearish"
        ? "bg-bearish/15 text-bearish border-bearish/30"
        : "bg-muted text-neutral-tone border-border";

  const BiasIcon = analysis.bias === "bullish" ? TrendingUp : analysis.bias === "bearish" ? TrendingDown : Minus;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-4 pb-0">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold text-foreground">AI Analysis</h3>
          <span className={`inline-flex items-center gap-1 text-[10px] font-display font-bold px-2 py-0.5 rounded-md border ${biasColor}`}>
            <BiasIcon className="w-3 h-3" />
            {analysis.bias.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {createdAt && (
            <span className="text-[10px] text-muted-foreground font-body">
              {cached ? `cached ${timeAgo(createdAt)}` : timeAgo(createdAt)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={generating}
            className="text-[11px] text-primary hover:text-primary/80 font-display font-medium flex items-center gap-1 transition-colors"
          >
            {generating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Summary */}
        {analysis.summary && (
          <p className="text-sm font-body text-foreground/90 leading-relaxed">{analysis.summary}</p>
        )}

        {/* Key Level */}
        {analysis.keyLevel && (
          <div className="rounded-md bg-muted/50 p-3 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-display font-semibold text-muted-foreground uppercase tracking-wider">Key Level</span>
            </div>
            <p className="text-sm font-body text-foreground/80">{analysis.keyLevel}</p>
          </div>
        )}

        {/* Risk */}
        {analysis.risk && (
          <div className="rounded-md bg-muted/50 p-3 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-display font-semibold text-amber-400 uppercase tracking-wider">Risk</span>
            </div>
            <p className="text-sm font-body text-foreground/80">{analysis.risk}</p>
          </div>
        )}
      </div>
    </div>
  );
}

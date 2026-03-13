import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Brain, RefreshCw, Eye, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface MarketBrief {
  overview: string;
  themes: string[];
  watchPairs: { symbol: string; reason: string }[];
  contrarian: string;
}

interface StoredBrief {
  brief: MarketBrief;
  created_at: string;
  scan_score_avg: number | null;
}

const BULLISH_KEYWORDS = ["strength", "bullish", "bid", "rally", "risk-on", "upside", "breakout", "momentum"];
const BEARISH_KEYWORDS = ["weakness", "bearish", "sell", "risk-off", "downside", "breakdown", "decline", "defensive"];

function isThemeBullish(theme: string): boolean | null {
  const lower = theme.toLowerCase();
  if (BULLISH_KEYWORDS.some((k) => lower.includes(k))) return true;
  if (BEARISH_KEYWORDS.some((k) => lower.includes(k))) return false;
  return null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function MarketBriefCard({ timeframe }: { timeframe: string }) {
  const [brief, setBrief] = useState<StoredBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const fetchLatestBrief = useCallback(async () => {
    const { data } = await supabase
      .from("market_briefs")
      .select("brief, created_at, scan_score_avg")
      .eq("timeframe", timeframe)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setBrief({ brief: data[0].brief as unknown as MarketBrief, created_at: data[0].created_at, scan_score_avg: data[0].scan_score_avg });
    }
    setLoading(false);
  }, [timeframe]);

  useEffect(() => { fetchLatestBrief(); }, [fetchLatestBrief]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-market-brief", {
        body: { timeframe },
      });

      if (error) throw new Error(error.message);
      if (data?.error) {
        toast({ title: "No scan data", description: data.error });
        return;
      }

      setBrief({
        brief: data.brief,
        created_at: data.timestamp,
        scan_score_avg: data.avgScore,
      });
      toast({ title: "Market brief generated", description: "AI analysis is ready." });
    } catch (err) {
      toast({
        title: "Brief generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20" />
        <Skeleton className="h-4 w-60" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 flex flex-col items-center gap-3">
        <Brain className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm font-display text-foreground">No market brief yet</p>
        <p className="text-xs text-muted-foreground">Generate an AI analysis of current market conditions</p>
        <Button onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          {generating ? "Generating..." : "Generate Brief"}
        </Button>
      </div>
    );
  }

  const b = brief.brief;

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-0">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold text-foreground">AI Market Brief</h3>
          {brief.scan_score_avg != null && (
            <span className="text-[10px] font-display px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Avg: {brief.scan_score_avg}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-body">
            Generated {timeAgo(brief.created_at)}
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={generating} className="h-7 px-2 gap-1 text-xs">
                {generating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Regenerate
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Regenerate Market Brief?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will call the AI to generate a new analysis. Each generation uses a small amount of AI credits.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleGenerate}>Generate</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Overview */}
        {b.overview && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-display font-semibold text-muted-foreground uppercase tracking-wider">Overview</span>
            </div>
            <p className="text-sm font-body text-foreground/90 leading-relaxed">{b.overview}</p>
          </div>
        )}

        {/* Themes */}
        {b.themes && b.themes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {b.themes.map((theme, i) => {
              const sentiment = isThemeBullish(theme);
              const cls =
                sentiment === true
                  ? "bg-bullish/15 text-bullish border-bullish/30"
                  : sentiment === false
                    ? "bg-bearish/15 text-bearish border-bearish/30"
                    : "bg-muted text-muted-foreground border-border";
              return (
                <span key={i} className={`text-[11px] font-display px-2 py-0.5 rounded-full border ${cls}`}>
                  {theme}
                </span>
              );
            })}
          </div>
        )}

        {/* Watch Pairs */}
        {b.watchPairs && b.watchPairs.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-display font-semibold text-muted-foreground uppercase tracking-wider">Pairs to Watch</span>
            </div>
            <div className="space-y-1.5">
              {b.watchPairs.map((wp, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="font-display font-bold text-foreground shrink-0">{wp.symbol}</span>
                  <span className="text-muted-foreground font-body">— {wp.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contrarian */}
        {b.contrarian && (
          <div className="rounded-md bg-muted/50 p-3 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-display font-semibold text-amber-400 uppercase tracking-wider">Contrarian</span>
            </div>
            <p className="text-sm font-body text-foreground/80">{b.contrarian}</p>
          </div>
        )}
      </div>
    </div>
  );
}

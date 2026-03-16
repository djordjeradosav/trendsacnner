import { useMTFAlignments, type MTFAlignmentRow } from "@/hooks/useMTFAlignments";
import { TrendingUp, TrendingDown, Star, Target } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

function trendColor(trend: string): string {
  if (trend === "bullish") return "text-bullish";
  if (trend === "bearish") return "text-bearish";
  return "text-muted-foreground";
}

function TFScoreBadge({ data, label }: { data: { score: number; trend: string } | null; label: string }) {
  if (!data) return <span className="text-[9px] text-muted-foreground font-mono">{label}: —</span>;
  const color = data.trend === "bullish" ? "text-bullish" : data.trend === "bearish" ? "text-bearish" : "text-muted-foreground";
  return (
    <span className={`text-[9px] font-mono ${color}`}>
      {label}: {Math.round(data.score)}
    </span>
  );
}

function AlignmentRow({ item }: { item: MTFAlignmentRow }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/pair/${item.symbol}`)}
      className="flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-accent/50 transition-colors"
    >
      {item.label === "Perfect" && <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
      <span className="text-sm font-display font-semibold text-foreground flex-1">{item.symbol}</span>
      <div className="flex items-center gap-2">
        <TFScoreBadge data={item.scores_5m} label="5M" />
        <TFScoreBadge data={item.scores_30m} label="30M" />
        <TFScoreBadge data={item.scores_1h} label="1H" />
        <TFScoreBadge data={item.scores_4h} label="4H" />
      </div>
      <div className="flex items-center gap-1.5 ml-2">
        {item.direction === "bullish" ? <TrendingUp className="w-3.5 h-3.5 text-bullish" /> : item.direction === "bearish" ? <TrendingDown className="w-3.5 h-3.5 text-bearish" /> : null}
        <span className={`text-xs font-display font-bold ${trendColor(item.direction)}`}>
          {Math.round(item.alignment_score)}
        </span>
      </div>
    </button>
  );
}

export function MTFLeaderboard() {
  const { alignments, perfectBullish, perfectBearish } = useMTFAlignments();

  const strong = alignments.filter((a) => a.label === "Strong" || a.label === "Perfect");

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 p-4 pb-2">
        <Target className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-display font-semibold text-foreground">MTF Alignment</h3>
      </div>

      <Tabs defaultValue="perfect">
        <TabsList className="mx-4 mb-2">
          <TabsTrigger value="perfect" className="text-[11px]">
            🎯 Perfect ({perfectBullish.length + perfectBearish.length})
          </TabsTrigger>
          <TabsTrigger value="strong" className="text-[11px]">
            Strong ({strong.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="text-[11px]">
            All ({alignments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfect" className="mt-0">
          {perfectBullish.length > 0 && (
            <div>
              <div className="px-4 py-1.5 text-[10px] font-display text-bullish uppercase tracking-wider">
                Bullish Convergence ({perfectBullish.length})
              </div>
              <div className="divide-y divide-border">
                {perfectBullish.map((a) => <AlignmentRow key={a.id} item={a} />)}
              </div>
            </div>
          )}
          {perfectBearish.length > 0 && (
            <div>
              <div className="px-4 py-1.5 text-[10px] font-display text-bearish uppercase tracking-wider">
                Bearish Convergence ({perfectBearish.length})
              </div>
              <div className="divide-y divide-border">
                {perfectBearish.map((a) => <AlignmentRow key={a.id} item={a} />)}
              </div>
            </div>
          )}
          {perfectBullish.length === 0 && perfectBearish.length === 0 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">No perfect alignments found. Run an MTF scan first.</p>
          )}
        </TabsContent>

        <TabsContent value="strong" className="mt-0">
          <div className="divide-y divide-border">
            {strong.map((a) => <AlignmentRow key={a.id} item={a} />)}
            {strong.length === 0 && <p className="px-4 py-3 text-xs text-muted-foreground">No strong alignments yet</p>}
          </div>
        </TabsContent>

        <TabsContent value="all" className="mt-0">
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {alignments.slice(0, 30).map((a) => <AlignmentRow key={a.id} item={a} />)}
            {alignments.length === 0 && <p className="px-4 py-3 text-xs text-muted-foreground">No MTF data yet</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

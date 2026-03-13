import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useWatchlists } from "@/hooks/useWatchlists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Plus, Star, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface PairScore {
  pairId: string;
  symbol: string;
  name: string;
  category: string;
  score: number;
  trend: string;
  scannedAt: string | null;
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-[hsl(142_40%_12%)] border-[hsl(142_50%_30%)]";
  if (score >= 65) return "bg-[hsl(142_30%_8%)] border-[hsl(142_40%_20%)]";
  if (score >= 50) return "bg-secondary border-border";
  if (score >= 36) return "bg-[hsl(0_30%_8%)] border-[hsl(0_40%_20%)]";
  return "bg-[hsl(0_40%_12%)] border-[hsl(0_50%_30%)]";
}

function getScoreColor(score: number): string {
  if (score >= 65) return "text-bullish";
  if (score >= 36) return "text-neutral-tone";
  return "text-bearish";
}

function TrendArrow({ trend }: { trend: string }) {
  if (trend === "bullish") return <TrendingUp className="w-3.5 h-3.5 text-bullish" />;
  if (trend === "bearish") return <TrendingDown className="w-3.5 h-3.5 text-bearish" />;
  return <Minus className="w-3.5 h-3.5 text-neutral-tone" />;
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

export default function WatchlistPage() {
  const { watchlists, loading: wlLoading, createWatchlist, deleteWatchlist } = useWatchlists();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pairScores, setPairScores] = useState<PairScore[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const navigate = useNavigate();

  const selectedWl = watchlists.find((w) => w.id === selectedId);

  // Auto-select first watchlist
  useEffect(() => {
    if (!selectedId && watchlists.length > 0) setSelectedId(watchlists[0].id);
  }, [watchlists, selectedId]);

  // Fetch scores for selected watchlist pairs
  useEffect(() => {
    if (!selectedWl || selectedWl.pair_ids.length === 0) {
      setPairScores([]);
      return;
    }
    const fetchScores = async () => {
      setLoadingScores(true);
      const [{ data: pairsData }, { data: scoresData }] = await Promise.all([
        supabase.from("pairs").select("id, symbol, name, category").in("id", selectedWl.pair_ids),
        supabase.from("scores").select("pair_id, score, trend, scanned_at").in("pair_id", selectedWl.pair_ids),
      ]);
      if (!pairsData) { setLoadingScores(false); return; }

      const scoreMap = new Map(scoresData?.map((s) => [s.pair_id, s]) ?? []);
      setPairScores(
        pairsData.map((p) => {
          const s = scoreMap.get(p.id);
          return {
            pairId: p.id,
            symbol: p.symbol,
            name: p.name,
            category: p.category,
            score: s ? Number(s.score) : 50,
            trend: s?.trend ?? "neutral",
            scannedAt: s?.scanned_at ?? null,
          };
        })
      );
      setLoadingScores(false);
    };
    fetchScores();
  }, [selectedWl]);

  const lastUpdated = useMemo(() => {
    const dates = pairScores.filter((p) => p.scannedAt).map((p) => new Date(p.scannedAt!).getTime());
    if (dates.length === 0) return null;
    return timeAgo(new Date(Math.max(...dates)).toISOString());
  }, [pairScores]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const wl = await createWatchlist(newName.trim());
    if (wl) { setSelectedId(wl.id); setShowCreate(false); setNewName(""); }
  };

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold font-display text-foreground mb-6">Watchlists</h1>

      {wlLoading ? (
        <div className="flex gap-4">
          <Skeleton className="w-[240px] h-[300px]" />
          <Skeleton className="flex-1 h-[300px]" />
        </div>
      ) : watchlists.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Star className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-lg font-display text-foreground">No watchlists yet</p>
          <p className="text-sm text-muted-foreground">Create your first watchlist to track your favourite pairs</p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Create watchlist
          </Button>
        </div>
      ) : (
        <div className="flex gap-4 min-h-[400px]">
          {/* Left panel */}
          <div className="w-[240px] shrink-0 rounded-lg border border-border bg-card flex flex-col">
            <div className="flex-1 divide-y divide-border overflow-y-auto">
              {watchlists.map((wl) => (
                <button
                  key={wl.id}
                  onClick={() => setSelectedId(wl.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    selectedId === wl.id ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <div>
                    <p className={`text-sm font-display font-semibold ${selectedId === wl.id ? "text-foreground" : "text-muted-foreground"}`}>
                      {wl.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{wl.pair_ids.length} pairs</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteWatchlist(wl.id); if (selectedId === wl.id) setSelectedId(null); }}
                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-bearish transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-border">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => setShowCreate(true)}>
                <Plus className="w-3.5 h-3.5" /> New watchlist
              </Button>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-1 rounded-lg border border-border bg-card p-5">
            {selectedWl ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-semibold text-foreground">{selectedWl.name}</h2>
                  {lastUpdated && (
                    <span className="text-[11px] text-muted-foreground font-body">Last updated: {lastUpdated}</span>
                  )}
                </div>
                {selectedWl.pair_ids.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <p className="text-sm text-muted-foreground">No pairs in this watchlist</p>
                    <p className="text-xs text-muted-foreground">Use the bookmark icon on any pair detail page to add pairs</p>
                  </div>
                ) : loadingScores ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[90px] rounded-lg" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {pairScores.map((p) => (
                      <Tooltip key={p.pairId}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => navigate(`/pair/${p.symbol}`)}
                            className={`relative flex flex-col items-center justify-center rounded-lg border p-3 h-[90px] transition-all duration-150 hover:scale-[1.04] hover:brightness-125 hover:z-10 cursor-pointer ${getScoreBg(p.score)}`}
                          >
                            <span className="text-[13px] font-display font-bold text-foreground leading-none">{p.symbol}</span>
                            <span className={`text-2xl font-display font-bold leading-tight ${getScoreColor(p.score)}`}>{Math.round(p.score)}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <TrendArrow trend={p.trend} />
                              <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{p.category}</span>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs font-body">
                          <p className="font-semibold">{p.name}</p>
                          <p>Score: {p.score} · {p.trend}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                Select a watchlist
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="font-display">New Watchlist</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Watchlist name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="font-body"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWatchlists } from "@/hooks/useWatchlists";
import { useScoresStore } from "@/stores/useScoresStore";
import { useEnsureFreshData } from "@/hooks/useEnsureFreshData";
import { timeAgo } from "@/lib/display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Plus, Star, Trash2, TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-bullish/15 border-bullish/30";
  if (score >= 65) return "bg-bullish/10 border-bullish/20";
  if (score >= 50) return "bg-secondary border-border";
  if (score >= 36) return "bg-bearish/10 border-bearish/20";
  return "bg-bearish/15 border-bearish/30";
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

export default function WatchlistPage() {
  useEnsureFreshData();

  const { watchlists, loading: wlLoading, createWatchlist, deleteWatchlist } = useWatchlists();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [showMobileSelector, setShowMobileSelector] = useState(false);
  const navigate = useNavigate();

  // Read from Zustand store
  const activeTimeframe = useScoresStore((s) => s.activeTimeframe);
  const pairs = useScoresStore((s) => s.pairs);

  const selectedWl = watchlists.find((w) => w.id === selectedId);

  useEffect(() => {
    if (!selectedId && watchlists.length > 0) setSelectedId(watchlists[0].id);
  }, [watchlists, selectedId]);

  // Build pair scores from store
  const pairScores = useMemo(() => {
    if (!selectedWl || selectedWl.pair_ids.length === 0) return [];
    const store = useScoresStore.getState();
    return selectedWl.pair_ids.map((pairId) => {
      const pairMeta = pairs.find((p) => p.id === pairId);
      if (!pairMeta) return null;
      const score = store.getScore(pairMeta.symbol, activeTimeframe);
      return {
        pairId,
        symbol: pairMeta.symbol,
        name: pairMeta.name,
        category: pairMeta.category,
        score: score ? score.score : 50,
        trend: score?.trend ?? "neutral",
        rsi: score?.rsi ?? null,
        adx: score?.adx ?? null,
        scannedAt: score?.scanned_at ?? null,
      };
    }).filter(Boolean) as {
      pairId: string;
      symbol: string;
      name: string;
      category: string;
      score: number;
      trend: string;
      rsi: number | null;
      adx: number | null;
      scannedAt: string | null;
    }[];
  }, [selectedWl, pairs, activeTimeframe]);

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
      <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground mb-4 sm:mb-6">Watchlists</h1>

      {wlLoading ? (
        <div className="flex flex-col md:flex-row gap-4">
          <Skeleton className="w-full md:w-[240px] h-[200px] md:h-[300px]" />
          <Skeleton className="flex-1 h-[300px]" />
        </div>
      ) : watchlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-4">
          <Star className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-lg font-display text-foreground">No watchlists yet</p>
          <p className="text-sm text-muted-foreground text-center">Create your first watchlist to track your favourite pairs</p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Create watchlist
          </Button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4 min-h-[300px] md:min-h-[400px]">
          {/* Mobile watchlist selector */}
          <div className="md:hidden">
            <button
              onClick={() => setShowMobileSelector(!showMobileSelector)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-primary" />
                <span className="text-sm font-display font-semibold text-foreground">
                  {selectedWl?.name || "Select watchlist"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {selectedWl ? `${selectedWl.pair_ids.length} pairs` : ""}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showMobileSelector ? "rotate-180" : ""}`} />
            </button>

            {showMobileSelector && (
              <div className="mt-1 rounded-lg border border-border bg-card divide-y divide-border">
                {watchlists.map((wl) => (
                  <button
                    key={wl.id}
                    onClick={() => { setSelectedId(wl.id); setShowMobileSelector(false); }}
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
                <div className="p-3">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => setShowCreate(true)}>
                    <Plus className="w-3.5 h-3.5" /> New watchlist
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Desktop left panel */}
          <div className="hidden md:flex w-[240px] shrink-0 rounded-lg border border-border bg-card flex-col">
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
          <div className="flex-1 rounded-lg border border-border bg-card p-3 sm:p-5">
            {selectedWl ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
                  <h2 className="text-lg font-display font-semibold text-foreground">{selectedWl.name}</h2>
                  {lastUpdated && (
                    <span className="text-[11px] text-muted-foreground font-body">Last updated: {lastUpdated}</span>
                  )}
                </div>
                {selectedWl.pair_ids.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 sm:py-16 gap-3">
                    <p className="text-sm text-muted-foreground">No pairs in this watchlist</p>
                    <p className="text-xs text-muted-foreground text-center">Use the bookmark icon on any pair detail page to add pairs</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {pairScores.map((p) => (
                      <button
                        key={p.pairId}
                        onClick={() => navigate(`/pair/${p.symbol}`)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all hover:brightness-110 cursor-pointer ${getScoreBg(p.score)}`}
                      >
                        <span className="text-sm font-display font-bold text-foreground w-20 text-left">{p.symbol}</span>
                        <span className={`text-lg font-display font-bold w-10 text-right ${getScoreColor(p.score)}`}>{Math.round(p.score)}</span>
                        <TrendArrow trend={p.trend} />
                        <span className={`text-[10px] font-display font-semibold uppercase ${
                          p.trend === "bullish" ? "text-bullish" : p.trend === "bearish" ? "text-bearish" : "text-neutral-tone"
                        }`}>
                          {p.trend}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          RSI {p.rsi?.toFixed(1) ?? "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ADX {p.adx?.toFixed(1) ?? "—"}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {p.scannedAt ? timeAgo(p.scannedAt) : "—"}
                        </span>
                      </button>
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

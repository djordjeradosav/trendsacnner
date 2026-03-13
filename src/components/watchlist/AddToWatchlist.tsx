import { useState } from "react";
import { Bookmark, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWatchlists } from "@/hooks/useWatchlists";

interface AddToWatchlistProps {
  pairId: string;
}

export function AddToWatchlist({ pairId }: AddToWatchlistProps) {
  const { watchlists, togglePairInWatchlist, createWatchlist } = useWatchlists();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);

  const isInAny = watchlists.some((w) => w.pair_ids.includes(pairId));

  const handleCreateAndAdd = async () => {
    if (!newName.trim()) return;
    const wl = await createWatchlist(newName.trim());
    if (wl) {
      await togglePairInWatchlist(wl.id, pairId);
      setNewName("");
      setShowNew(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Bookmark className={`w-4 h-4 ${isInAny ? "fill-primary text-primary" : ""}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="text-xs font-display font-semibold text-foreground px-2 py-1.5">Add to watchlist</p>
        <div className="space-y-0.5">
          {watchlists.map((wl) => {
            const isIn = wl.pair_ids.includes(pairId);
            return (
              <button
                key={wl.id}
                onClick={() => togglePairInWatchlist(wl.id, pairId)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-body hover:bg-accent transition-colors"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isIn ? "bg-primary border-primary" : "border-border"}`}>
                  {isIn && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className={isIn ? "text-foreground" : "text-muted-foreground"}>{wl.name}</span>
              </button>
            );
          })}
        </div>
        {showNew ? (
          <div className="flex gap-1.5 mt-2 px-1">
            <Input
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateAndAdd()}
              className="h-7 text-xs"
              autoFocus
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCreateAndAdd} disabled={!newName.trim()}>
              Add
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setShowNew(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 mt-1 rounded-md text-xs font-body text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New watchlist
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

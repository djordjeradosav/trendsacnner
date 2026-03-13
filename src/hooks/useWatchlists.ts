import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Watchlist {
  id: string;
  name: string;
  pair_ids: string[];
  created_at: string;
}

export function useWatchlists() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWatchlists = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("watchlists")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (data) setWatchlists(data.map((w) => ({ ...w, pair_ids: w.pair_ids ?? [] })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchWatchlists(); }, [fetchWatchlists]);

  const createWatchlist = async (name: string): Promise<Watchlist | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("watchlists")
      .insert({ name, user_id: user.id, pair_ids: [] })
      .select()
      .single();
    if (data) {
      const wl = { ...data, pair_ids: data.pair_ids ?? [] };
      setWatchlists((prev) => [...prev, wl]);
      return wl;
    }
    return null;
  };

  const togglePairInWatchlist = async (watchlistId: string, pairId: string) => {
    const wl = watchlists.find((w) => w.id === watchlistId);
    if (!wl) return;
    const has = wl.pair_ids.includes(pairId);
    const newIds = has ? wl.pair_ids.filter((id) => id !== pairId) : [...wl.pair_ids, pairId];
    const { error } = await supabase
      .from("watchlists")
      .update({ pair_ids: newIds })
      .eq("id", watchlistId);
    if (!error) {
      setWatchlists((prev) =>
        prev.map((w) => (w.id === watchlistId ? { ...w, pair_ids: newIds } : w))
      );
    }
  };

  const deleteWatchlist = async (watchlistId: string) => {
    await supabase.from("watchlists").delete().eq("id", watchlistId);
    setWatchlists((prev) => prev.filter((w) => w.id !== watchlistId));
  };

  return { watchlists, loading, createWatchlist, togglePairInWatchlist, deleteWatchlist, refetch: fetchWatchlists };
}

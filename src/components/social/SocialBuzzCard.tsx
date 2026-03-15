import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Minus, ExternalLink, MessageCircle } from "lucide-react";

interface SocialPost {
  id: string;
  source: string;
  pair_symbol: string;
  content: string;
  sentiment: string;
  confidence: number;
  upvotes: number;
  original_url: string;
  published_at: string;
}

interface Props {
  pairSymbol: string;
}

const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  reddit: { bg: "hsl(16 100% 50% / 0.15)", text: "#ff4500", label: "Reddit" },
  stocktwits: { bg: "hsl(200 80% 50% / 0.15)", text: "#4da6ff", label: "StockTwits" },
  twitter: { bg: "hsl(200 100% 50% / 0.15)", text: "#1da1f2", label: "X" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SocialBuzzCard({ pairSymbol }: Props) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("social_sentiment")
        .select("*")
        .eq("pair_symbol", pairSymbol)
        .gte("published_at", cutoff)
        .order("published_at", { ascending: false })
        .limit(50);
      setPosts((data as SocialPost[]) || []);
      setLoading(false);
    };
    fetchPosts();

    // Realtime subscription for new posts
    const channel = supabase
      .channel(`social-${pairSymbol}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "social_sentiment",
        filter: `pair_symbol=eq.${pairSymbol}`,
      }, (payload) => {
        setPosts(prev => [payload.new as SocialPost, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [pairSymbol]);

  const stats = useMemo(() => {
    if (posts.length === 0) return null;
    let bullish = 0, bearish = 0, neutral = 0;
    posts.forEach(p => {
      if (p.sentiment === "bullish") bullish++;
      else if (p.sentiment === "bearish") bearish++;
      else neutral++;
    });
    const total = posts.length;
    return {
      total,
      bullish, bearish, neutral,
      bullPct: Math.round((bullish / total) * 100),
      bearPct: Math.round((bearish / total) * 100),
      neutPct: Math.round((neutral / total) * 100),
      netScore: ((bullish - bearish) / total),
    };
  }, [posts]);

  const displayPosts = expanded ? posts : posts.slice(0, 5);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-display font-semibold text-foreground">Social Buzz</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 rounded bg-secondary animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-display font-semibold text-foreground">Social Buzz</span>
        </div>
        <p className="text-sm text-muted-foreground">No social mentions found for {pairSymbol} in the last 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" style={{ color: "hsl(var(--accent-cyan, 190 80% 50%))" }} />
          <span className="text-sm font-display font-semibold text-foreground">Social Buzz</span>
        </div>
        {stats && (
          <span className="text-[11px] font-mono text-muted-foreground">
            {stats.total} mentions · 24h
          </span>
        )}
      </div>

      {/* Sentiment bar */}
      {stats && (
        <div className="mb-4 space-y-2">
          <div className="flex rounded-full overflow-hidden h-2.5" style={{ background: "hsl(var(--border))" }}>
            <div className="h-full transition-all" style={{ width: `${stats.bullPct}%`, background: "hsl(var(--bullish))" }} />
            <div className="h-full transition-all" style={{ width: `${stats.neutPct}%`, background: "hsl(var(--muted-foreground) / 0.3)" }} />
            <div className="h-full transition-all" style={{ width: `${stats.bearPct}%`, background: "hsl(var(--destructive))" }} />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span style={{ color: "hsl(var(--bullish))" }}>
              <TrendingUp className="w-3 h-3 inline mr-0.5" />{stats.bullPct}% bullish
            </span>
            <span className="text-muted-foreground">{stats.neutPct}% neutral</span>
            <span style={{ color: "hsl(var(--destructive))" }}>
              {stats.bearPct}% bearish<TrendingDown className="w-3 h-3 inline ml-0.5" />
            </span>
          </div>
        </div>
      )}

      {/* Posts feed */}
      <div className="space-y-2">
        {displayPosts.map((post) => {
          const src = SOURCE_COLORS[post.source] || SOURCE_COLORS.reddit;
          const sentColor = post.sentiment === "bullish"
            ? "hsl(var(--bullish))"
            : post.sentiment === "bearish"
            ? "hsl(var(--destructive))"
            : "hsl(var(--muted-foreground))";

          return (
            <div key={post.id} className="rounded-lg border border-border p-2.5 hover:bg-secondary/50 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{ background: src.bg, color: src.text }}>
                    {src.label}
                  </span>
                  {post.upvotes > 0 && (
                    <span className="text-[9px] text-muted-foreground font-mono">▲ {post.upvotes}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border"
                    style={{
                      color: sentColor,
                      borderColor: `${sentColor}40`,
                      background: `${sentColor}10`,
                    }}>
                    {post.sentiment === "bullish" ? "Bullish ↑" : post.sentiment === "bearish" ? "Bearish ↓" : "Neutral"}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">{timeAgo(post.published_at)}</span>
                </div>
              </div>
              <p className="text-[11px] text-foreground/80 leading-relaxed"
                style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {post.content}
              </p>
              {post.original_url && (
                <a href={post.original_url} target="_blank" rel="noopener noreferrer"
                  className="text-[9px] mt-1 inline-flex items-center gap-0.5 hover:underline"
                  style={{ color: "hsl(var(--accent-cyan, 190 80% 50%))" }}>
                  <ExternalLink className="w-2.5 h-2.5" /> View original
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Expand/collapse */}
      {posts.length > 5 && (
        <button onClick={() => setExpanded(!expanded)}
          className="mt-3 text-[11px] font-display transition-colors hover:opacity-80"
          style={{ color: "hsl(var(--accent-cyan, 190 80% 50%))" }}>
          {expanded ? "Show less" : `View all ${posts.length} social posts →`}
        </button>
      )}
    </div>
  );
}

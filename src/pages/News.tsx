import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { NewsArticle } from "@/services/newsService";

const SENTIMENT_TABS = ["All", "Positive", "Neutral", "Negative"];
const CATEGORY_TABS = ["All", "Forex", "Commodities", "Futures"];

// Map categories to pair symbols
const CATEGORY_SYMBOLS: Record<string, string[]> = {
  Forex: ["EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD","EURGBP","EURJPY","GBPJPY"],
  Commodities: ["XAUUSD","XAGUSD","USOIL","UKOIL","NATGAS"],
  Futures: ["US30","US100","US500"],
};

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NewsPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [sentiment, setSentiment] = useState("All");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const loaderRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 20;

  const fetchArticles = useCallback(async (pageNum: number, reset = false) => {
    setLoading(true);
    let query = supabase
      .from("news_articles")
      .select("*")
      .order("published_at", { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (sentiment !== "All") {
      query = query.eq("sentiment", sentiment.toLowerCase());
    }

    const { data } = await query;
    const items = (data ?? []) as unknown as NewsArticle[];

    if (items.length < PAGE_SIZE) setHasMore(false);

    setArticles((prev) => reset ? items : [...prev, ...items]);
    setLoading(false);
  }, [sentiment]);

  // Reset on filter change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchArticles(0, true);
  }, [sentiment, fetchArticles]);

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchArticles(nextPage);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page, fetchArticles]);

  // Client-side filters
  const filtered = articles.filter((a) => {
    if (search && !a.headline?.toLowerCase().includes(search.toLowerCase())) return false;
    if (category !== "All") {
      const syms = CATEGORY_SYMBOLS[category] ?? [];
      const hasMatch = (a.relevant_pairs ?? []).some((p) => syms.includes(p));
      if (!hasMatch) return false;
    }
    return true;
  });

  const lastFetchedAt = articles.length > 0 ? articles[0].fetched_at : null;
  const updatedAgo = lastFetchedAt ? timeAgo(lastFetchedAt) : "—";

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold" style={{ color: "hsl(var(--foreground))" }}>
          Market News
        </h1>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--bullish))" }} />
          <span className="font-display" style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
            Updated {updatedAgo}
          </span>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1">
          {SENTIMENT_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setSentiment(t)}
              className="px-3 py-1.5 rounded-md font-display transition-colors"
              style={{
                fontSize: "11px",
                background: sentiment === t ? "hsl(var(--secondary))" : "transparent",
                color: sentiment === t ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                border: sentiment === t ? "0.5px solid hsl(var(--border))" : "0.5px solid transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {CATEGORY_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setCategory(t)}
              className="px-3 py-1.5 rounded-md font-display transition-colors"
              style={{
                fontSize: "11px",
                background: category === t ? "hsl(var(--secondary))" : "transparent",
                color: category === t ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                border: category === t ? "0.5px solid hsl(var(--border))" : "0.5px solid transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
          <Input
            placeholder="Search headlines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-secondary border-border"
          />
        </div>
      </div>

      {/* Article grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((article) => (
          <NewsCard key={article.id} article={article} navigate={navigate} />
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <p className="text-center py-12" style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))" }}>
          No articles found. News will appear after the next fetch cycle.
        </p>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loaderRef} className="h-8 flex items-center justify-center mt-4">
        {loading && (
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "hsl(var(--bullish))", borderTopColor: "transparent" }} />
        )}
      </div>
    </AppLayout>
  );
}

function NewsCard({ article, navigate }: { article: NewsArticle; navigate: (path: string) => void }) {
  const sentimentDot = article.sentiment === "positive"
    ? "hsl(var(--bullish))"
    : article.sentiment === "negative"
    ? "hsl(var(--destructive))"
    : "hsl(var(--muted-foreground))";

  return (
    <div
      className="rounded-lg p-4 relative transition-colors"
      style={{
        background: "hsl(var(--card))",
        border: "0.5px solid hsl(var(--border))",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#2a3f55"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))"; }}
    >
      {/* Sentiment dot */}
      <span
        className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full"
        style={{ background: sentimentDot }}
      />

      {/* Source + time */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="font-display"
          style={{
            fontSize: "10px",
            textTransform: "uppercase",
            padding: "2px 6px",
            borderRadius: "4px",
            background: "hsl(var(--secondary))",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {article.source}
        </span>
        <span className="font-display" style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
          {timeAgo(article.published_at)}
        </span>
      </div>

      {/* Headline */}
      <h3
        className="font-medium mb-2"
        style={{
          fontSize: "14px",
          color: "hsl(var(--foreground))",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          lineHeight: "1.4",
        }}
      >
        {article.headline}
      </h3>

      {/* Summary */}
      {article.summary && (
        <p
          style={{
            fontSize: "12px",
            color: "hsl(var(--muted-foreground))",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: "1.5",
          }}
        >
          {article.summary}
        </p>
      )}

      {/* Bottom: pairs + read more */}
      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
        <div className="flex flex-wrap gap-1">
          {(article.relevant_pairs ?? []).slice(0, 4).map((sym) => (
            <button
              key={sym}
              onClick={() => navigate(`/pair/${sym}`)}
              className="font-display transition-colors hover:opacity-80"
              style={{
                fontSize: "10px",
                padding: "1px 6px",
                borderRadius: "4px",
                background: "hsl(var(--secondary))",
                border: "0.5px solid hsl(var(--border))",
                color: "hsl(var(--info))",
              }}
            >
              {sym}
            </button>
          ))}
        </div>
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-opacity hover:opacity-80"
            style={{ fontSize: "11px", color: "hsl(var(--info))" }}
          >
            Read more <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

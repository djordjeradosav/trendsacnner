import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, ExternalLink, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { NewsArticle } from "@/services/newsService";

const SENTIMENT_TABS = ["All", "Positive", "Neutral", "Negative"] as const;
const CATEGORY_TABS = ["All", "Forex", "Commodities", "Futures", "Crypto"] as const;

const CATEGORY_SYMBOLS: Record<string, string[]> = {
  Forex: ["EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD","EURGBP","EURJPY","GBPJPY"],
  Commodities: ["XAUUSD","XAGUSD","USOIL","UKOIL","NATGAS"],
  Futures: ["US30","US100","US500"],
  Crypto: ["BTCUSD","ETHUSD","BTCUSDT","ETHUSDT"],
};

const SENTIMENT_STYLES: Record<string, { bg: string; color: string }> = {
  All:      { bg: "#1e2d3d", color: "#e8f4f8" },
  Positive: { bg: "#0d2b1a", color: "#22c55e" },
  Neutral:  { bg: "#1a1a1a", color: "#7a99b0" },
  Negative: { bg: "#2b0d0d", color: "#ef4444" },
};

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function decodeEntities(str: string | null): string {
  if (!str) return "";
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

const PAGE_SIZE = 30;

export default function NewsPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [sentiment, setSentiment] = useState("All");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchArticles = useCallback(async (pageNum: number, reset = false) => {
    setLoading(true);
    let query = supabase
      .from("news_articles")
      .select("*")
      .order("published_at", { ascending: false })
      .not("headline", "ilike", "From @%")
      .not("headline", "ilike", "From http%")
      .not("headline", "is", null)
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (sentiment !== "All") {
      query = query.eq("sentiment", sentiment.toLowerCase());
    }

    if (search.length >= 3) {
      query = query.ilike("headline", `%${search}%`);
    }

    const { data } = await query;
    // Client-side filter for short headlines
    const items = ((data ?? []) as unknown as NewsArticle[]).filter(
      (a) => (a.headline?.length ?? 0) > 20
    );

    if (!data?.length || data.length < PAGE_SIZE) setHasMore(false);

    setArticles((prev) => reset ? items : [...prev, ...items]);
    setLoading(false);
  }, [sentiment, search]);

  // Reset on filter change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchArticles(0, true);
  }, [sentiment, search, fetchArticles]);

  // Client-side category filter
  const filtered = useMemo(() => {
    if (category === "All") return articles;
    const syms = CATEGORY_SYMBOLS[category] ?? [];
    return articles.filter((a) =>
      (a.relevant_pairs ?? []).some((p) => syms.includes(p))
    );
  }, [articles, category]);

  // Breaking news
  const breaking = useMemo(() => {
    return articles.find(
      (a) =>
        a.sentiment === "negative" &&
        a.published_at &&
        new Date(a.published_at) > new Date(Date.now() - 30 * 60 * 1000)
    );
  }, [articles]);

  const lastFetchedAt = articles.length > 0 ? articles[0].fetched_at ?? articles[0].published_at : null;
  const updatedAgo = lastFetchedAt ? timeAgo(lastFetchedAt) : "—";

  // Infinite scroll ref callback
  const loaderRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchArticles(nextPage);
        }
      });
      observerRef.current.observe(node);
    },
    [hasMore, loading, page, fetchArticles]
  );

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-foreground">Market News</h1>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
            Live market intelligence · Updated every 15 min
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-bullish" />
          <span className="text-[10px] text-muted-foreground font-display">
            Updated {updatedAgo}
          </span>
        </div>
      </div>

      {/* Breaking news banner */}
      {breaking && (
        <div
          className="flex items-center justify-between rounded-lg px-4 py-2.5 mb-4 cursor-pointer"
          style={{ background: "#2b0d0d", border: "0.5px solid #ef4444" }}
          onClick={() => breaking.url && window.open(breaking.url, "_blank")}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="shrink-0 flex items-center gap-1 font-display font-bold"
              style={{ fontSize: "10px", color: "#ef4444", background: "rgba(239,68,68,0.15)", padding: "2px 6px", borderRadius: "4px" }}
            >
              <Zap className="w-3 h-3" /> BREAKING
            </span>
            <span
              className="truncate text-foreground"
              style={{ fontSize: "13px" }}
            >
              {decodeEntities(breaking.headline)}
            </span>
          </div>
          <span className="shrink-0 text-[11px] font-display" style={{ color: "#ef4444" }}>
            Read →
          </span>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col gap-3 mb-4 sm:mb-5 mt-3 sm:mt-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Sentiment pills */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {SENTIMENT_TABS.map((t) => {
              const active = sentiment === t;
              const style = SENTIMENT_STYLES[t];
              return (
                <button
                  key={t}
                  onClick={() => setSentiment(t)}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-display transition-all shrink-0"
                  style={{
                    fontSize: "10px",
                    background: active ? style.bg : "transparent",
                    color: active ? style.color : "hsl(var(--muted-foreground))",
                    border: active ? `0.5px solid ${style.color}30` : "0.5px solid transparent",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-border" />

          {/* Category pills */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {CATEGORY_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setCategory(t)}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-display transition-all shrink-0"
                style={{
                  fontSize: "10px",
                  background: category === t ? "#1e2d3d" : "transparent",
                  color: category === t ? "#e8f4f8" : "hsl(var(--muted-foreground))",
                  border: category === t ? "0.5px solid #2a3f55" : "0.5px solid transparent",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
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
          <ArticleCard key={article.id} article={article} navigate={navigate} />
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <p className="text-center py-12 text-[13px] text-muted-foreground">
          No articles found. News will appear after the next fetch cycle.
        </p>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loaderRef} className="h-8 flex items-center justify-center mt-4">
        {loading && (
          <div
            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "hsl(var(--bullish))", borderTopColor: "transparent" }}
          />
        )}
        {!hasMore && articles.length > 0 && (
          <span className="text-[11px] text-muted-foreground">No more articles</span>
        )}
      </div>
    </AppLayout>
  );
}

function ArticleCard({ article, navigate }: { article: NewsArticle; navigate: (path: string) => void }) {
  const sentimentColor =
    article.sentiment === "positive" ? "#22c55e"
    : article.sentiment === "negative" ? "#ef4444"
    : "#7a99b0";
  const sentimentBg =
    article.sentiment === "positive" ? "#0d2b1a"
    : article.sentiment === "negative" ? "#2b0d0d"
    : "#1a1a1a";

  return (
    <div
      className="rounded-lg p-4 flex flex-col transition-colors cursor-pointer"
      style={{
        background: "hsl(var(--card))",
        border: "0.5px solid #1e2d3d",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#2a3f55"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1e2d3d"; }}
      onClick={() => article.url && window.open(article.url, "_blank")}
    >
      {/* Top row: source + time + sentiment badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="font-display uppercase"
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "4px",
              background: "hsl(var(--secondary))",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {article.source}
          </span>
          <span className="text-[10px] text-muted-foreground font-display">
            {timeAgo(article.published_at)}
          </span>
        </div>
        <span
          className="font-display font-semibold uppercase"
          style={{
            fontSize: "9px",
            padding: "2px 6px",
            borderRadius: "4px",
            background: sentimentBg,
            color: sentimentColor,
          }}
        >
          {article.sentiment?.toUpperCase() ?? "NEUTRAL"}
        </span>
      </div>

      {/* Headline */}
      <h3
        className="font-medium mb-2 text-foreground"
        style={{
          fontSize: "13px",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          lineHeight: "1.45",
        }}
      >
        {decodeEntities(article.headline)}
      </h3>

      {/* Summary */}
      {article.summary && (
        <p
          className="text-muted-foreground mb-3"
          style={{
            fontSize: "11px",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: "1.55",
          }}
        >
          {decodeEntities(article.summary)}
        </p>
      )}

      {/* Spacer to push footer down */}
      <div className="flex-1" />

      {/* Footer: pair chips + read more */}
      <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
        <div className="flex flex-wrap gap-1">
          {(article.relevant_pairs ?? []).slice(0, 4).map((sym) => (
            <button
              key={sym}
              onClick={(e) => { e.stopPropagation(); navigate(`/pair/${sym}`); }}
              className="font-display transition-opacity hover:opacity-80"
              style={{
                fontSize: "10px",
                padding: "1px 6px",
                borderRadius: "4px",
                cursor: "pointer",
                background: "rgba(96,165,250,0.1)",
                color: "#60a5fa",
                border: "0.5px solid rgba(96,165,250,0.3)",
              }}
            >
              {sym}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-display" style={{ color: "#60a5fa" }}>
          Read more ↗
        </span>
      </div>
    </div>
  );
}

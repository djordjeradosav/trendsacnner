import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { NewsArticle } from "@/services/newsService";

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  symbol: string;
}

export function PairNewsSection({ symbol }: Props) {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<NewsArticle[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("news_articles")
        .select("*")
        .contains("relevant_pairs", [symbol])
        .order("published_at", { ascending: false })
        .limit(5);
      if (data) setArticles(data as unknown as NewsArticle[]);
    };
    fetch();
  }, [symbol]);

  if (articles.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-sm font-display font-semibold text-foreground mb-3">Latest News</h3>
      <div className="space-y-2.5">
        {articles.map((a) => (
          <div
            key={a.id}
            className="flex items-start justify-between gap-3 py-2 border-b border-border/50 last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p
                className="font-medium truncate"
                style={{ fontSize: "13px", color: "hsl(var(--foreground))" }}
              >
                {a.headline}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="font-display"
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {a.source}
                </span>
                <span style={{ fontSize: "10px", color: "hsl(200 30% 33%)" }}>
                  {timeAgo(a.published_at)}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background:
                      a.sentiment === "positive"
                        ? "hsl(var(--bullish))"
                        : a.sentiment === "negative"
                        ? "hsl(var(--destructive))"
                        : "hsl(var(--muted-foreground))",
                  }}
                />
              </div>
            </div>
            {a.url && (
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 mt-0.5"
                style={{ color: "hsl(var(--info))" }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => navigate("/news")}
        className="mt-3 font-display transition-opacity hover:opacity-80"
        style={{ fontSize: "11px", color: "hsl(var(--bullish))" }}
      >
        See all news for {symbol} →
      </button>
    </div>
  );
}

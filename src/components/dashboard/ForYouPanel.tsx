import { useEffect, useState, useRef } from "react";
import { Sparkles, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { NewsArticle } from "@/services/newsService";

export function ForYouPanel() {
  const [topArticle, setTopArticle] = useState<NewsArticle | null>(null);
  const [allArticles, setAllArticles] = useState<NewsArticle[]>([]);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [paused, setPaused] = useState(false);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  useEffect(() => {
    const fetchNews = async () => {
      const { data } = await supabase
        .from("news_articles")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        setTopArticle(data[0] as unknown as NewsArticle);
        setAllArticles(data as unknown as NewsArticle[]);
      }
    };
    fetchNews();
  }, []);

  useEffect(() => {
    const fetchBriefing = async () => {
      setBriefingLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("generate-briefing", {
          body: {},
        });
        if (!error && data?.content) {
          setBriefing(data.content);
        }
      } catch {
        // silently skip
      } finally {
        setBriefingLoading(false);
      }
    };
    fetchBriefing();
  }, []);

  const sentimentColor = (s: string | null) => {
    if (s === "positive") return "hsl(var(--bullish))";
    if (s === "negative") return "hsl(var(--destructive))";
    return "hsl(var(--muted-foreground))";
  };

  const sentimentBg = (s: string | null) => {
    if (s === "positive") return "hsl(var(--bullish) / 0.1)";
    if (s === "negative") return "hsl(var(--destructive) / 0.1)";
    return "hsl(var(--secondary))";
  };

  const tickerItems = allArticles.length > 0 ? [...allArticles, ...allArticles] : [];
  const animDuration = Math.max(tickerItems.length * 3, 30);

  const hasContent = topArticle || briefing;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" style={{ color: "hsl(var(--bullish))" }} />
            <span className="font-semibold" style={{ fontSize: "14px", color: "hsl(var(--foreground))" }}>
              For You
            </span>
          </div>
          <p style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginTop: "2px" }}>
            Your pre-session market briefing
          </p>
        </div>
        <span className="font-display" style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
          {dateStr}
        </span>
      </div>

      {/* Featured article / AI Briefing */}
      <div
        className="rounded-lg p-4 flex-1"
        style={{
          background: "hsl(var(--secondary))",
          border: "0.5px solid hsl(var(--border))",
        }}
      >
        {hasContent ? (
          <>
            {topArticle && (
              <h3
                className="font-medium"
                style={{
                  fontSize: "16px",
                  color: "hsl(var(--foreground))",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  lineHeight: "1.4",
                }}
              >
                {topArticle.headline}
              </h3>
            )}

            {/* Market mood badges */}
            <div className="flex items-center gap-2 mt-2">
              <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
                Market Mood:
              </span>
              <span
                className="font-display"
                style={{
                  fontSize: "10px",
                  borderRadius: "4px",
                  padding: "2px 7px",
                  background: "hsl(var(--secondary))",
                  color: "hsl(var(--muted-foreground))",
                  border: "0.5px solid hsl(var(--border))",
                }}
              >
                Neutral
              </span>
              <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>→</span>
              <span
                className="font-display"
                style={{
                  fontSize: "10px",
                  borderRadius: "4px",
                  padding: "2px 7px",
                  background: "hsl(var(--caution) / 0.15)",
                  color: "hsl(var(--caution))",
                }}
              >
                Caution
              </span>
            </div>

            {/* Body */}
            <div className="mt-3 relative">
              {briefingLoading ? (
                <div className="space-y-1.5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-3 rounded anim-shimmer" style={{ width: `${100 - i * 10}%` }} />
                  ))}
                </div>
              ) : (
                <p
                  style={{
                    fontSize: "12px",
                    color: "hsl(var(--muted-foreground))",
                    lineHeight: "1.6",
                    display: "-webkit-box",
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {briefing || topArticle?.summary || "No briefing available yet."}
                </p>
              )}
              <div
                className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none"
                style={{
                  background: "linear-gradient(transparent, hsl(var(--secondary)))",
                }}
              />
            </div>

            {/* Read more */}
            {topArticle?.url && (
              <a
                href={topArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 transition-opacity hover:opacity-80"
                style={{ fontSize: "11px", color: "hsl(var(--info))" }}
              >
                Read more <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {/* Sentiment */}
            {topArticle && (
              <div className="flex items-center gap-2 mt-3">
                <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
                  Sentiment:
                </span>
                <span
                  className="font-display capitalize"
                  style={{
                    fontSize: "10px",
                    borderRadius: "4px",
                    padding: "2px 7px",
                    background: sentimentBg(topArticle.sentiment),
                    color: sentimentColor(topArticle.sentiment),
                  }}
                >
                  {topArticle.sentiment || "neutral"}
                </span>
                <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground) / 0.5)" }}>
                  via {topArticle.source}
                </span>
              </div>
            )}
          </>
        ) : (
          /* Empty state — CTA */
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="w-8 h-8 mb-2" style={{ color: "hsl(var(--border))" }} />
            <p style={{ fontSize: "13px", color: "hsl(var(--foreground))" }}>
              Run your first scan to generate your market briefing
            </p>
            <p className="mt-1" style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
              AI insights will appear here after data is available
            </p>
          </div>
        )}
      </div>

      {/* News ticker strip */}
      {tickerItems.length > 0 && (
        <div
          className="mt-3 overflow-hidden rounded-md"
          style={{
            background: "hsl(var(--secondary))",
            border: "0.5px solid hsl(var(--border))",
            height: "32px",
          }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            className="flex items-center h-full whitespace-nowrap"
            style={{
              animation: `ticker-scroll ${animDuration}s linear infinite`,
              animationPlayState: paused ? "paused" : "running",
            }}
          >
            {tickerItems.map((article, i) => (
              <a
                key={`${article.id}-${i}`}
                href={article.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center shrink-0 px-4 transition-colors hover:text-foreground"
                style={{
                  fontSize: "11px",
                  fontFamily: "var(--font-display)",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                <span style={{ color: "hsl(var(--border))", marginRight: "6px" }}>•</span>
                <span className="font-semibold" style={{ marginRight: "4px" }}>
                  {article.source}
                </span>
                —{" "}
                {(article.headline ?? "").length > 60
                  ? article.headline?.slice(0, 60) + "…"
                  : article.headline}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

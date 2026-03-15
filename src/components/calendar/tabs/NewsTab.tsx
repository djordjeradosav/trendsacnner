import { useEffect, useState } from "react";
import type { EconomicEvent } from "@/hooks/useEconomicCalendar";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Search } from "lucide-react";

interface Article {
  id: string;
  headline: string;
  source: string | null;
  published_at: string | null;
  sentiment: string | null;
  url: string | null;
}

interface Props {
  event: EconomicEvent;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SENTIMENT_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  positive: { bg: "hsl(var(--bullish) / 0.12)", color: "hsl(var(--bullish))", label: "Positive" },
  negative: { bg: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))", label: "Negative" },
  neutral: { bg: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))", label: "Neutral" },
};

export function NewsTab({ event }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      // Try to find articles related to this event
      const { data } = await supabase
        .from("news_articles")
        .select("id, headline, source, published_at, sentiment, url")
        .or(`headline.ilike.%${event.event_name.split(" ").slice(0, 2).join(" ")}%,headline.ilike.%${event.currency}%`)
        .order("published_at", { ascending: false })
        .limit(10);
      setArticles((data as Article[]) || []);
      setLoading(false);
    };
    fetchNews();
  }, [event.event_name, event.currency]);

  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`${event.event_name} ${event.currency} ${new Date().getFullYear()} forex`)}`;

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {articles.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">
            No related news found. Check external sources for the latest coverage.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => {
            const sStyle = SENTIMENT_STYLES[a.sentiment || "neutral"] || SENTIMENT_STYLES.neutral;
            return (
              <div
                key={a.id}
                className="rounded-lg border border-border p-3 hover:bg-secondary/50 transition-colors"
                style={{ background: "hsl(var(--card))" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-muted-foreground">{a.source}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(a.published_at)}</span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full ml-auto"
                    style={{ background: sStyle.bg, color: sStyle.color }}
                  >
                    {sStyle.label}
                  </span>
                </div>
                <p className="text-[12px] text-foreground line-clamp-2 leading-relaxed">{a.headline}</p>
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] mt-1 inline-flex items-center gap-1 hover:underline"
                    style={{ color: "hsl(var(--info))" }}
                  >
                    Open article <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground"
        >
          <Search className="w-3 h-3" /> Search on Google
        </a>
        <a
          href="https://www.forexfactory.com/news"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground"
        >
          📰 ForexFactory News
        </a>
      </div>
    </div>
  );
}

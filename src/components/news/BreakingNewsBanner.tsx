import { useEffect, useState } from "react";
import { X, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { NewsArticle } from "@/services/newsService";

export function BreakingNewsBanner() {
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = async () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("news_articles")
        .select("*")
        .eq("sentiment", "negative")
        .gte("published_at", thirtyMinAgo)
        .order("published_at", { ascending: false })
        .limit(10);

      if (!data) return;

      // Find article mentioning 3+ pairs
      const breaking = (data as unknown as NewsArticle[]).find(
        (a) => (a.relevant_pairs ?? []).length >= 3
      );
      if (breaking) setArticle(breaking);
    };
    check();
  }, []);

  if (!article || dismissed) return null;

  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4"
      style={{
        background: "hsl(var(--caution) / 0.1)",
        border: "0.5px solid hsl(var(--caution) / 0.3)",
      }}
    >
      <Zap className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--caution))" }} />
      <span className="font-semibold" style={{ fontSize: "11px", color: "hsl(var(--caution))" }}>
        Market Alert
      </span>
      <span className="text-xs truncate flex-1" style={{ color: "hsl(var(--foreground))" }}>
        — {article.headline?.slice(0, 100)}{(article.headline?.length ?? 0) > 100 ? "…" : ""}
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded transition-colors hover:bg-white/5"
        style={{ color: "hsl(var(--muted-foreground))" }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

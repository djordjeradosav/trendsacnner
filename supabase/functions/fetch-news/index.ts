import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Pair symbols we track — used for keyword matching
const TRACKED_SYMBOLS = [
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD",
  "EURGBP", "EURJPY", "GBPJPY", "XAUUSD", "XAGUSD", "US30", "US100",
  "US500", "USOIL", "UKOIL", "NATGAS",
];

// Keyword map for matching articles to pairs
const KEYWORD_MAP: Record<string, string[]> = {
  EURUSD: ["eur/usd", "eurusd", "euro dollar", "euro", "ecb"],
  GBPUSD: ["gbp/usd", "gbpusd", "cable", "pound", "sterling", "boe", "bank of england"],
  USDJPY: ["usd/jpy", "usdjpy", "yen", "boj", "bank of japan"],
  AUDUSD: ["aud/usd", "audusd", "aussie", "rba"],
  USDCAD: ["usd/cad", "usdcad", "loonie", "canadian dollar"],
  USDCHF: ["usd/chf", "usdchf", "swiss franc", "snb"],
  NZDUSD: ["nzd/usd", "nzdusd", "kiwi"],
  EURGBP: ["eur/gbp", "eurgbp"],
  EURJPY: ["eur/jpy", "eurjpy"],
  GBPJPY: ["gbp/jpy", "gbpjpy"],
  XAUUSD: ["xau/usd", "xauusd", "gold", "precious metal"],
  XAGUSD: ["xag/usd", "xagusd", "silver"],
  US30: ["us30", "dow jones", "dow", "djia"],
  US100: ["us100", "nasdaq", "tech stocks"],
  US500: ["us500", "s&p 500", "s&p500", "spx"],
  USOIL: ["usoil", "wti", "crude oil", "oil price", "brent"],
  UKOIL: ["ukoil", "brent"],
  NATGAS: ["natgas", "natural gas"],
};

function matchPairs(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const [sym, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(sym);
    }
  }
  return matched;
}

interface UnifiedArticle {
  headline: string;
  summary: string;
  source: string;
  url: string;
  published_at: string;
  sentiment: string;
  relevant_pairs: string[];
  image_url: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY");
    const ALPHA_VANTAGE_KEY = Deno.env.get("ALPHA_VANTAGE_KEY");

    const articles: UnifiedArticle[] = [];

    // 1. NewsAPI
    if (NEWS_API_KEY) {
      try {
        const url = `https://newsapi.org/v2/everything?q=forex+gold+oil+futures+markets&language=en&sortBy=publishedAt&pageSize=30&apiKey=${NEWS_API_KEY}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          for (const a of data.articles ?? []) {
            const text = `${a.title ?? ""} ${a.description ?? ""}`;
            const pairs = matchPairs(text);
            articles.push({
              headline: a.title ?? "Untitled",
              summary: a.description ?? "",
              source: a.source?.name ?? "NewsAPI",
              url: a.url ?? "",
              published_at: a.publishedAt ?? new Date().toISOString(),
              sentiment: "neutral", // NewsAPI doesn't provide sentiment
              relevant_pairs: pairs,
              image_url: a.urlToImage ?? null,
            });
          }
        } else {
          console.error("NewsAPI error:", resp.status, await resp.text());
        }
      } catch (e) {
        console.error("NewsAPI fetch failed:", e);
      }
    }

    // 2. Alpha Vantage News Sentiment
    if (ALPHA_VANTAGE_KEY) {
      try {
        const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=forex,commodities,financial_markets&limit=20&apikey=${ALPHA_VANTAGE_KEY}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          for (const item of data.feed ?? []) {
            const text = `${item.title ?? ""} ${item.summary ?? ""}`;
            const pairs = matchPairs(text);

            // Map Alpha Vantage sentiment score
            const score = parseFloat(item.overall_sentiment_score ?? "0");
            let sentiment = "neutral";
            if (score >= 0.15) sentiment = "positive";
            else if (score <= -0.15) sentiment = "negative";

            // Enrich NewsAPI articles with AV sentiment if they match
            const existingIdx = articles.findIndex(
              (a) => a.headline.toLowerCase() === (item.title ?? "").toLowerCase()
            );
            if (existingIdx >= 0) {
              articles[existingIdx].sentiment = sentiment;
              // Merge pairs
              const merged = new Set([
                ...articles[existingIdx].relevant_pairs,
                ...pairs,
              ]);
              articles[existingIdx].relevant_pairs = [...merged];
            } else {
              articles.push({
                headline: item.title ?? "Untitled",
                summary: item.summary ?? "",
                source: item.source ?? "Alpha Vantage",
                url: item.url ?? "",
                published_at: item.time_published
                  ? parseAVDate(item.time_published)
                  : new Date().toISOString(),
                sentiment,
                relevant_pairs: pairs,
                image_url: item.banner_image ?? null,
              });
            }
          }
        } else {
          console.error("Alpha Vantage error:", resp.status, await resp.text());
        }
      } catch (e) {
        console.error("Alpha Vantage fetch failed:", e);
      }
    }

    if (articles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, count: 0, message: "No articles fetched. Check API keys." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Upsert into news_articles (deduplicate by url)
    // First delete old articles (> 48h) to keep table lean
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await supabase.from("news_articles").delete().lt("published_at", cutoff);

    // Insert new articles, skip duplicates by checking URL
    let inserted = 0;
    for (const article of articles) {
      const { data: existing } = await supabase
        .from("news_articles")
        .select("id")
        .eq("url", article.url)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const { error } = await supabase.from("news_articles").insert({
        headline: article.headline,
        summary: article.summary,
        source: article.source,
        url: article.url,
        published_at: article.published_at,
        sentiment: article.sentiment,
        relevant_pairs: article.relevant_pairs,
        image_url: article.image_url,
        fetched_at: new Date().toISOString(),
      });

      if (!error) inserted++;
    }

    return new Response(
      JSON.stringify({ success: true, total: articles.length, inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-news error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Parse Alpha Vantage date format: 20240115T120000 -> ISO string */
function parseAVDate(dateStr: string): string {
  try {
    const y = dateStr.slice(0, 4);
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    const h = dateStr.slice(9, 11);
    const min = dateStr.slice(11, 13);
    const s = dateStr.slice(13, 15);
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

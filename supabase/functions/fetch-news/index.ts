import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function simpleSentiment(text: string): string {
  const lower = text.toLowerCase();
  const pos = ["rally", "surge", "gain", "bullish", "rise", "soar", "jump", "climb", "strong", "beat", "upbeat", "optimis"];
  const neg = ["drop", "fall", "crash", "bearish", "decline", "plunge", "slump", "weak", "miss", "pessimis", "fear", "sell-off", "selloff"];
  let score = 0;
  for (const w of pos) if (lower.includes(w)) score++;
  for (const w of neg) if (lower.includes(w)) score--;
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
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

// ──────────────────────────────────────────────
// SOURCE 1: NewsAPI
// ──────────────────────────────────────────────
async function fetchNewsAPI(apiKey: string): Promise<UnifiedArticle[]> {
  const articles: UnifiedArticle[] = [];
  try {
    const url = `https://newsapi.org/v2/everything?q=forex+gold+oil+futures+markets&language=en&sortBy=publishedAt&pageSize=30&apiKey=${apiKey}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      for (const a of data.articles ?? []) {
        const text = `${a.title ?? ""} ${a.description ?? ""}`;
        articles.push({
          headline: a.title ?? "Untitled",
          summary: a.description ?? "",
          source: a.source?.name ?? "NewsAPI",
          url: a.url ?? "",
          published_at: a.publishedAt ?? new Date().toISOString(),
          sentiment: simpleSentiment(text),
          relevant_pairs: matchPairs(text),
          image_url: a.urlToImage ?? null,
        });
      }
    } else {
      console.error("NewsAPI error:", resp.status);
    }
  } catch (e) {
    console.error("NewsAPI fetch failed:", e);
  }
  return articles;
}

// ──────────────────────────────────────────────
// SOURCE 2: Alpha Vantage News Sentiment
// ──────────────────────────────────────────────
async function fetchAlphaVantage(apiKey: string): Promise<UnifiedArticle[]> {
  const articles: UnifiedArticle[] = [];
  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=forex,commodities,financial_markets&limit=20&apikey=${apiKey}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      for (const item of data.feed ?? []) {
        const text = `${item.title ?? ""} ${item.summary ?? ""}`;
        const score = parseFloat(item.overall_sentiment_score ?? "0");
        let sentiment = "neutral";
        if (score >= 0.15) sentiment = "positive";
        else if (score <= -0.15) sentiment = "negative";

        articles.push({
          headline: item.title ?? "Untitled",
          summary: item.summary ?? "",
          source: item.source ?? "Alpha Vantage",
          url: item.url ?? "",
          published_at: item.time_published
            ? parseAVDate(item.time_published)
            : new Date().toISOString(),
          sentiment,
          relevant_pairs: matchPairs(text),
          image_url: item.banner_image ?? null,
        });
      }
    }
  } catch (e) {
    console.error("Alpha Vantage fetch failed:", e);
  }
  return articles;
}

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

// ──────────────────────────────────────────────
// SOURCE 3: ForexFactory News (scrape HTML)
// ──────────────────────────────────────────────
async function fetchForexFactoryNews(): Promise<UnifiedArticle[]> {
  const articles: UnifiedArticle[] = [];
  try {
    const resp = await fetch("https://www.forexfactory.com/news", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!resp.ok) {
      console.error("ForexFactory news status:", resp.status);
      return articles;
    }
    const html = await resp.text();

    // Try multiple patterns for FF news headlines
    const patterns = [
      /<a[^>]*class="[^"]*flexposts__title[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      /<a[^>]*href="(\/news\/[^"]+)"[^>]*title="([^"]+)"/gi,
      /<a[^>]*href="(https:\/\/www\.forexfactory\.com\/news\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    ];

    const seen = new Set<string>();
    for (const regex of patterns) {
      let match;
      while ((match = regex.exec(html)) !== null) {
        const rawUrl = match[1];
        const url = rawUrl.startsWith("http") ? rawUrl : `https://www.forexfactory.com${rawUrl}`;
        const headline = match[2].replace(/<[^>]+>/g, "").trim();
        if (!headline || headline.length < 15 || seen.has(headline)) continue;
        seen.add(headline);
        articles.push({
          headline,
          summary: "",
          source: "ForexFactory",
          url,
          published_at: new Date().toISOString(),
          sentiment: simpleSentiment(headline),
          relevant_pairs: matchPairs(headline),
          image_url: null,
        });
      }
    }

    console.log(`ForexFactory: scraped ${articles.length} articles`);
  } catch (e) {
    console.error("ForexFactory scrape failed:", e);
  }
  return articles;
}
    const html = await resp.text();

    // Extract news items from FF HTML structure
    // FF uses <a class="flexposts__title"> or similar patterns
    const titleRegex = /<a[^>]*class="[^"]*flexposts__title[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = titleRegex.exec(html)) !== null) {
      const url = match[1].startsWith("http") ? match[1] : `https://www.forexfactory.com${match[1]}`;
      const headline = match[2].replace(/<[^>]+>/g, "").trim();
      if (!headline) continue;
      const text = headline;
      articles.push({
        headline,
        summary: "",
        source: "ForexFactory",
        url,
        published_at: new Date().toISOString(),
        sentiment: simpleSentiment(text),
        relevant_pairs: matchPairs(text),
        image_url: null,
      });
    }

    // Fallback: try generic anchor patterns with news-like URLs
    if (articles.length === 0) {
      const fallbackRegex = /<a[^>]*href="(\/news\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = fallbackRegex.exec(html)) !== null) {
        const headline = match[2].replace(/<[^>]+>/g, "").trim();
        if (!headline || headline.length < 15) continue;
        articles.push({
          headline,
          summary: "",
          source: "ForexFactory",
          url: `https://www.forexfactory.com${match[1]}`,
          published_at: new Date().toISOString(),
          sentiment: simpleSentiment(headline),
          relevant_pairs: matchPairs(headline),
          image_url: null,
        });
      }
    }

    console.log(`ForexFactory: scraped ${articles.length} articles`);
  } catch (e) {
    console.error("ForexFactory scrape failed:", e);
  }
  return articles;
}

// ──────────────────────────────────────────────
// SOURCE 4: MyFXBook News (scrape HTML)
// ──────────────────────────────────────────────
async function fetchMyFXBookNews(): Promise<UnifiedArticle[]> {
  const articles: UnifiedArticle[] = [];
  try {
    const resp = await fetch("https://www.myfxbook.com/news", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!resp.ok) {
      console.error("MyFXBook news status:", resp.status);
      return articles;
    }
    const html = await resp.text();

    // MyFXBook uses news article links with headlines
    const titleRegex = /<a[^>]*href="(\/news\/\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const seen = new Set<string>();
    while ((match = titleRegex.exec(html)) !== null) {
      const headline = match[2].replace(/<[^>]+>/g, "").trim();
      if (!headline || headline.length < 15 || seen.has(headline)) continue;
      seen.add(headline);
      articles.push({
        headline,
        summary: "",
        source: "MyFXBook",
        url: `https://www.myfxbook.com${match[1]}`,
        published_at: new Date().toISOString(),
        sentiment: simpleSentiment(headline),
        relevant_pairs: matchPairs(headline),
        image_url: null,
      });
    }

    console.log(`MyFXBook: scraped ${articles.length} articles`);
  } catch (e) {
    console.error("MyFXBook scrape failed:", e);
  }
  return articles;
}

// ──────────────────────────────────────────────
// SOURCE 5: Investopedia Markets News (RSS)
// ──────────────────────────────────────────────
async function fetchInvestopediaNews(): Promise<UnifiedArticle[]> {
  const articles: UnifiedArticle[] = [];
  try {
    // Try RSS feed first
    const rssUrl = "https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_headline";
    const resp = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (resp.ok) {
      const xml = await resp.text();
      // Parse RSS items
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        const itemContent = match[1];
        const title = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
          || itemContent.match(/<title>(.*?)<\/title>/)?.[1]
          || "";
        const link = itemContent.match(/<link>(.*?)<\/link>/)?.[1] || "";
        const desc = itemContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]
          || itemContent.match(/<description>(.*?)<\/description>/)?.[1]
          || "";
        const pubDate = itemContent.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
        const imgMatch = itemContent.match(/<media:content[^>]*url="([^"]+)"/);

        if (!title || title.length < 10) continue;

        const cleanDesc = desc.replace(/<[^>]+>/g, "").trim();
        const text = `${title} ${cleanDesc}`;

        articles.push({
          headline: title.trim(),
          summary: cleanDesc.slice(0, 300),
          source: "Investopedia",
          url: link.trim(),
          published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          sentiment: simpleSentiment(text),
          relevant_pairs: matchPairs(text),
          image_url: imgMatch?.[1] || null,
        });
      }
    }

    // Fallback: scrape the page directly
    if (articles.length === 0) {
      const pageResp = await fetch("https://www.investopedia.com/markets-news-4427704", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html",
        },
      });
      if (pageResp.ok) {
        const html = await pageResp.text();
        // Investopedia uses card-based layout with headlines in anchors
        const headlineRegex = /<a[^>]*class="[^"]*mntl-card-list-items[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*card__title-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
        let m;
        while ((m = headlineRegex.exec(html)) !== null) {
          const headline = m[2].replace(/<[^>]+>/g, "").trim();
          if (!headline || headline.length < 10) continue;
          articles.push({
            headline,
            summary: "",
            source: "Investopedia",
            url: m[1],
            published_at: new Date().toISOString(),
            sentiment: simpleSentiment(headline),
            relevant_pairs: matchPairs(headline),
            image_url: null,
          });
        }
      }
    }

    console.log(`Investopedia: scraped ${articles.length} articles`);
  } catch (e) {
    console.error("Investopedia fetch failed:", e);
  }
  return articles;
}

// ──────────────────────────────────────────────
// MAIN HANDLER
// ──────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY");
    const ALPHA_VANTAGE_KEY = Deno.env.get("ALPHA_VANTAGE_KEY");

    // Fetch all sources in parallel
    const results = await Promise.allSettled([
      NEWS_API_KEY ? fetchNewsAPI(NEWS_API_KEY) : Promise.resolve([]),
      ALPHA_VANTAGE_KEY ? fetchAlphaVantage(ALPHA_VANTAGE_KEY) : Promise.resolve([]),
      fetchForexFactoryNews(),
      fetchMyFXBookNews(),
      fetchInvestopediaNews(),
    ]);

    const allArticles: UnifiedArticle[] = [];
    const sourceCounts: Record<string, number> = {};

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const a of result.value) {
          allArticles.push(a);
          sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1;
        }
      }
    }

    console.log("Source counts:", JSON.stringify(sourceCounts));

    if (allArticles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, count: 0, sources: sourceCounts, message: "No articles fetched." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate by headline similarity
    const seen = new Set<string>();
    const unique: UnifiedArticle[] = [];
    for (const a of allArticles) {
      const key = a.headline.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(a);
    }

    // Delete old articles (> 48h)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await supabase.from("news_articles").delete().lt("published_at", cutoff);

    // Insert new articles, skip duplicates by URL
    let inserted = 0;
    for (const article of unique) {
      if (!article.url) continue;

      const { data: existing } = await supabase
        .from("news_articles")
        .select("id")
        .eq("url", article.url)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const { error } = await supabase.from("news_articles").insert({
        headline: article.headline,
        summary: article.summary || null,
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
      JSON.stringify({ success: true, total: unique.length, inserted, sources: sourceCounts }),
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

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
    if (keywords.some((kw) => lower.includes(kw))) matched.push(sym);
  }
  return matched;
}

function simpleSentiment(text: string): string {
  const lower = text.toLowerCase();
  const pos = ["rally", "surge", "gain", "bullish", "rise", "soar", "jump", "climb", "strong", "beat", "upbeat", "optimis", "higher", "record high"];
  const neg = ["drop", "fall", "crash", "bearish", "decline", "plunge", "slump", "weak", "miss", "pessimis", "fear", "sell-off", "selloff", "lower", "slide", "tumble"];
  let score = 0;
  for (const w of pos) if (lower.includes(w)) score++;
  for (const w of neg) if (lower.includes(w)) score--;
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}


  headline: string;
  summary: string;
  source: string;
  url: string;
  published_at: string;
  sentiment: string;
  relevant_pairs: string[];
  image_url: string | null;
}

// ── SOURCE 1: NewsAPI ──
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
    }
  } catch (e) {
    console.error("NewsAPI failed:", e);
  }
  return articles;
}

// ── SOURCE 2: Alpha Vantage ──
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
          published_at: item.time_published ? parseAVDate(item.time_published) : new Date().toISOString(),
          sentiment,
          relevant_pairs: matchPairs(text),
          image_url: item.banner_image ?? null,
        });
      }
    }
  } catch (e) {
    console.error("Alpha Vantage failed:", e);
  }
  return articles;
}

function parseAVDate(dateStr: string): string {
  try {
    return new Date(`${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}T${dateStr.slice(9,11)}:${dateStr.slice(11,13)}:${dateStr.slice(13,15)}Z`).toISOString();
  } catch { return new Date().toISOString(); }
}

// ── SOURCE 3: ForexFactory News ──
async function fetchForexFactoryNews(): Promise<UnifiedArticle[]> {
  const articles: UnifiedArticle[] = [];
  try {
    const resp = await fetch("https://www.forexfactory.com/news", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
      },
    });
    if (!resp.ok) { console.error("FF news:", resp.status); return articles; }
    const html = await resp.text();

    const patterns = [
      /<a[^>]*class="[^"]*flexposts__title[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      /<a[^>]*href="(\/news\/[^"]+)"[^>]*title="([^"]+)"/gi,
      /<a[^>]*href="(\/news\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    ];
    const seen = new Set<string>();
    for (const re of patterns) {
      let m;
      while ((m = re.exec(html)) !== null) {
        const url = m[1].startsWith("http") ? m[1] : `https://www.forexfactory.com${m[1]}`;
        const headline = m[2].replace(/<[^>]+>/g, "").trim();
        if (!headline || headline.length < 15 || seen.has(headline)) continue;
        seen.add(headline);
        articles.push({ headline, summary: "", source: "ForexFactory", url, published_at: new Date().toISOString(), sentiment: simpleSentiment(headline), relevant_pairs: matchPairs(headline), image_url: null });
      }
    }
    console.log(`ForexFactory: ${articles.length} articles`);
  } catch (e) { console.error("FF scrape failed:", e); }
  return articles;
}

// ── SOURCE 4: MyFXBook News ──
async function fetchMyFXBookNews(): Promise<UnifiedArticle[]> {
  const articles: UnifiedArticle[] = [];
  try {
    const resp = await fetch("https://www.myfxbook.com/news", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
      },
    });
    if (!resp.ok) { console.error("MyFXBook:", resp.status); return articles; }
    const html = await resp.text();

    // Match links like /news/us-dollar-climbs-against-majors/47019
    const re = /<a[^>]*href="(\/news\/[a-z0-9-]+\/\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const seen = new Set<string>();
    let m;
    while ((m = re.exec(html)) !== null) {
      const url = `https://www.myfxbook.com${m[1]}`;
      const headline = m[2].replace(/<[^>]+>/g, "").trim();
      if (!headline || headline.length < 15 || seen.has(url)) continue;
      seen.add(url);

      // Extract summary from nearby paragraph
      const after = html.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 600);
      const pMatch = after.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const summary = pMatch ? pMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 300) : "";

      // Extract image
      const before = html.slice(Math.max(0, (m.index || 0) - 400), m.index || 0);
      const imgMatch = before.match(/src="(https:\/\/static\.mfbcdn\.net\/images\/news\/[^"]+)"/);

      articles.push({
        headline, summary, source: "MyFXBook", url,
        published_at: new Date().toISOString(),
        sentiment: simpleSentiment(headline + " " + summary),
        relevant_pairs: matchPairs(headline + " " + summary),
        image_url: imgMatch?.[1] || null,
      });
    }
    console.log(`MyFXBook: ${articles.length} articles`);
  } catch (e) { console.error("MyFXBook scrape failed:", e); }
  return articles;
}

// ── SOURCE 5: Investopedia Markets News ──
async function fetchInvestopediaNews(): Promise<UnifiedArticle[]> {
  const articles: UnifiedArticle[] = [];
  try {
    const resp = await fetch("https://www.investopedia.com/markets-news-4427704", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
      },
    });
    if (!resp.ok) { console.error("Investopedia:", resp.status); return articles; }
    const html = await resp.text();

    // Match Investopedia article links: https://www.investopedia.com/slug-NNNNN
    const re = /href="(https:\/\/www\.investopedia\.com\/[a-z0-9-]+-\d{5,})"[^>]*>([\s\S]*?)<\/a>/gi;
    const seen = new Set<string>();
    let m;
    while ((m = re.exec(html)) !== null) {
      const url = m[1];
      if (url.includes("/markets-news-") || url.includes("/news-")) continue;
      let headline = m[2].replace(/<[^>]+>/g, "").replace(/\\\s*/g, " ").replace(/\s+/g, " ").trim();
      if (!headline || headline.length < 15 || seen.has(url)) continue;
      seen.add(url);

      const before = html.slice(Math.max(0, (m.index || 0) - 500), m.index || 0);
      const imgMatch = before.match(/src="(https:\/\/www\.investopedia\.com\/thmb\/[^"]+)"/);

      articles.push({
        headline, summary: "", source: "Investopedia", url,
        published_at: new Date().toISOString(),
        sentiment: simpleSentiment(headline),
        relevant_pairs: matchPairs(headline),
        image_url: imgMatch?.[1] || null,
      });
    }
    console.log(`Investopedia: ${articles.length} articles`);
  } catch (e) { console.error("Investopedia failed:", e); }
  return articles;
}

// ── MAIN HANDLER ──
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

    // Deduplicate by headline
    const seen = new Set<string>();
    const unique: UnifiedArticle[] = [];
    for (const a of allArticles) {
      const key = a.headline.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(a);
    }

    // Delete old articles (> 72h)
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    await supabase.from("news_articles").delete().lt("published_at", cutoff);

    // Insert new, skip URL duplicates
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

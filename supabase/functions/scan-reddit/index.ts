import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBREDDITS = [
  "Forex", "wallstreetbets", "investing", "stocks", "Economics"
];

const KEYWORDS = [
  'eurusd','gbpusd','usdjpy','gold','xauusd','oil','crude',
  'eur','gbp','jpy','aud','usd','dollar','euro','pound','yen','forex',
  'nfp','cpi','fed','ecb','boe','rba','inflation','rate hike','rate cut',
  'usdcad','audusd','nzdusd','usdchf','gbpjpy','eurjpy','cadjpy',
  'sp500','nasdaq','dow','treasury','bond','yield'
];

const SYMBOL_MAP: Record<string, string[]> = {
  'eurusd': ['EURUSD'], 'gbpusd': ['GBPUSD'], 'usdjpy': ['USDJPY'],
  'gold': ['XAUUSD'], 'xauusd': ['XAUUSD'], 'oil': ['USOIL'], 'crude': ['USOIL'],
  'eur': ['EURUSD'], 'gbp': ['GBPUSD'], 'jpy': ['USDJPY'],
  'aud': ['AUDUSD'], 'usd': ['EURUSD','GBPUSD','USDJPY','XAUUSD'],
  'dollar': ['EURUSD','USDJPY'], 'euro': ['EURUSD'], 'pound': ['GBPUSD'], 'yen': ['USDJPY'],
  'usdcad': ['USDCAD'], 'audusd': ['AUDUSD'], 'nzdusd': ['NZDUSD'],
  'usdchf': ['USDCHF'], 'gbpjpy': ['GBPJPY'], 'eurjpy': ['EURJPY'],
};

const STOCKTWITS_SYMBOLS = ['EURUSD','XAUUSD','GBPUSD','USDJPY','USDCAD','AUDUSD'];

function matchPairs(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const [kw, symbols] of Object.entries(SYMBOL_MAP)) {
    if (lower.includes(kw)) symbols.forEach(s => found.add(s));
  }
  return [...found];
}

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return KEYWORDS.some(k => lower.includes(k));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: any[] = [];

    // ─── Reddit ─────────────────────────────────────────────
    const redditPromises = SUBREDDITS.map(async (sub) => {
      try {
        const res = await fetch(`https://www.reddit.com/r/${sub}/new.json?limit=25`, {
          headers: { "User-Agent": "TrendScanBot/1.0" },
        });
        if (!res.ok) { console.error(`Reddit ${sub} ${res.status}`); return []; }
        const json = await res.json();
        const posts = json?.data?.children || [];
        return posts
          .map((p: any) => p.data)
          .filter((d: any) => isRelevant(`${d.title} ${d.selftext || ""}`))
          .map((d: any) => ({
            source: "reddit" as const,
            content: d.title.slice(0, 500),
            upvotes: d.ups || 0,
            published_at: new Date(d.created_utc * 1000).toISOString(),
            original_url: `https://reddit.com${d.permalink}`,
            pairs: matchPairs(`${d.title} ${d.selftext || ""}`),
            subreddit: sub,
          }));
      } catch (e) { console.error(`Reddit ${sub} error:`, e); return []; }
    });

    const redditResults = (await Promise.all(redditPromises)).flat();
    results.push(...redditResults);

    // ─── StockTwits ─────────────────────────────────────────
    const stwPromises = STOCKTWITS_SYMBOLS.map(async (sym) => {
      try {
        const res = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${sym}.json`);
        if (!res.ok) return [];
        const json = await res.json();
        const msgs = json?.messages || [];
        return msgs.slice(0, 10).map((m: any) => ({
          source: "stocktwits" as const,
          content: (m.body || "").slice(0, 500),
          upvotes: m.likes?.total || 0,
          published_at: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
          original_url: `https://stocktwits.com/message/${m.id}`,
          pairs: [sym],
          sentiment: m.entities?.sentiment?.basic === "Bullish" ? "bullish"
            : m.entities?.sentiment?.basic === "Bearish" ? "bearish" : "neutral",
          confidence: m.entities?.sentiment?.basic ? 0.8 : 0.3,
        }));
      } catch (e) { console.error(`StockTwits ${sym} error:`, e); return []; }
    });

    const stwResults = (await Promise.all(stwPromises)).flat();
    results.push(...stwResults);

    // ─── Twitter/X via RapidAPI (optional) ──────────────────
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");
    if (rapidApiKey) {
      try {
        const res = await fetch(
          `https://twitter-api45.p.rapidapi.com/search.php?query=forex+trading&count=20`,
          { headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": "twitter-api45.p.rapidapi.com" } }
        );
        if (res.ok) {
          const json = await res.json();
          const tweets = json?.timeline || [];
          for (const t of tweets.slice(0, 20)) {
            const text = t.text || "";
            if (isRelevant(text)) {
              results.push({
                source: "twitter" as const,
                content: text.slice(0, 500),
                upvotes: (t.favorite_count || 0) + (t.retweet_count || 0),
                published_at: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
                original_url: `https://x.com/i/status/${t.tweet_id}`,
                pairs: matchPairs(text),
              });
            }
          }
        }
      } catch (e) { console.error("Twitter error:", e); }
    }

    // ─── Classify Reddit posts via AI ───────────────────────
    const needsClassification = results.filter(r => r.source === "reddit" || (r.source === "twitter" && !r.sentiment));
    if (needsClassification.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const batch = needsClassification.slice(0, 30);
        const postList = batch.map((p, i) => `${i}: "${p.content}"`).join("\n");
        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "You are a financial sentiment classifier. Return ONLY a JSON array." },
                { role: "user", content: `Classify each post as bullish, bearish, or neutral for forex/commodities trading.\n\n${postList}\n\nReturn JSON array: [{"index":0,"sentiment":"bullish","confidence":0.8,"asset":"EURUSD"},...]` },
              ],
            }),
          });
          if (aiRes.ok) {
            const aiJson = await aiRes.json();
            const content = aiJson.choices?.[0]?.message?.content || "";
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const classifications = JSON.parse(jsonMatch[0]);
              for (const c of classifications) {
                if (c.index >= 0 && c.index < batch.length) {
                  batch[c.index].sentiment = c.sentiment;
                  batch[c.index].confidence = c.confidence || 0.5;
                  if (c.asset && !batch[c.index].pairs.includes(c.asset)) {
                    batch[c.index].pairs.push(c.asset);
                  }
                }
              }
            }
          }
        } catch (e) { console.error("AI classification error:", e); }
      }

      // Default unclassified to neutral
      for (const r of needsClassification) {
        if (!r.sentiment) { r.sentiment = "neutral"; r.confidence = 0.3; }
      }
    }

    // ─── Upsert to DB ──────────────────────────────────────
    const rows = results.flatMap(r => {
      const pairs = r.pairs?.length > 0 ? r.pairs : ["GENERAL"];
      return pairs.map((sym: string) => ({
        source: r.source,
        pair_symbol: sym,
        content: r.content,
        sentiment: r.sentiment || "neutral",
        confidence: r.confidence || 0.5,
        upvotes: r.upvotes || 0,
        original_url: r.original_url,
        published_at: r.published_at,
      }));
    });

    if (rows.length > 0) {
      const { error } = await supabase.from("social_sentiment").insert(rows);
      if (error) console.error("Insert error:", error);
    }

    return new Response(JSON.stringify({
      status: "ok",
      reddit: redditResults.length,
      stocktwits: stwResults.length,
      twitter: results.filter(r => r.source === "twitter").length,
      total_inserted: rows.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("scan-reddit error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

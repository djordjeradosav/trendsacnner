import { supabase } from "@/integrations/supabase/client";

export interface NewsSentimentResult {
  score: number;          // 0-11
  articleCount: number;
  posCount: number;
  negCount: number;
  netSentiment: number;   // -1.0 to +1.0
  recentHeadlines: string[];
  paused: boolean;
  pauseReason?: string;
}

function getTimeDecayWeight(publishedAt: string): number {
  const hoursAgo = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 2) return 1.0;
  if (hoursAgo < 6) return 0.7;
  if (hoursAgo < 12) return 0.4;
  return 0.2;
}

export async function calcNewsSentimentScore(
  pairSymbol: string,
  currency: string
): Promise<NewsSentimentResult> {
  const nullResult: NewsSentimentResult = {
    score: 6, articleCount: 0, posCount: 0, negCount: 0,
    netSentiment: 0, recentHeadlines: [], paused: false,
  };

  // Check if a central bank rate decision is today for this currency
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: rateEvents } = await supabase
    .from("economic_events")
    .select("id")
    .eq("currency", currency)
    .gte("scheduled_at", todayStart.toISOString())
    .lte("scheduled_at", todayEnd.toISOString())
    .eq("impact", "high")
    .or("event_name.ilike.%rate decision%,event_name.ilike.%cash rate%,event_name.ilike.%interest rate%,event_name.ilike.%funds rate%")
    .limit(1);

  if (rateEvents && rateEvents.length > 0) {
    return {
      ...nullResult,
      paused: true,
      pauseReason: "⚡ High impact event — news score paused",
    };
  }

  // Fetch recent news mentioning this pair or currency
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: articles } = await supabase
    .from("news_articles")
    .select("headline, sentiment, published_at")
    .gte("published_at", cutoff)
    .or(`relevant_pairs.cs.{${pairSymbol}},headline.ilike.%${currency}%`)
    .order("published_at", { ascending: false })
    .limit(20);

  if (!articles || articles.length === 0) return nullResult;

  let posCount = 0, negCount = 0;
  let weightedSum = 0, weightSum = 0;
  const recentHeadlines: string[] = [];
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

  for (const art of articles) {
    const sentVal = art.sentiment === "positive" ? 1 : art.sentiment === "negative" ? -1 : 0;
    if (sentVal > 0) posCount++;
    if (sentVal < 0) negCount++;

    let weight = getTimeDecayWeight(art.published_at || new Date().toISOString());

    // Breaking news multiplier: negative articles < 2h old get 1.5x weight
    const pubTime = new Date(art.published_at || 0).getTime();
    if (sentVal < 0 && pubTime > twoHoursAgo) {
      weight *= 1.5;
    }

    weightedSum += sentVal * weight;
    weightSum += weight;

    if (recentHeadlines.length < 5) recentHeadlines.push(art.headline);
  }

  const netSentiment = weightSum > 0 ? Math.max(-1, Math.min(1, weightedSum / weightSum)) : 0;
  const score = Math.round(((netSentiment + 1) / 2) * 11);

  return {
    score: Math.max(0, Math.min(11, score)),
    articleCount: articles.length,
    posCount,
    negCount,
    netSentiment,
    recentHeadlines,
    paused: false,
  };
}

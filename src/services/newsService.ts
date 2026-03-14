import { supabase } from "@/integrations/supabase/client";

export interface NewsArticle {
  id: string;
  headline: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  published_at: string | null;
  sentiment: string | null;
  relevant_pairs: string[] | null;
  image_url: string | null;
  fetched_at: string;
}

export async function getLatestNews(limit = 20): Promise<NewsArticle[]> {
  const { data, error } = await supabase
    .from("news_articles")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as NewsArticle[];
}

export async function getNewsForPair(symbol: string, limit = 5): Promise<NewsArticle[]> {
  const { data, error } = await supabase
    .from("news_articles")
    .select("*")
    .contains("relevant_pairs", [symbol])
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as NewsArticle[];
}

export async function getNewsBySentiment(sentiment: string): Promise<NewsArticle[]> {
  const { data, error } = await supabase
    .from("news_articles")
    .select("*")
    .eq("sentiment", sentiment)
    .order("published_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as unknown as NewsArticle[];
}

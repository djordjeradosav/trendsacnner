import { useEffect, useState, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { InstrumentCard } from "./InstrumentCard";
import { useAllScores, ScoreRow } from "@/hooks/useScores";
import { supabase } from "@/integrations/supabase/client";

const DESK_SYMBOLS = ["US30", "US100", "XAUUSD", "GBPUSD"];

interface PairInfo {
  id: string;
  symbol: string;
}

interface AnalysisCache {
  summary: string;
  cached: boolean;
}

export function AIMacroDesk({ timeframe }: { timeframe: string }) {
  const navigate = useNavigate();
  const { data: allScores } = useAllScores(timeframe);
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, AnalysisCache>>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchPairs = async () => {
      const { data } = await supabase
        .from("pairs")
        .select("id, symbol")
        .in("symbol", DESK_SYMBOLS);
      if (data) setPairs(data);
    };
    fetchPairs();
  }, []);

  const scoreMap = useMemo(() => {
    const m = new Map<string, ScoreRow>();
    allScores?.forEach((s) => m.set(s.pair_id, s));
    return m;
  }, [allScores]);

  useEffect(() => {
    if (pairs.length === 0) return;

    pairs.forEach(async (pair) => {
      if (analyses[pair.id] || loadingAnalysis[pair.id]) return;

      setLoadingAnalysis((p) => ({ ...p, [pair.id]: true }));
      try {
        const { data, error } = await supabase.functions.invoke("analyze-pair", {
          body: { pairId: pair.id, timeframe },
        });

        if (!error && data?.analysis) {
          const summary =
            typeof data.analysis === "string"
              ? data.analysis
              : data.analysis.summary || JSON.stringify(data.analysis);
          setAnalyses((prev) => ({
            ...prev,
            [pair.id]: { summary, cached: data.cached },
          }));
        }
      } catch {
        // silently skip
      } finally {
        setLoadingAnalysis((p) => ({ ...p, [pair.id]: false }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, timeframe]);

  const hasScores = allScores && allScores.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles
              className="w-4 h-4"
              style={{ color: "hsl(var(--bullish))" }}
            />
            <span
              className="font-semibold"
              style={{ fontSize: "14px", color: "hsl(var(--foreground))" }}
            >
              AI Macro Desk
            </span>
          </div>
          <p
            style={{
              fontSize: "11px",
              color: "hsl(var(--muted-foreground))",
              marginTop: "2px",
            }}
          >
            Market bias analysis
          </p>
        </div>
        <button
          onClick={() => navigate("/scanner")}
          className="font-display transition-opacity hover:opacity-80"
          style={{ fontSize: "12px", color: "hsl(var(--bullish))" }}
        >
          View All →
        </button>
      </div>

      {/* Grid — staggered card entrance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DESK_SYMBOLS.map((sym, idx) => {
          const pair = pairs.find((p) => p.symbol === sym);
          const score = pair ? scoreMap.get(pair.id) : undefined;
          const analysis = pair ? analyses[pair.id] : undefined;
          const isLoading = pair ? loadingAnalysis[pair.id] : false;

          const pctChange = score
            ? parseFloat(((score.score - 50) * 0.1).toFixed(2))
            : null;

          const trend = score?.trend
            ? score.trend.charAt(0).toUpperCase() + score.trend.slice(1)
            : "Neutral";

          const confidence = score ? Math.round(score.score) : 50;

          // If no scores yet, show shimmer skeleton
          if (!hasScores) {
            return (
              <div
                key={sym}
                className="anim-fade-up rounded-lg overflow-hidden"
                style={{
                  animationDelay: `${200 + idx * 50}ms`,
                  height: "160px",
                }}
              >
                <div className="anim-shimmer w-full h-full rounded-lg" />
              </div>
            );
          }

          return (
            <div
              key={sym}
              className="anim-fade-up"
              style={{ animationDelay: `${200 + idx * 50}ms` }}
            >
              <InstrumentCard
                symbol={sym}
                percentChange={pctChange}
                trendLabel={trend}
                confidence={confidence}
                aiAnalysis={analysis?.summary ?? null}
                loading={isLoading}
                newsScore={score?.news_score ?? null}
                dataQuality={
                  score?.news_score != null && score?.social_score != null ? "full"
                  : score?.social_score == null && score?.news_score != null ? "no-social"
                  : score?.news_score == null && score?.social_score != null ? "no-news"
                  : "technical-only"
                }
                scannedAt={score?.scanned_at ?? null}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

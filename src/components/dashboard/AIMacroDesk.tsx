import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { InstrumentCard } from "./InstrumentCard";
import { useAllScores, type ScoreRow } from "@/hooks/useScores";

export function AIMacroDesk({ timeframe }: { timeframe: string }) {
  const navigate = useNavigate();
  const { data: allScores, isLoading } = useAllScores(timeframe);

  // Pick top 8 most trending pairs (highest deviation from 50)
  const topPairs = useMemo(() => {
    if (!allScores?.length) return [];
    return [...allScores]
      .filter((s) => s.score != null)
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
      .slice(0, 8);
  }, [allScores]);

  const hasScores = allScores && allScores.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-bullish" />
            <span className="font-semibold text-sm text-foreground">
              AI Macro Desk
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Top trending pairs · {timeframe}
          </p>
        </div>
        <button
          onClick={() => navigate("/scanner")}
          className="font-display transition-opacity hover:opacity-80 text-xs text-bullish"
        >
          View All →
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-2">
        {!hasScores
          ? Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="anim-fade-up rounded-lg overflow-hidden"
                style={{
                  animationDelay: `${200 + idx * 50}ms`,
                  height: "160px",
                }}
              >
                <div className="anim-shimmer w-full h-full rounded-lg" />
              </div>
            ))
          : topPairs.map((score, idx) => {
              const pctChange = parseFloat(((score.score - 50) * 0.1).toFixed(2));
              const trend = score.trend
                ? score.trend.charAt(0).toUpperCase() + score.trend.slice(1)
                : "Neutral";
              const confidence = Math.round(score.score);

              // Derive symbol from pair_id — we need it for display
              // The ScoreRow doesn't have symbol, so we show pair_id-based lookup
              // Actually useAllScores returns pair_id only; we need pairs info
              const symbol = (score as any).symbol ?? score.pair_id.slice(0, 6);

              return (
                <div
                  key={score.pair_id}
                  className="anim-fade-up cursor-pointer"
                  style={{ animationDelay: `${200 + idx * 50}ms` }}
                  onClick={() => navigate(`/pair/${symbol}`)}
                >
                  <InstrumentCard
                    symbol={symbol}
                    percentChange={pctChange}
                    trendLabel={trend}
                    confidence={confidence}
                    aiAnalysis={null}
                    loading={false}
                    newsScore={score.news_score ?? null}
                    dataQuality={
                      score.news_score != null && score.social_score != null
                        ? "full"
                        : score.social_score == null && score.news_score != null
                          ? "no-social"
                          : score.news_score == null && score.social_score != null
                            ? "no-news"
                            : "technical-only"
                    }
                    scannedAt={score.scanned_at ?? null}
                  />
                </div>
              );
            })}
      </div>
    </div>
  );
}

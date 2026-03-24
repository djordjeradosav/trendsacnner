import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { PairAnalysisCard } from "@/components/pair/PairAnalysisCard";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const TIMEFRAMES = ["5min", "15min", "1h", "4h", "1day"];
const TF_LABELS: Record<string, string> = {
  "5min": "5M", "15min": "15M", "1h": "1H", "4h": "4H", "1day": "1D",
};

const FRIENDLY_NAMES: Record<string, string> = {
  EURUSD: "Euro / US Dollar", GBPUSD: "British Pound / US Dollar",
  USDJPY: "US Dollar / Japanese Yen", USDCHF: "US Dollar / Swiss Franc",
  AUDUSD: "Australian Dollar / US Dollar", USDCAD: "US Dollar / Canadian Dollar",
  NZDUSD: "New Zealand Dollar / US Dollar", EURJPY: "Euro / Japanese Yen",
  EURGBP: "Euro / British Pound", XAUUSD: "Gold / US Dollar",
  XAGUSD: "Silver / US Dollar", US30USD: "Dow Jones 30",
  NAS100USD: "Nasdaq 100", SPX500USD: "S&P 500",
};

interface PairInfo {
  id: string; symbol: string; name: string; category: string;
}

interface DbScore {
  score: number; trend: string; ema_score: number | null;
  rsi_score: number | null; news_score: number | null;
  scanned_at: string; ema20: number | null; ema50: number | null;
  ema200: number | null; adx: number | null; rsi: number | null;
  macd_hist: number | null;
}

function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getTrendColor(trend: string | null | undefined): string {
  if (trend === "bullish") return "hsl(var(--bullish))";
  if (trend === "bearish") return "hsl(var(--bearish))";
  return "hsl(var(--neutral-tone))";
}

export default function PairDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [pair, setPair] = useState<PairInfo | null>(null);
  const [selectedTF, setSelectedTF] = useState("1h");
  const [scores, setScores] = useState<Record<string, DbScore | null>>({});
  const [priceData, setPriceData] = useState<{ time: string; price: number }[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [relatedScores, setRelatedScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const { user } = useAuth();

  const score = scores[selectedTF] ?? null;
  const trendColor = getTrendColor(score?.trend);

  // Load pair info
  useEffect(() => {
    if (!symbol) return;
    supabase.from("pairs").select("id, symbol, name, category")
      .eq("symbol", symbol).limit(1)
      .then(({ data }) => { if (data?.[0]) setPair(data[0]); });
  }, [symbol]);

  // Load scores for all TFs + candles for chart + news
  useEffect(() => {
    if (!pair) return;
    setLoading(true);

    const loadAll = async () => {
      // Scores for all TFs
      const { data: allScores } = await supabase
        .from("scores")
        .select("score, trend, ema_score, rsi_score, news_score, scanned_at, ema20, ema50, ema200, adx, rsi, macd_hist, timeframe")
        .eq("pair_id", pair.id)
        .order("scanned_at", { ascending: false });

      const scoreMap: Record<string, DbScore | null> = {};
      TIMEFRAMES.forEach(tf => { scoreMap[tf] = null; });
      allScores?.forEach(s => {
        if (!scoreMap[s.timeframe]) scoreMap[s.timeframe] = s as DbScore;
      });
      setScores(scoreMap);

      // Price candles for chart
      const { data: candles } = await supabase
        .from("candles").select("close, ts")
        .eq("pair_id", pair.id).eq("timeframe", selectedTF)
        .order("ts", { ascending: true }).limit(50);
      if (candles) {
        setPriceData(candles.map(c => ({
          time: new Date(c.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          price: c.close,
        })));
      }

      // News
      const base = pair.symbol.slice(0, 3);
      const { data: newsData } = await supabase
        .from("news_articles")
        .select("headline, source, published_at, sentiment, url, summary")
        .or(`relevant_pairs.cs.{"${pair.symbol}"},relevant_pairs.cs.{"${base}"}`)
        .order("published_at", { ascending: false }).limit(5);
      setNews(newsData ?? []);

      // Related pair scores
      const quote = pair.symbol.slice(3, 6);
      const { data: relPairs } = await supabase
        .from("pairs").select("id, symbol").eq("is_active", true);
      const related = (relPairs ?? []).filter(p =>
        p.symbol !== pair.symbol &&
        (p.symbol.startsWith(base) || p.symbol.startsWith(quote) ||
         p.symbol.endsWith(base) || p.symbol.endsWith(quote))
      ).slice(0, 6);

      if (related.length > 0) {
        const { data: relScores } = await supabase
          .from("scores")
          .select("pair_id, score, trend, timeframe")
          .in("pair_id", related.map(r => r.id))
          .eq("timeframe", selectedTF)
          .order("scanned_at", { ascending: false });

        const seen = new Set<string>();
        const deduped = (relScores ?? []).filter(s => {
          if (seen.has(s.pair_id)) return false;
          seen.add(s.pair_id); return true;
        });

        setRelatedScores(deduped.map(s => ({
          ...s,
          symbol: related.find(r => r.id === s.pair_id)?.symbol ?? "",
        })).filter(s => s.symbol).sort((a, b) => b.score - a.score));
      }

      setLoading(false);
    };
    loadAll();
  }, [pair, selectedTF]);

  // Scan
  const triggerScan = useCallback(async () => {
    if (!pair || scanning) return;
    setScanning(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const url = `https://${projectId}.supabase.co/functions/v1/fast-scan`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ timeframe: selectedTF }),
      });
      // Reload scores
      const { data: newScores } = await supabase
        .from("scores")
        .select("score, trend, ema_score, rsi_score, news_score, scanned_at, ema20, ema50, ema200, adx, rsi, macd_hist, timeframe")
        .eq("pair_id", pair.id).eq("timeframe", selectedTF)
        .order("scanned_at", { ascending: false }).limit(1);
      if (newScores?.[0]) {
        setScores(prev => ({ ...prev, [selectedTF]: newScores[0] as DbScore }));
      }
    } catch (e) { console.error("Scan failed:", e); }
    finally { setScanning(false); }
  }, [pair, selectedTF, scanning]);

  // Computed
  const latest = priceData[priceData.length - 1]?.price;
  const first = priceData[0]?.price;
  const change = latest && first ? latest - first : 0;
  const changePct = first ? (change / first * 100) : 0;
  const isUp = change >= 0;
  const lineColor = isUp ? "hsl(var(--bullish))" : "hsl(var(--bearish))";
  const decimals = pair?.category === "forex" ? 5 : 2;
  const displaySymbol = pair?.symbol?.replace(/USD$/, "") ?? symbol ?? "";

  if (!pair && loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* ═══ PAGE HEADER ═══ */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer">
            ← Back
          </button>
          <div className="flex items-center gap-3">
            {/* Score circle */}
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold font-mono border-2"
              style={{
                background: score?.trend === "bullish" ? "hsla(var(--bullish), 0.1)"
                  : score?.trend === "bearish" ? "hsla(var(--bearish), 0.1)" : "hsl(var(--secondary))",
                borderColor: trendColor,
                color: trendColor,
              }}>
              {score?.score?.toFixed(0) ?? "—"}
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tracking-wide">
                {displaySymbol}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {FRIENDLY_NAMES[pair?.symbol ?? ""] ?? pair?.name ?? symbol}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Bias / Technical / AI Confidence — desktop */}
        <div className="hidden md:flex gap-3">
          <HeaderCard label="Bias"
            value={score?.trend === "bullish" ? "Bullish" : score?.trend === "bearish" ? "Bearish" : "Neutral"}
            color={trendColor} />
          <HeaderCard label="Technical"
            value={(score?.ema20 ?? 0) > (score?.ema50 ?? 0) ? "Buy" : (score?.ema20 ?? 0) < (score?.ema50 ?? 0) ? "Sell" : "Hold"}
            color="hsl(var(--foreground))" />
          <HeaderCard label="AI Confidence"
            value={score ? `${score.score.toFixed(0)}%` : "—"}
            color={score ? (score.score > 65 ? "hsl(var(--bullish))" : score.score < 35 ? "hsl(var(--bearish))" : "hsl(var(--caution))") : "hsl(var(--muted-foreground))"} />
        </div>
      </div>

      {/* ═══ MOBILE HEADER CARDS ═══ */}
      <div className="flex md:hidden gap-2 px-4 py-2 border-b border-border overflow-x-auto">
        <MobileHeaderChip label="Bias"
          value={score?.trend === "bullish" ? "Bull" : score?.trend === "bearish" ? "Bear" : "Neutral"}
          color={trendColor} />
        <MobileHeaderChip label="Tech"
          value={(score?.ema20 ?? 0) > (score?.ema50 ?? 0) ? "Buy" : (score?.ema20 ?? 0) < (score?.ema50 ?? 0) ? "Sell" : "Hold"}
          color="hsl(var(--foreground))" />
        <MobileHeaderChip label="AI"
          value={score ? `${score.score.toFixed(0)}%` : "—"}
          color={score ? (score.score > 65 ? "hsl(var(--bullish))" : score.score < 35 ? "hsl(var(--bearish))" : "hsl(var(--caution))") : "hsl(var(--muted-foreground))"} />
        <MobileHeaderChip label="RSI"
          value={score?.rsi ? score.rsi.toFixed(0) : "—"}
          color={score?.rsi ? (score.rsi > 60 ? "hsl(var(--bullish))" : score.rsi < 40 ? "hsl(var(--bearish))" : "hsl(var(--muted-foreground))") : "hsl(var(--muted-foreground))"} />
        <MobileHeaderChip label="ADX"
          value={score?.adx ? score.adx.toFixed(0) : "—"}
          color={score?.adx ? (score.adx > 30 ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))") : "hsl(var(--muted-foreground))"} />
      </div>

      {/* ═══ TIMEFRAME TABS ═══ */}
      <div className="flex gap-1 px-6 py-3 border-b border-border">
        {TIMEFRAMES.map(tf => {
          const tfScore = scores[tf];
          const isActive = selectedTF === tf;
          const c = tfScore ? getTrendColor(tfScore.trend) : "hsl(var(--muted-foreground))";
          return (
            <button key={tf} onClick={() => setSelectedTF(tf)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive ? "border border-border bg-secondary" : "border border-transparent hover:bg-secondary/50"
              }`}
              style={{ color: isActive ? c : "hsl(var(--muted-foreground))", fontWeight: isActive ? 600 : 400 }}>
              {TF_LABELS[tf]}
              {tfScore && (
                <span className="ml-1.5 text-[11px] font-mono" style={{ color: c }}>
                  {tfScore.score.toFixed(0)}
                </span>
              )}
            </button>
          );
        })}
        <button onClick={triggerScan} disabled={scanning}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
          {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {scanning ? "Scanning…" : "Scan"}
        </button>
      </div>

      {/* ═══ TWO COLUMN BODY ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 p-6" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          {/* Price Mini Chart */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3">
              <div className="text-2xl font-bold font-mono text-foreground">
                {latest?.toFixed(decimals) ?? "—"}
              </div>
              <div className="text-xs mt-1" style={{ color: lineColor }}>
                {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(4)} ({isUp ? "+" : ""}{changePct.toFixed(2)}%)
              </div>
            </div>
            {priceData.length > 0 && (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={priceData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={["auto", "auto"]} hide />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                      borderRadius: "8px", fontSize: "12px", color: "hsl(var(--foreground))",
                    }}
                    formatter={(v: number) => [v.toFixed(decimals), "Price"]}
                  />
                  <Area type="monotone" dataKey="price" stroke={lineColor} strokeWidth={2}
                    fill="url(#priceGrad)" dot={false} activeDot={{ r: 4, fill: lineColor }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* News Stories */}
          <div className="rounded-xl border border-border bg-card p-4 flex-1">
            <div className="text-sm font-medium text-foreground mb-3">News Stories</div>
            {news.length === 0 && <p className="text-xs text-muted-foreground">No recent news</p>}
            {news.map((article, i) => (
              <div key={i} onClick={() => article.url && window.open(article.url, "_blank")}
                className={`py-2.5 cursor-pointer ${i < news.length - 1 ? "border-b border-border" : ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">{article.source}</span>
                  <span className="text-[10px] text-muted-foreground/60">{timeAgo(article.published_at)}</span>
                  <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: article.sentiment === "positive" ? "hsl(var(--bullish))"
                        : article.sentiment === "negative" ? "hsl(var(--bearish))" : "hsl(var(--neutral-tone))",
                    }} />
                </div>
                <div className="text-xs text-foreground leading-relaxed line-clamp-2">{article.headline}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          {/* AI Analysis */}
          {pair && (
            <PairAnalysisCard
              pairId={pair.id}
              timeframe={selectedTF}
              isAuthenticated={!!user}
            />
          )}

          {/* Market Mood + Policy row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MarketMoodCard score={score} />
            <MarketPolicyCard score={score} />
          </div>

          {/* Flow / Bearing / Pulse */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FlowCard score={score} />
            <BearingCard score={score} />
            <PulseCard score={score} />
          </div>

          {/* Market Sessions */}
          <MarketSessionsCard symbol={pair?.symbol ?? ""} />

          {/* Relative Strength */}
          <RelativeStrengthCard
            symbol={pair?.symbol ?? ""}
            thisScore={score}
            relatedScores={relatedScores}
            navigate={navigate}
          />
        </div>
      </div>
    </AppLayout>
  );
}

/* ═══ SUB-COMPONENTS ═══ */

function HeaderCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-3 text-center min-w-[100px]">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">{label}</div>
      <div className="text-lg font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

function MobileHeaderChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 shrink-0">
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-xs font-bold font-mono" style={{ color }}>{value}</span>
    </div>
  );
}

function MarketMoodCard({ score }: { score: DbScore | null }) {
  const s = score?.score ?? 50;
  const mood = s >= 75 ? { label: "RISK-ON", color: "hsl(var(--bullish))", desc: "Strong bullish momentum — traders positioned long aggressively." }
    : s >= 62 ? { label: "MILDLY BULLISH", color: "hsl(var(--bullish))", desc: "Positive bias — price action supports continuation higher." }
    : s >= 45 ? { label: "RISK-NEUTRAL", color: "hsl(var(--caution))", desc: "Positioning is mixed. No clear directional bias." }
    : s >= 35 ? { label: "MILDLY BEARISH", color: "hsl(var(--bearish))", desc: "Negative bias — price action suggests downside pressure." }
    : { label: "RISK-OFF", color: "hsl(var(--bearish))", desc: "Strong bearish momentum — sellers in control." };

  const angle = (s / 100) * 270 - 135;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-foreground">Market Mood</span>
        <span className="text-[11px] text-muted-foreground/60">{timeAgo(score?.scanned_at)}</span>
      </div>
      <div className="flex flex-col items-center my-2">
        <svg width="160" height="90" viewBox="0 0 160 90">
          <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="hsl(var(--border))" strokeWidth="14" strokeLinecap="round" />
          <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke={mood.color} strokeWidth="14" strokeLinecap="round" opacity="0.3" />
          <line x1="80" y1="80"
            x2={80 + 50 * Math.cos((angle - 90) * Math.PI / 180)}
            y2={80 + 50 * Math.sin((angle - 90) * Math.PI / 180)}
            stroke={mood.color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="80" cy="80" r="5" fill={mood.color} />
          <text x="15" y="88" fontSize="8" fill="hsl(var(--muted-foreground))">Bear</text>
          <text x="118" y="88" fontSize="8" fill="hsl(var(--muted-foreground))">Bull</text>
        </svg>
        <div className="text-sm font-bold -mt-2 tracking-wider" style={{ color: mood.color }}>{mood.label}</div>
      </div>
      <div className="rounded-lg bg-secondary/50 border border-border p-2.5 mt-2">
        <div className="text-xs font-medium text-foreground mb-1">Investor Positioning</div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{mood.desc}</p>
      </div>
    </div>
  );
}

function MarketPolicyCard({ score }: { score: DbScore | null }) {
  const s = score?.score ?? 50;
  const outlook = s >= 62 ? "POSITIVE" : s <= 38 ? "NEGATIVE" : "NEUTRAL";
  const desc = s >= 62 ? "Macro conditions support risk-on positioning. Technical signals aligned bullish."
    : s <= 38 ? "Macro conditions suggest caution. Technical signals point to downside risk."
    : "Macro is balanced. Central banks maintaining a neutral stance on current pair.";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-medium text-foreground mb-3">Market Policy</div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Global Economic Outlook</div>
      <div className="text-base font-semibold text-muted-foreground uppercase tracking-widest mb-2">{outlook}</div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function FlowCard({ score }: { score: DbScore | null }) {
  const adx = score?.adx ?? 20;
  const vol = adx > 35 ? "Crowded" : adx > 20 ? "Healthy" : "Thin";
  const volColor = vol === "Healthy" ? "hsl(var(--bullish))" : vol === "Crowded" ? "hsl(var(--bearish))" : "hsl(var(--caution))";
  const sliderPct = vol === "Thin" ? 15 : vol === "Healthy" ? 50 : 85;
  const desc = vol === "Healthy" ? "Normal participation — tape is well-structured."
    : vol === "Crowded" ? "Heavy positioning — risk of sharp reversals." : "Low participation — spreads may widen.";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground mb-3">Flow</div>
      <div className="flex gap-0.5 justify-center items-end h-10 mb-2">
        {[6, 10, 8, 14, 10, 7, 12, 9].map((h, i) => (
          <div key={i} className="w-1.5 rounded-sm" style={{ height: h, background: volColor, opacity: 0.8 }} />
        ))}
      </div>
      <div className="text-sm font-bold text-center uppercase tracking-wider mb-2.5" style={{ color: volColor }}>{vol}</div>
      <SliderBar pct={sliderPct} color={volColor}
        gradient="linear-gradient(to right, hsl(var(--caution)), hsl(var(--bullish)), hsl(var(--bearish)))"
        labels={["Thin", "Healthy", "Crowded"]} />
      <p className="text-[11px] text-muted-foreground leading-relaxed mt-2.5">{desc}</p>
    </div>
  );
}

function BearingCard({ score }: { score: DbScore | null }) {
  const s = score?.score ?? 50;
  const bearing = s >= 62 ? { label: "IMPULSE UP", color: "hsl(var(--bullish))" }
    : s >= 50 ? { label: "DRIFTING UP", color: "hsl(var(--bullish))" }
    : s >= 38 ? { label: "CHOPPY", color: "hsl(var(--caution))" }
    : s >= 25 ? { label: "CHOPPY DOWN", color: "hsl(var(--bearish))" }
    : { label: "IMPULSE DOWN", color: "hsl(var(--bearish))" };

  const generatePath = () => {
    const points: string[] = [];
    for (let i = 0; i <= 100; i += 5) {
      const choppy = s >= 38 && s <= 62;
      const y = choppy ? 20 + Math.sin(i * 0.8) * 12 + Math.sin(i * 1.6) * 6
        : s >= 62 ? 30 - i * 0.25 + Math.sin(i * 0.4) * 4
        : 10 + i * 0.25 + Math.sin(i * 0.4) * 4;
      points.push(`${i},${y}`);
    }
    return "M " + points.join(" L ");
  };

  const desc = s >= 62 ? "Clean directional move up. RSI and EMAs aligned."
    : s <= 38 ? "Downward drift — exercise caution. Bearish bias."
    : "Choppy conditions — wait for cleaner impulse.";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground mb-3">Bearing</div>
      <svg width="100%" height="50" viewBox="0 0 100 50" className="mb-2">
        <path d={generatePath()} fill="none" stroke={bearing.color} strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="text-sm font-bold text-center uppercase tracking-wider mb-2.5" style={{ color: bearing.color }}>{bearing.label}</div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function PulseCard({ score }: { score: DbScore | null }) {
  const adx = score?.adx ?? 20;
  const s = score?.score ?? 50;
  const pulse = adx > 30 && (s > 60 || s < 40) ? { label: "TRADABLE", color: "hsl(var(--bullish))" }
    : adx > 20 ? { label: "MODERATE", color: "hsl(var(--caution))" }
    : { label: "QUIET", color: "hsl(var(--muted-foreground))" };

  const sliderPct = pulse.label === "QUIET" ? 15 : pulse.label === "MODERATE" ? 50 : 80;
  const pulsePath = pulse.label === "TRADABLE"
    ? "M0,25 Q10,5 20,25 Q30,45 40,25 Q50,5 60,25 Q70,45 80,25 Q90,5 100,25"
    : pulse.label === "MODERATE"
    ? "M0,25 Q15,12 30,25 Q45,38 60,25 Q75,12 100,25"
    : "M0,25 Q25,22 50,25 Q75,28 100,25";

  const desc = pulse.label === "TRADABLE" ? "Volatility in normal range — setups have room to breathe."
    : pulse.label === "MODERATE" ? "ATR within average range. Risk-reward achievable."
    : "Very low volatility — consider waiting for expansion.";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground mb-3">Pulse</div>
      <svg width="100%" height="50" viewBox="0 0 100 50" className="mb-2">
        <path d={pulsePath} fill="none" stroke={pulse.color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div className="text-sm font-bold text-center uppercase tracking-wider mb-2.5" style={{ color: pulse.color }}>{pulse.label}</div>
      <SliderBar pct={sliderPct} color={pulse.color}
        gradient="linear-gradient(to right, hsl(var(--border)), hsl(var(--caution)), hsl(var(--bullish)))"
        labels={["Quiet", "Tradable", "Wild"]} />
      <p className="text-[11px] text-muted-foreground leading-relaxed mt-2.5">{desc}</p>
    </div>
  );
}

function SliderBar({ pct, color, gradient, labels }: { pct: number; color: string; gradient: string; labels: string[] }) {
  return (
    <>
      <div className="relative h-1.5 rounded-full mb-1.5" style={{ background: gradient }}>
        <div className="absolute -top-1 w-3 h-3 rounded-full bg-foreground border-2"
          style={{ left: `${pct}%`, transform: "translateX(-50%)", borderColor: color }} />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground/60">
        {labels.map(l => <span key={l}>{l}</span>)}
      </div>
    </>
  );
}

function MarketSessionsCard({ symbol }: { symbol: string }) {
  const now = new Date();
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
  const sessions = [
    { name: "Sydney", start: 22, end: 6, currencies: ["AUD", "NZD"] },
    { name: "Tokyo", start: 0, end: 9, currencies: ["JPY", "AUD"] },
    { name: "London", start: 8, end: 16, currencies: ["EUR", "GBP", "CHF"] },
    { name: "New York", start: 13, end: 21, currencies: ["USD", "CAD"] },
  ];

  const isOpen = (s: typeof sessions[0]) =>
    s.start < s.end ? utcH >= s.start && utcH < s.end : utcH >= s.start || utcH < s.end;
  const isRelevant = (s: typeof sessions[0]) =>
    s.currencies.some(c => symbol.startsWith(c) || symbol.endsWith(c));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-medium text-foreground mb-3">Market Sessions</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {sessions.map(s => {
          const open = isOpen(s);
          const rel = isRelevant(s);
          return (
            <div key={s.name} className="rounded-lg p-2.5 border"
              style={{
                background: open ? "hsla(var(--bullish), 0.06)" : "hsl(var(--card))",
                borderColor: open ? "hsla(var(--bullish), 0.3)" : "hsl(var(--border))",
                opacity: rel ? 1 : 0.5,
              }}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: open ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))" }} />
                <span className="text-[11px] font-medium" style={{ color: open ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))" }}>{s.name}</span>
              </div>
              <div className="text-[10px]" style={{ color: open ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))/60" }}>
                {open ? "OPEN" : "CLOSED"}
              </div>
              <div className="text-[9px] text-muted-foreground/60 mt-0.5">{s.currencies.join(" · ")}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RelativeStrengthCard({
  symbol, thisScore, relatedScores, navigate,
}: {
  symbol: string; thisScore: DbScore | null; relatedScores: any[];
  navigate: (path: string) => void;
}) {
  const avgRelated = relatedScores.length
    ? relatedScores.reduce((sum, s) => sum + s.score, 0) / relatedScores.length : 50;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-foreground">Relative Strength</span>
        <span className="text-[11px] text-muted-foreground/60">vs related pairs</span>
      </div>
      {relatedScores.length === 0 ? (
        <p className="text-xs text-muted-foreground">Run a scan to load relative strength</p>
      ) : (
        relatedScores.map(s => {
          const barColor = s.trend === "bullish" ? "hsl(var(--bullish))" : s.trend === "bearish" ? "hsl(var(--bearish))" : "hsl(var(--neutral-tone))";
          return (
            <div key={s.symbol} className="flex items-center gap-2.5 mb-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate("/pair/" + s.symbol)}>
              <span className="text-[11px] text-muted-foreground font-mono w-16">{s.symbol}</span>
              <div className="flex-1 h-1 rounded-full bg-secondary">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.score}%`, background: barColor }} />
              </div>
              <span className="text-xs font-mono w-7 text-right" style={{ color: barColor }}>{s.score.toFixed(0)}</span>
            </div>
          );
        })
      )}
      {thisScore && (
        <div className="mt-3 pt-2.5 border-t border-border text-[11px] text-muted-foreground">
          {symbol}:{" "}
          <span className="font-semibold" style={{
            color: (thisScore.score ?? 50) > avgRelated ? "hsl(var(--bullish))" : "hsl(var(--bearish))",
          }}>
            {(thisScore.score ?? 50) > avgRelated ? "Outperforming" : "Underperforming"}
          </span>{" "}
          vs related pairs avg ({avgRelated.toFixed(0)})
        </div>
      )}
    </div>
  );
}

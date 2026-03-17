import { useEffect, useState, useRef, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ScoreExplanation, ScoreFreshnessBadge, EventRiskFlag } from "@/components/score/ScoreExplanation";
import { AddToWatchlist } from "@/components/watchlist/AddToWatchlist";
import { PairAnalysisCard } from "@/components/pair/PairAnalysisCard";
import { PairNewsSection } from "@/components/news/PairNewsSection";
import { SocialBuzzCard } from "@/components/social/SocialBuzzCard";
import { useScoresStore } from "@/stores/useScoresStore";
import { useEnsureFreshData } from "@/hooks/useEnsureFreshData";
import { trendColor as getTrendColorHex, trendBadgeStyle, timeAgo, PAIR_NAMES, TIMEFRAME_CONFIG } from "@/lib/display";
import {
  calcEMA,
  calcRSI,
  calcMACD,
  calcADX,
  calcATR,
  calcBollingerBands,
  getLatestValue,
} from "@/lib/indicators";
import { calcTrendScore, type EnhancedScoreResult } from "@/lib/scoreEngine";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  ColorType,
  LineStyle,
  type CandlestickData,
  type LineData,
  type Time,
} from "lightweight-charts";

const TIMEFRAMES = ["15min", "30min", "1h", "4h", "1day"];

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  ts: string;
  pair_id: string;
  timeframe: string;
}

interface PairInfo {
  id: string;
  symbol: string;
  name: string;
  category: string;
}

function toChartTime(ts: string): Time {
  return Math.floor(new Date(ts).getTime() / 1000) as Time;
}

export default function PairDetail() {
  useEnsureFreshData();

  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [pair, setPair] = useState<PairInfo | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [timeframe, setTimeframe] = useState("1h");
  const [scoreResult, setScoreResult] = useState<EnhancedScoreResult | null>(null);
  const [scoreHistory, setScoreHistory] = useState<{ time: Time; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [overlays, setOverlays] = useState({ ema20: true, ema50: true, ema200: false, bb: false });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Read from Zustand store for all TFs
  const storeScore = useScoresStore((s) => symbol ? s.getScore(symbol, timeframe) : null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user));
  }, []);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const scoreChartRef = useRef<HTMLDivElement>(null);
  const scoreChartApiRef = useRef<IChartApi | null>(null);

  // Fetch pair info
  useEffect(() => {
    if (!symbol) return;
    const fetchPair = async () => {
      const { data } = await supabase
        .from("pairs")
        .select("id, symbol, name, category")
        .eq("symbol", symbol)
        .limit(1);
      if (data && data.length > 0) setPair(data[0]);
    };
    fetchPair();
  }, [symbol]);

  // Fetch candles when pair or timeframe changes
  useEffect(() => {
    if (!pair) return;
    const fetchCandles = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("candles")
        .select("open, high, low, close, volume, ts, pair_id, timeframe")
        .eq("pair_id", pair.id)
        .eq("timeframe", timeframe)
        .order("ts", { ascending: true })
        .limit(500);

      if (data && data.length > 0) {
        setCandles(data);
        const result = calcTrendScore(data);
        setScoreResult(result);
      } else {
        setCandles([]);
        setScoreResult(null);
      }
      setLoading(false);
    };
    fetchCandles();
  }, [pair, timeframe]);

  // Fetch score history
  useEffect(() => {
    if (!pair) return;
    const fetchHistory = async () => {
      const { data } = await supabase
        .from("scores")
        .select("score, scanned_at")
        .eq("pair_id", pair.id)
        .eq("timeframe", timeframe)
        .order("scanned_at", { ascending: true })
        .limit(200);

      if (data) {
        setScoreHistory(
          data.map((d) => ({ time: toChartTime(d.scanned_at), value: Number(d.score) }))
        );
      }
    };
    fetchHistory();
  }, [pair, timeframe]);

  // Computed indicators
  const indicators = useMemo(() => {
    if (candles.length === 0) return null;
    const sorted = [...candles].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    const closes = sorted.map((c) => c.close);
    const highs = sorted.map((c) => c.high);
    const lows = sorted.map((c) => c.low);

    const cfg = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG["1h"];
    const ema20 = calcEMA(closes, cfg.emaFast);
    const ema50 = calcEMA(closes, cfg.emaMid);
    const ema200 = calcEMA(closes, cfg.emaSlow);
    const rsi = calcRSI(closes, 14);
    const adx = calcADX(highs, lows, closes, 14);
    const atr = calcATR(highs, lows, closes, 14);
    const { macd, signal, histogram } = calcMACD(closes, 12, 26, 9);
    const bb = calcBollingerBands(closes, 20, 2);

    return {
      ema20, ema50, ema200, rsi, adx, atr, macd, signal, histogram, bb,
      latest: {
        ema20: getLatestValue(ema20),
        ema50: getLatestValue(ema50),
        ema200: getLatestValue(ema200),
        rsi: getLatestValue(rsi),
        adx: getLatestValue(adx),
        atr: getLatestValue(atr),
        macdHist: getLatestValue(histogram),
        bbWidth: getLatestValue(bb.bandwidth),
      },
      timestamps: sorted.map((c) => c.ts),
    };
  }, [candles, timeframe]);

  // Main candlestick chart
  useEffect(() => {
    if (!chartRef.current || candles.length === 0 || !indicators) return;
    if (chartApiRef.current) {
      chartApiRef.current.remove();
      chartApiRef.current = null;
    }

    const isMobile = chartRef.current.clientWidth < 640;
    const chartHeight = isMobile ? 280 : 420;

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: chartHeight,
      layout: {
        background: { type: ColorType.Solid, color: "hsl(222, 47%, 5%)" },
        textColor: "hsl(215, 12%, 48%)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "hsl(240, 20%, 12%)" },
        horzLines: { color: "hsl(240, 20%, 12%)" },
      },
      crosshair: {
        vertLine: { color: "#444" },
        horzLine: { color: "#444" },
      },
      rightPriceScale: { borderColor: "hsl(220, 18%, 16%)" },
      timeScale: { borderColor: "hsl(220, 18%, 16%)" },
      handleScroll: { vertTouchDrag: false },
      handleScale: { pinch: true, axisPressedMouseMove: true },
    });
    chartApiRef.current = chart;

    const sorted = [...candles].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "hsl(142, 60%, 50%)",
      downColor: "hsl(0, 72%, 51%)",
      borderUpColor: "hsl(142, 60%, 50%)",
      borderDownColor: "hsl(0, 72%, 51%)",
      wickUpColor: "hsl(142, 60%, 40%)",
      wickDownColor: "hsl(0, 72%, 40%)",
    });
    candleSeries.setData(
      sorted.map((c) => ({
        time: toChartTime(c.ts),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    if (overlays.ema20) {
      const s = chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const d: LineData[] = [];
      indicators.timestamps.forEach((ts, i) => {
        if (!isNaN(indicators.ema20[i])) d.push({ time: toChartTime(ts), value: indicators.ema20[i] });
      });
      s.setData(d);
    }
    if (overlays.ema50) {
      const s = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const d: LineData[] = [];
      indicators.timestamps.forEach((ts, i) => {
        if (!isNaN(indicators.ema50[i])) d.push({ time: toChartTime(ts), value: indicators.ema50[i] });
      });
      s.setData(d);
    }
    if (overlays.ema200) {
      const s = chart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const d: LineData[] = [];
      indicators.timestamps.forEach((ts, i) => {
        if (!isNaN(indicators.ema200[i])) d.push({ time: toChartTime(ts), value: indicators.ema200[i] });
      });
      s.setData(d);
    }
    if (overlays.bb) {
      const upperD: LineData[] = [];
      const lowerD: LineData[] = [];
      indicators.timestamps.forEach((ts, i) => {
        if (!isNaN(indicators.bb.upper[i])) {
          upperD.push({ time: toChartTime(ts), value: indicators.bb.upper[i] });
          lowerD.push({ time: toChartTime(ts), value: indicators.bb.lower[i] });
        }
      });
      const upperS = chart.addSeries(LineSeries, { color: "rgba(156,163,175,0.4)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      upperS.setData(upperD);
      const lowerS = chart.addSeries(LineSeries, { color: "rgba(156,163,175,0.4)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      lowerS.setData(lowerD);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartApiRef.current = null;
    };
  }, [candles, indicators, overlays]);

  // Score history mini chart
  useEffect(() => {
    if (!scoreChartRef.current || scoreHistory.length < 2) return;
    if (scoreChartApiRef.current) {
      scoreChartApiRef.current.remove();
      scoreChartApiRef.current = null;
    }

    const isMobile = scoreChartRef.current.clientWidth < 640;
    const scoreChartHeight = isMobile ? 200 : 180;

    const chart = createChart(scoreChartRef.current, {
      width: scoreChartRef.current.clientWidth,
      height: scoreChartHeight,
      layout: {
        background: { type: ColorType.Solid, color: "hsl(222, 47%, 5%)" },
        textColor: "hsl(215, 12%, 48%)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "hsl(240, 20%, 12%)" },
        horzLines: { color: "hsl(240, 20%, 12%)" },
      },
      rightPriceScale: { borderColor: "hsl(220, 18%, 16%)" },
      timeScale: { borderColor: "hsl(220, 18%, 16%)" },
      handleScroll: { vertTouchDrag: false },
      handleScale: { pinch: true },
    });
    scoreChartApiRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: "hsl(142, 60%, 50%)",
      topColor: "hsla(142, 60%, 50%, 0.3)",
      bottomColor: "hsla(142, 60%, 50%, 0.02)",
      lineWidth: 2,
      priceLineVisible: false,
    });
    series.setData(scoreHistory as any);

    series.createPriceLine({ price: 65, color: "hsla(142, 60%, 50%, 0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Bull" });
    series.createPriceLine({ price: 35, color: "hsla(0, 72%, 51%, 0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Bear" });

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (scoreChartRef.current) chart.applyOptions({ width: scoreChartRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      scoreChartApiRef.current = null;
    };
  }, [scoreHistory]);

  const toggleOverlay = (key: keyof typeof overlays) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const trendColorClass = scoreResult
    ? scoreResult.trend === "bullish"
      ? "text-bullish"
      : scoreResult.trend === "bearish"
        ? "text-bearish"
        : "text-neutral-tone"
    : "";

  const trendBg = scoreResult
    ? scoreResult.trend === "bullish"
      ? "bg-bullish/15 text-bullish border-bullish/30"
      : scoreResult.trend === "bearish"
        ? "bg-bearish/15 text-bearish border-bearish/30"
        : "bg-muted text-neutral-tone border-border"
    : "";

  const isShortTF = ["15min", "30min"].includes(timeframe);

  if (!pair) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[420px]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/scanner")} className="gap-1.5 self-start">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground">{pair.symbol}</h1>
          <span className="text-sm text-muted-foreground font-body">{PAIR_NAMES[pair.symbol] || pair.name}</span>
          <span className="text-[10px] font-display px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            {pair.category}
          </span>
          {storeScore && (
            <>
              <span className="text-sm font-display font-bold px-2.5 py-1 rounded-md border" style={{
                background: trendBadgeStyle(storeScore.trend).background,
                color: trendBadgeStyle(storeScore.trend).color,
                borderColor: trendBadgeStyle(storeScore.trend).color + "40",
              }}>
                {Math.round(storeScore.score)}/100
              </span>
              <span className="flex items-center gap-1 text-xs font-display font-semibold px-2 py-1 rounded-md border" style={{
                background: trendBadgeStyle(storeScore.trend).background,
                color: trendBadgeStyle(storeScore.trend).color,
                borderColor: trendBadgeStyle(storeScore.trend).color + "40",
              }}>
                {storeScore.trend === "bullish" && <TrendingUp className="w-3 h-3" />}
                {storeScore.trend === "bearish" && <TrendingDown className="w-3 h-3" />}
                {storeScore.trend === "neutral" && <Minus className="w-3 h-3" />}
                {storeScore.trend.toUpperCase()}
              </span>
            </>
          )}
          {!storeScore && scoreResult && (
            <>
              <span className={`text-sm font-display font-bold px-2.5 py-1 rounded-md border ${trendBg}`}>
                {scoreResult.score}
              </span>
              <span className={`flex items-center gap-1 text-xs font-display font-semibold px-2 py-1 rounded-md border ${trendBg}`}>
                {scoreResult.trend === "bullish" && <TrendingUp className="w-3 h-3" />}
                {scoreResult.trend === "bearish" && <TrendingDown className="w-3 h-3" />}
                {scoreResult.trend === "neutral" && <Minus className="w-3 h-3" />}
                {scoreResult.trend.toUpperCase()}
              </span>
            </>
          )}
          <AddToWatchlist pairId={pair.id} />
        </div>
      </div>

      {/* Multi-TF Summary Strip */}
      {symbol && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {TIMEFRAMES.map((tf) => {
            const s = useScoresStore.getState().getScore(symbol, tf);
            const cfg = TIMEFRAME_CONFIG[tf];
            const isActive = timeframe === tf;
            return (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`flex flex-col items-center min-w-[60px] px-3 py-2 rounded-lg border transition-all ${
                  isActive ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent/50"
                }`}
                style={isActive ? { borderColor: cfg.color } : {}}
              >
                <span className="text-[10px] font-display font-semibold" style={{ color: isActive ? cfg.color : "hsl(var(--muted-foreground))" }}>
                  {cfg.label}
                </span>
                <span className="text-lg font-display font-bold" style={{ color: s ? getTrendColorHex(s.trend) : "#3d5a70" }}>
                  {s ? Math.round(s.score) : "—"}
                </span>
                <span className="text-[10px]" style={{ color: s ? getTrendColorHex(s.trend) : "#3d5a70" }}>
                  {!s ? "?" : s.trend === "bullish" ? "↑" : s.trend === "bearish" ? "↓" : "→"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* MTF Alignment */}
      {symbol && (() => {
        const tfs = TIMEFRAMES;
        const scores = tfs.map((tf) => useScoresStore.getState().getScore(symbol, tf)).filter(Boolean);
        if (scores.length === 0) return null;
        const bullCount = scores.filter((s) => s!.trend === "bullish").length;
        const bearCount = scores.filter((s) => s!.trend === "bearish").length;
        const total = scores.length;
        let label = "";
        let cls = "text-neutral-tone";
        if (bullCount === total) { label = `⭐ Perfect Bullish Alignment — all ${total} timeframes agree`; cls = "text-bullish"; }
        else if (bearCount === total) { label = `⭐ Perfect Bearish Alignment — all ${total} timeframes agree`; cls = "text-bearish"; }
        else if (bullCount >= total * 0.8) { label = `${bullCount}/${total} timeframes Bullish — strong alignment`; cls = "text-bullish"; }
        else if (bearCount >= total * 0.8) { label = `${bearCount}/${total} timeframes Bearish — strong alignment`; cls = "text-bearish"; }
        else { label = `Mixed signals — ${bullCount}↑ ${bearCount}↓ across ${total} timeframes`; }
        return <p className={`text-xs font-display mb-4 ${cls}`}>{label}</p>;
      })()}

      {/* Overlay toggles */}
      <div className="hidden sm:flex items-center gap-2 mb-4">
        {(["ema20", "ema50", "ema200", "bb"] as const).map((key) => {
          const labels: Record<string, string> = {
            ema20: `EMA ${TIMEFRAME_CONFIG[timeframe]?.emaFast ?? 9}`,
            ema50: `EMA ${TIMEFRAME_CONFIG[timeframe]?.emaMid ?? 21}`,
            ema200: isShortTF ? "EMA50 (slow)" : `EMA ${TIMEFRAME_CONFIG[timeframe]?.emaSlow ?? 200}`,
            bb: "BB",
          };
          const colors: Record<string, string> = { ema20: "bg-blue-500", ema50: "bg-amber-500", ema200: "bg-red-500", bb: "bg-gray-400" };
          return (
            <button
              key={key}
              onClick={() => toggleOverlay(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-display font-medium border transition-colors ${
                overlays[key]
                  ? "bg-accent border-border text-foreground"
                  : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${colors[key]} ${overlays[key] ? "" : "opacity-30"}`} />
              {labels[key]}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <ErrorBoundary name="PairChart">
      {loading ? (
        <Skeleton className="h-[280px] sm:h-[420px] rounded-lg mb-6" />
      ) : candles.length === 0 ? (
        <div className="h-[280px] sm:h-[420px] rounded-lg border border-border bg-card flex items-center justify-center mb-6">
          <p className="text-sm text-muted-foreground">No candle data for this timeframe. Run a scan first.</p>
        </div>
      ) : (
        <div ref={chartRef} className="rounded-lg border border-border overflow-hidden mb-6" />
      )}
      </ErrorBoundary>

      {/* Score Breakdown + Indicator Values */}
      {(scoreResult || storeScore) && indicators && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Score Breakdown */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-display font-semibold text-foreground">Composite Score</h3>
                {scoreResult && <ScoreExplanation symbol={pair.symbol} score={scoreResult.score} explanationLines={scoreResult.explanationLines} />}
              </div>
              <div className="flex items-center gap-2">
                {scoreResult && <ScoreFreshnessBadge dataQuality={scoreResult.dataQuality} />}
                <span className={`text-3xl font-display font-bold ${trendColorClass}`}>
                  {storeScore ? Math.round(storeScore.score) : scoreResult?.score ?? "—"}
                </span>
              </div>
            </div>

            {scoreResult && (
              <>
                <p className="text-[9px] font-mono text-muted-foreground mb-1.5 mt-3">TECHNICAL ({scoreResult.breakdown.technicalTotal}/55)</p>
                <div className="space-y-2">
                  <GaugeBar label="EMA Alignment" value={scoreResult.breakdown.emaScore} max={22} raw={`EMA stack → +${scoreResult.breakdown.emaScore}pts`} color="bg-blue-500" />
                  <GaugeBar label="ADX Strength" value={scoreResult.breakdown.adxScore} max={11} raw={`ADX: ${indicators.latest.adx.toFixed(1)} → +${scoreResult.breakdown.adxScore}pts`} color="bg-amber-500" />
                  <GaugeBar label="RSI Bias" value={scoreResult.breakdown.rsiScore} max={11} raw={`RSI: ${indicators.latest.rsi.toFixed(1)} → +${scoreResult.breakdown.rsiScore}pts`} color="bg-purple-500" />
                  <GaugeBar label="MACD Momentum" value={scoreResult.breakdown.macdScore} max={11} raw={`Hist: ${indicators.latest.macdHist.toFixed(4)} → +${scoreResult.breakdown.macdScore}pts`} color="bg-emerald-500" />
                </div>

                <p className="text-[9px] font-mono text-muted-foreground mb-1.5 mt-4">FUNDAMENTAL ({scoreResult.breakdown.fundamentalTotal}/25)</p>
                <div className="space-y-2">
                  <GaugeBar label="News Sentiment" value={scoreResult.breakdown.newsScore} max={13} raw={`News → +${scoreResult.breakdown.newsScore}pts`} color="bg-cyan-500" />
                  <GaugeBar label="Event Risk" value={scoreResult.breakdown.eventRiskScore} max={12} raw={scoreResult.upcomingEvent ? `⚠ ${scoreResult.upcomingEvent}` : "No upcoming events → +12pts"} color="bg-orange-500" />
                </div>

                <p className="text-[9px] font-mono text-muted-foreground mb-1.5 mt-4">SOCIAL ({scoreResult.breakdown.socialTotal}/20)</p>
                <div className="space-y-2">
                  <GaugeBar label="StockTwits" value={scoreResult.breakdown.stocktwitsScore} max={10} raw={`StockTwits → +${scoreResult.breakdown.stocktwitsScore}pts`} color="bg-green-500" />
                  <GaugeBar label="Reddit/Social" value={scoreResult.breakdown.redditScore} max={10} raw={`Reddit → +${scoreResult.breakdown.redditScore}pts`} color="bg-red-500" />
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-display font-bold px-3 py-1.5 rounded-md border ${trendBg}`}>
                    {scoreResult.trend === "bullish" && <TrendingUp className="w-3.5 h-3.5" />}
                    {scoreResult.trend === "bearish" && <TrendingDown className="w-3.5 h-3.5" />}
                    {scoreResult.trend === "neutral" && <Minus className="w-3.5 h-3.5" />}
                    {scoreResult.trend.toUpperCase()}
                  </span>
                  {scoreResult.eventRiskFlag && (
                    <EventRiskFlag eventName={scoreResult.upcomingEvent} eventTime={scoreResult.upcomingEventTime} />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Indicator Values */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-display font-semibold text-foreground mb-4">Indicator Values</h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <IndicatorCell label={`EMA ${TIMEFRAME_CONFIG[timeframe]?.emaFast ?? 9}`} value={storeScore?.ema20 ?? indicators.latest.ema20} />
              <IndicatorCell label={`EMA ${TIMEFRAME_CONFIG[timeframe]?.emaMid ?? 21}`} value={storeScore?.ema50 ?? indicators.latest.ema50} />
              <IndicatorCell
                label={isShortTF ? "EMA50 (slow)" : `EMA ${TIMEFRAME_CONFIG[timeframe]?.emaSlow ?? 200}`}
                value={isShortTF ? NaN : (storeScore?.ema200 ?? indicators.latest.ema200)}
                color={isShortTF ? "text-muted-foreground" : undefined}
              />
              <IndicatorCell label="RSI" value={storeScore?.rsi ?? indicators.latest.rsi} color={rsiColor(storeScore?.rsi ?? indicators.latest.rsi)} />
              <IndicatorCell label="ADX" value={storeScore?.adx ?? indicators.latest.adx} color={adxColor(storeScore?.adx ?? indicators.latest.adx)} />
              <IndicatorCell label="MACD Hist" value={storeScore?.macd_hist ?? indicators.latest.macdHist} decimals={5} color={(storeScore?.macd_hist ?? indicators.latest.macdHist) >= 0 ? "text-bullish" : "text-bearish"} />
              <IndicatorCell label="Scanned" value={NaN} textValue={storeScore ? timeAgo(storeScore.scanned_at) : "—"} color="text-muted-foreground" />
              <IndicatorCell label="Timeframe" value={NaN} textValue={TIMEFRAME_CONFIG[timeframe]?.label ?? timeframe} color="text-primary" />
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis */}
      <ErrorBoundary name="AIBrief">
      {pair && (
        <div className="mb-6">
          <PairAnalysisCard pairId={pair.id} timeframe={timeframe} isAuthenticated={isAuthenticated} />
        </div>
      )}
      </ErrorBoundary>

      {/* Score History */}
      {scoreHistory.length >= 2 && (
        <div className="rounded-lg border border-border bg-card p-5 mb-6">
          <h3 className="text-sm font-display font-semibold text-foreground mb-3">Score History — {TIMEFRAME_CONFIG[timeframe]?.label ?? timeframe}</h3>
          <div ref={scoreChartRef} className="rounded overflow-hidden" />
        </div>
      )}

      {pair && <PairNewsSection symbol={pair.symbol} />}

      {pair && (
        <div className="mb-6">
          <SocialBuzzCard pairSymbol={pair.symbol} />
        </div>
      )}
    </AppLayout>
  );
}

function GaugeBar({ label, value, max, raw, color }: { label: string; value: number; max: number; raw: string; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-body text-muted-foreground">{label}</span>
        <span className="text-[11px] font-display text-foreground">{value}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{raw}</p>
    </div>
  );
}

function IndicatorCell({ label, value, decimals = 4, color, suffix = "", textValue }: { label: string; value: number; decimals?: number; color?: string; suffix?: string; textValue?: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <p className="text-[10px] text-muted-foreground mb-1 font-body">{label}</p>
      <p className={`text-sm font-display font-bold ${color || "text-foreground"}`}>
        {textValue ? textValue : isNaN(value) ? "N/A" : value.toFixed(decimals)}{suffix}
      </p>
    </div>
  );
}

function rsiColor(rsi: number): string {
  if (rsi > 70) return "text-bearish";
  if (rsi < 30) return "text-bullish";
  return "text-foreground";
}

function adxColor(adx: number): string {
  if (adx >= 25) return "text-bullish";
  if (adx >= 15) return "text-amber-400";
  return "text-muted-foreground";
}

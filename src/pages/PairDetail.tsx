import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AddToWatchlist } from "@/components/watchlist/AddToWatchlist";
import { PairAnalysisCard } from "@/components/pair/PairAnalysisCard";
import {
  calcEMA,
  calcRSI,
  calcMACD,
  calcADX,
  calcATR,
  calcBollingerBands,
  getLatestValue,
} from "@/lib/indicators";
import { calcTrendScore, type ScoreResult } from "@/lib/scoreEngine";
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

const TIMEFRAMES = ["15min", "1h", "4h", "1day", "1week"];
const TF_LABELS: Record<string, string> = {
  "15min": "15M",
  "1h": "1H",
  "4h": "4H",
  "1day": "1D",
  "1week": "1W",
};

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
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [pair, setPair] = useState<PairInfo | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [timeframe, setTimeframe] = useState("1h");
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [scoreHistory, setScoreHistory] = useState<{ time: Time; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [overlays, setOverlays] = useState({ ema20: true, ema50: true, ema200: false, bb: false });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
        .order("scanned_at", { ascending: true })
        .limit(48);

      if (data) {
        setScoreHistory(
          data.map((d) => ({ time: toChartTime(d.scanned_at), value: Number(d.score) }))
        );
      }
    };
    fetchHistory();
  }, [pair]);

  // Computed indicators
  const indicators = useMemo(() => {
    if (candles.length === 0) return null;
    const sorted = [...candles].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    const closes = sorted.map((c) => c.close);
    const highs = sorted.map((c) => c.high);
    const lows = sorted.map((c) => c.low);

    const ema20 = calcEMA(closes, 20);
    const ema50 = calcEMA(closes, 50);
    const ema200 = calcEMA(closes, 200);
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
  }, [candles]);

  // Main candlestick chart
  useEffect(() => {
    if (!chartRef.current || candles.length === 0 || !indicators) return;

    // Cleanup previous
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

    // Candlestick
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

    // Overlay: EMA lines
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

    const chart = createChart(scoreChartRef.current, {
      width: scoreChartRef.current.clientWidth,
      height: 180,
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

    // Dashed lines at 35 and 65
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

  const trendColor = scoreResult
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
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/scanner")} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <h1 className="text-2xl font-bold font-display text-foreground">{pair.symbol}</h1>
          <span className="text-sm text-muted-foreground font-body">{pair.name}</span>
          <span className="text-[10px] font-display px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            {pair.category}
          </span>
          {scoreResult && (
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

      {/* Timeframe switcher */}
      <div className="flex items-center gap-2 mb-4">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1.5 rounded-md text-xs font-display font-semibold transition-colors ${
              timeframe === tf
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {TF_LABELS[tf]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {(["ema20", "ema50", "ema200", "bb"] as const).map((key) => {
            const labels: Record<string, string> = { ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200", bb: "BB" };
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
      </div>

      {/* Chart */}
      {loading ? (
        <Skeleton className="h-[420px] rounded-lg mb-6" />
      ) : candles.length === 0 ? (
        <div className="h-[420px] rounded-lg border border-border bg-card flex items-center justify-center mb-6">
          <p className="text-sm text-muted-foreground">No candle data for this timeframe. Run a scan first.</p>
        </div>
      ) : (
        <div ref={chartRef} className="rounded-lg border border-border overflow-hidden mb-6" />
      )}

      {/* Score Breakdown + Indicator Values */}
      {scoreResult && indicators && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Score Breakdown */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-display font-semibold text-foreground">Trend Score Breakdown</h3>
              <span className={`text-3xl font-display font-bold ${trendColor}`}>{scoreResult.score}</span>
            </div>
            <div className="space-y-3">
              <GaugeBar label="EMA Alignment" value={scoreResult.emaScore} max={40} raw={`EMA stack → +${scoreResult.emaScore}pts`} color="bg-blue-500" />
              <GaugeBar label="ADX Strength" value={scoreResult.adxScore} max={20} raw={`ADX: ${indicators.latest.adx.toFixed(1)} → +${scoreResult.adxScore}pts`} color="bg-amber-500" />
              <GaugeBar label="RSI Bias" value={scoreResult.rsiScore} max={20} raw={`RSI: ${indicators.latest.rsi.toFixed(1)} → +${scoreResult.rsiScore}pts`} color="bg-purple-500" />
              <GaugeBar label="MACD Momentum" value={scoreResult.macdScore} max={20} raw={`Hist: ${indicators.latest.macdHist.toFixed(4)} → +${scoreResult.macdScore}pts`} color="bg-emerald-500" />
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <span className={`inline-flex items-center gap-1.5 text-xs font-display font-bold px-3 py-1.5 rounded-md border ${trendBg}`}>
                {scoreResult.trend === "bullish" && <TrendingUp className="w-3.5 h-3.5" />}
                {scoreResult.trend === "bearish" && <TrendingDown className="w-3.5 h-3.5" />}
                {scoreResult.trend === "neutral" && <Minus className="w-3.5 h-3.5" />}
                {scoreResult.trend.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Indicator Values */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-display font-semibold text-foreground mb-4">Indicator Values</h3>
            <div className="grid grid-cols-2 gap-3">
              <IndicatorCell label="EMA 20" value={indicators.latest.ema20} />
              <IndicatorCell label="EMA 50" value={indicators.latest.ema50} />
              <IndicatorCell label="EMA 200" value={indicators.latest.ema200} />
              <IndicatorCell label="RSI" value={indicators.latest.rsi} color={rsiColor(indicators.latest.rsi)} />
              <IndicatorCell label="ADX" value={indicators.latest.adx} color={adxColor(indicators.latest.adx)} />
              <IndicatorCell label="MACD Hist" value={indicators.latest.macdHist} decimals={5} color={indicators.latest.macdHist >= 0 ? "text-bullish" : "text-bearish"} />
              <IndicatorCell label="ATR" value={indicators.latest.atr} decimals={5} />
              <IndicatorCell label="BB Width" value={indicators.latest.bbWidth} decimals={2} suffix="%" />
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {pair && (
        <div className="mb-6">
          <PairAnalysisCard pairId={pair.id} timeframe={timeframe} isAuthenticated={isAuthenticated} />
        </div>
      )}

      {/* Score History */}
      {scoreHistory.length >= 2 && (
        <div className="rounded-lg border border-border bg-card p-5 mb-6">
          <h3 className="text-sm font-display font-semibold text-foreground mb-3">Score History</h3>
          <div ref={scoreChartRef} className="rounded overflow-hidden" />
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

function IndicatorCell({ label, value, decimals = 4, color, suffix = "" }: { label: string; value: number; decimals?: number; color?: string; suffix?: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <p className="text-[10px] text-muted-foreground mb-1 font-body">{label}</p>
      <p className={`text-sm font-display font-bold ${color || "text-foreground"}`}>
        {isNaN(value) ? "—" : value.toFixed(decimals)}{suffix}
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

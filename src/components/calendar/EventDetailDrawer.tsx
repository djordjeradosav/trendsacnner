import { useEffect, useCallback, useState } from "react";
import { useEventDrawer } from "@/hooks/useEventDrawer";
import { CURRENCY_COLORS } from "@/hooks/useEconomicCalendar";
import { X, Star, Bell, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { OverviewTab } from "./tabs/OverviewTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { PredictionsTab } from "./tabs/PredictionsTab";
import { NewsTab } from "./tabs/NewsTab";
import { AlertsTab } from "./tabs/AlertsTab";
import { NotesTab } from "./tabs/NotesTab";

const TABS = ["overview", "history", "predictions", "news", "alerts", "notes"] as const;
const TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  history: "History",
  predictions: "Predictions",
  news: "News",
  alerts: "Alerts",
  notes: "Notes",
};

const IMPACT_COLORS: Record<string, string> = {
  high: "#dc2626",
  medium: "#f97316",
  low: "#eab308",
  holiday: "#6b7280",
};

function formatScheduledTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" });
}

function getCountdown(dateStr: string): { text: string; color: string; isLive: boolean } {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0 && Math.abs(diff) < 5 * 60 * 1000) {
    return { text: "LIVE NOW", color: "hsl(var(--destructive))", isLive: true };
  }
  if (diff < 0) {
    return { text: "Released", color: "hsl(var(--muted-foreground))", isLive: false };
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  parts.push(`${h}h`);
  parts.push(`${m}m`);
  const text = `in ${parts.join(" ")}`;
  const color = diff < 15 * 60 * 1000
    ? "hsl(var(--destructive))"
    : diff < 60 * 60 * 1000
    ? "hsl(var(--caution))"
    : "hsl(var(--bullish))";
  return { text, color, isLive: false };
}

export function EventDetailDrawer() {
  const { isOpen, event, initialTab, close, setTab } = useEventDrawer();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isFavourite, setIsFavourite] = useState(false);
  const [countdown, setCountdown] = useState({ text: "", color: "", isLive: false });
  const { user } = useAuth();

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, event]);

  // Live countdown
  useEffect(() => {
    if (!event) return;
    const update = () => setCountdown(getCountdown(event.scheduled_at));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [event]);

  // Check favourite status
  useEffect(() => {
    if (!event || !user) return;
    supabase
      .from("user_favourites")
      .select("id")
      .eq("user_id", user.id)
      .eq("event_name", event.event_name)
      .eq("currency", event.currency || "")
      .maybeSingle()
      .then(({ data }) => setIsFavourite(!!data));
  }, [event, user]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      const num = parseInt(e.key);
      if (num >= 1 && num <= 6) {
        setActiveTab(TABS[num - 1]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  const toggleFavourite = useCallback(async () => {
    if (!event || !user) return;
    if (isFavourite) {
      await supabase
        .from("user_favourites")
        .delete()
        .eq("user_id", user.id)
        .eq("event_name", event.event_name)
        .eq("currency", event.currency || "");
      setIsFavourite(false);
    } else {
      await supabase.from("user_favourites").insert({
        user_id: user.id,
        event_name: event.event_name,
        currency: event.currency || "",
      });
      setIsFavourite(true);
    }
  }, [event, user, isFavourite]);

  const handleShare = useCallback(() => {
    if (!event) return;
    const text = `${event.currency} ${event.event_name} — ${formatScheduledTime(event.scheduled_at)} | F: ${event.forecast || "N/A"} | P: ${event.previous || "N/A"}`;
    navigator.clipboard.writeText(text);
  }, [event]);

  if (!isOpen || !event) return null;

  const curColor = CURRENCY_COLORS[(event.currency || "").toUpperCase()] || "hsl(var(--muted-foreground))";
  const impactColor = IMPACT_COLORS[event.impact] || IMPACT_COLORS.low;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[999] bg-black/50 transition-opacity"
        onClick={close}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 z-[1000] h-full flex flex-col border-l border-border overflow-hidden"
        style={{
          width: "min(480px, 100vw)",
          background: "hsl(var(--card))",
          animation: "slideInRight 0.4s ease-out",
        }}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: impactColor }}
                />
                <span className="text-[11px] font-mono font-bold" style={{ color: curColor }}>
                  {event.currency}
                </span>
              </div>
              <h2 className="text-base font-medium text-foreground truncate">{event.event_name}</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatScheduledTime(event.scheduled_at)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                onClick={toggleFavourite}
                className="p-1.5 rounded hover:bg-secondary transition-colors"
                title="Favourite"
              >
                <Star
                  className="w-4 h-4"
                  style={{ color: isFavourite ? "#eab308" : "hsl(var(--muted-foreground))" }}
                  fill={isFavourite ? "#eab308" : "none"}
                />
              </button>
              <button
                onClick={() => { setActiveTab("alerts"); }}
                className="p-1.5 rounded hover:bg-secondary transition-colors"
                title="Set alert"
              >
                <Bell className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={handleShare}
                className="p-1.5 rounded hover:bg-secondary transition-colors"
                title="Copy details"
              >
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={close}
                className="p-1.5 rounded hover:bg-secondary transition-colors"
                title="Close (Esc)"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Countdown chip */}
          <div className="mt-2">
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-border"
              style={{ color: countdown.color }}
            >
              {countdown.isLive && "🔴 "}{countdown.text}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex gap-1 px-3 py-2 border-b border-border overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors"
              style={{
                background: activeTab === tab ? "hsl(var(--bullish) / 0.15)" : "transparent",
                color: activeTab === tab ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))",
                border: activeTab === tab ? "1px solid hsl(var(--bullish) / 0.3)" : "1px solid transparent",
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "overview" && <OverviewTab event={event} countdown={countdown} />}
          {activeTab === "history" && <HistoryTab event={event} />}
          {activeTab === "predictions" && <PredictionsTab event={event} />}
          {activeTab === "news" && <NewsTab event={event} />}
          {activeTab === "alerts" && <AlertsTab event={event} />}
          {activeTab === "notes" && <NotesTab event={event} />}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

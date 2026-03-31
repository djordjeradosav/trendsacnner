import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Bell, Gauge, RefreshCw, TrendingUp, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NewAlertDialog } from "@/components/alerts/NewAlertDialog";
import { cn } from "@/lib/utils";

interface AlertRule {
  id: string;
  rule_type: string;
  pair_id: string | null;
  direction: string;
  threshold: number;
  is_active: boolean;
  category_filter: string | null;
  webhook_url: string | null;
  description: string | null;
  last_triggered_at: string | null;
  created_at: string;
  pair_symbol?: string;
}

interface Notification {
  id: string;
  rule_id: string;
  pair_id: string;
  message: string;
  score_at_trigger: number;
  trend_at_trigger: string;
  is_read: boolean;
  created_at: string;
}

const RULE_ICONS: Record<string, React.ReactNode> = {
  score_threshold: <Gauge className="w-4 h-4" />,
  trend_flip: <RefreshCw className="w-4 h-4" />,
  strong_trend_scan: <TrendingUp className="w-4 h-4" />,
};

const RULE_LABELS: Record<string, string> = {
  score_threshold: "Score Threshold",
  trend_flip: "Trend Flip",
  strong_trend_scan: "Strong Trend",
};

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [rulesRes, notifsRes, pairsRes] = await Promise.all([
      supabase.from("alert_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("alert_notifications").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("pairs").select("id, symbol"),
    ]);

    const pairMap = new Map<string, string>();
    pairsRes.data?.forEach((p) => pairMap.set(p.id, p.symbol));

    if (rulesRes.data) {
      setRules(rulesRes.data.map((r) => ({
        ...r,
        pair_symbol: r.pair_id ? pairMap.get(r.pair_id) : undefined,
      })));
    }
    if (notifsRes.data) setNotifications(notifsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleRule = async (id: string, active: boolean) => {
    await supabase.from("alert_rules").update({ is_active: active }).eq("id", id);
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, is_active: active } : r));
  };

  const deleteRule = async (id: string) => {
    await supabase.from("alert_rules").delete().eq("id", id);
    setRules((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Rule deleted" });
  };

  const markRead = async (id: string) => {
    await supabase.from("alert_notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const formatAgo = (dateStr: string | null) => {
    if (!dateStr) return "Never triggered";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground">Alerts</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{rules.length} rules · {notifications.filter((n) => !n.is_read).length} unread</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5 text-xs sm:text-sm sm:gap-2">
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">New Alert</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Rules */}
      <div className="rounded-lg border border-border bg-card overflow-hidden mb-6 sm:mb-8">
        {/* Desktop header */}
        <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-3 border-b border-border text-xs font-display text-muted-foreground">
          <span>Type</span>
          <span>Description</span>
          <span>Pair</span>
          <span>Last Triggered</span>
          <span>Active</span>
          <span></span>
        </div>

        {loading && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
        )}

        {!loading && rules.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No alert rules yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setDialogOpen(true)}>
              Create your first alert
            </Button>
          </div>
        )}

        {rules.map((rule) => (
          <div key={rule.id}>
            {/* Desktop row */}
            <div
              className={cn(
                "hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-3 items-center border-b border-border last:border-b-0 text-sm",
                !rule.is_active && "opacity-50"
              )}
            >
              <div className="flex items-center gap-2 text-primary">
                {RULE_ICONS[rule.rule_type]}
                <Badge variant="secondary" className="text-[10px]">{RULE_LABELS[rule.rule_type] || rule.rule_type}</Badge>
              </div>
              <span className="text-foreground truncate">{rule.description || "—"}</span>
              <span className="font-display text-xs text-muted-foreground">{rule.pair_symbol || "Any"}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatAgo(rule.last_triggered_at)}
              </span>
              <Switch checked={rule.is_active} onCheckedChange={(v) => toggleRule(rule.id, v)} />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteRule(rule.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            {/* Mobile card */}
            <div
              className={cn(
                "sm:hidden flex flex-col gap-2 px-3 py-3 border-b border-border last:border-b-0",
                !rule.is_active && "opacity-50"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  {RULE_ICONS[rule.rule_type]}
                  <Badge variant="secondary" className="text-[10px]">{RULE_LABELS[rule.rule_type] || rule.rule_type}</Badge>
                  <span className="font-display text-[11px] text-muted-foreground">{rule.pair_symbol || "Any"}</span>
                </div>
                <Switch checked={rule.is_active} onCheckedChange={(v) => toggleRule(rule.id, v)} />
              </div>
              <p className="text-xs text-foreground truncate">{rule.description || "—"}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatAgo(rule.last_triggered_at)}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteRule(rule.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notification history */}
      {notifications.length > 0 && (
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground mb-3">Notification History</h2>
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={cn(
                  "rounded-lg border px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors",
                  n.is_read ? "border-border bg-card" : "border-primary/30 bg-primary/5"
                )}
              >
                <Bell className={cn("w-4 h-4 mt-0.5 shrink-0", n.is_read ? "text-muted-foreground" : "text-primary")} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Score: {n.score_at_trigger} · {n.trend_at_trigger} · {formatAgo(n.created_at)}
                  </p>
                </div>
                {!n.is_read && (
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <NewAlertDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchData} />
    </AppLayout>
  );
}

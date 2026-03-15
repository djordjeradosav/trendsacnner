import { useEffect, useState, useCallback } from "react";
import type { EconomicEvent } from "@/hooks/useEconomicCalendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Trash2, Clock, TrendingUp, TrendingDown, AlertTriangle, Megaphone } from "lucide-react";
import { toast } from "sonner";

interface AlertRule {
  id: string;
  rule_type: string;
  threshold: number;
  direction: string;
  is_active: boolean;
  description: string | null;
  event_metadata: any;
  webhook_url: string | null;
}

interface Props {
  event: EconomicEvent;
}

const TRIGGER_OPTIONS = [
  { id: "before", icon: Clock, label: "Before release", desc: "Notify X minutes before" },
  { id: "on_release", icon: Megaphone, label: "When actual released", desc: "Immediate notification" },
  { id: "big_surprise", icon: AlertTriangle, label: "On big surprise", desc: "If |actual - forecast| exceeds threshold" },
  { id: "beat", icon: TrendingUp, label: "If beats forecast", desc: "Actual > forecast only" },
  { id: "miss", icon: TrendingDown, label: "If misses forecast", desc: "Actual < forecast only" },
];

const BEFORE_OPTIONS = [5, 10, 15, 30, 60];

export function AlertsTab({ event }: Props) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [triggerType, setTriggerType] = useState("before");
  const [beforeMinutes, setBeforeMinutes] = useState(15);
  const [surpriseThreshold, setSurpriseThreshold] = useState("0.3");
  const [customMessage, setCustomMessage] = useState("");

  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("alert_rules")
      .select("*")
      .eq("user_id", user.id)
      .eq("rule_type", "event_alert")
      .not("event_metadata", "is", null);

    // Filter to this event
    const matching = ((data as any[]) || []).filter((r) => {
      const meta = r.event_metadata;
      return meta?.event_name === event.event_name && meta?.currency === (event.currency || "");
    });
    setAlerts(matching);
    setLoading(false);
  }, [user, event.event_name, event.currency]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const createAlert = async () => {
    if (!user) return;
    const threshold = triggerType === "before"
      ? beforeMinutes
      : triggerType === "big_surprise"
      ? parseFloat(surpriseThreshold) || 0.3
      : 0;

    const { error } = await supabase.from("alert_rules").insert({
      user_id: user.id,
      rule_type: "event_alert",
      direction: triggerType === "miss" ? "below" : "above",
      threshold,
      description: customMessage || `${event.currency} ${event.event_name} alert`,
      event_metadata: {
        event_name: event.event_name,
        currency: event.currency,
        scheduled_at: event.scheduled_at,
        trigger_type: triggerType,
      },
    });

    if (error) {
      toast.error("Failed to create alert");
    } else {
      toast.success("Alert created");
      setCreating(false);
      setCustomMessage("");
      fetchAlerts();
    }
  };

  const deleteAlert = async (id: string) => {
    await supabase.from("alert_rules").delete().eq("id", id);
    toast.success("Alert deleted");
    fetchAlerts();
  };

  const toggleAlert = async (id: string, active: boolean) => {
    await supabase.from("alert_rules").update({ is_active: !active }).eq("id", id);
    fetchAlerts();
  };

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-12 rounded bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Existing alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase">Active Alerts</h3>
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
              style={{ background: "hsl(var(--secondary))" }}
            >
              <Bell className="w-4 h-4 shrink-0" style={{ color: a.is_active ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-foreground truncate">{a.description}</p>
                <p className="text-[9px] text-muted-foreground">
                  {a.event_metadata?.trigger_type} · threshold: {a.threshold}
                </p>
              </div>
              <button
                onClick={() => toggleAlert(a.id, a.is_active)}
                className="text-[9px] px-2 py-0.5 rounded border border-border"
                style={{
                  color: a.is_active ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))",
                }}
              >
                {a.is_active ? "Active" : "Paused"}
              </button>
              <button
                onClick={() => deleteAlert(a.id)}
                className="p-1 rounded hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create alert */}
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="w-full py-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
        >
          + {alerts.length > 0 ? "Add another alert" : "Create alert for this event"}
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-3" style={{ background: "hsl(var(--secondary))" }}>
          <h4 className="text-[11px] font-medium text-foreground">When to alert</h4>
          <div className="space-y-1.5">
            {TRIGGER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTriggerType(opt.id)}
                className="w-full flex items-center gap-3 p-2 rounded text-left transition-colors"
                style={{
                  background: triggerType === opt.id ? "hsl(var(--bullish) / 0.08)" : "transparent",
                  border: triggerType === opt.id ? "1px solid hsl(var(--bullish) / 0.2)" : "1px solid transparent",
                }}
              >
                <opt.icon className="w-4 h-4 shrink-0" style={{ color: triggerType === opt.id ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))" }} />
                <div>
                  <div className="text-[11px] text-foreground">{opt.label}</div>
                  <div className="text-[9px] text-muted-foreground">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {triggerType === "before" && (
            <div className="flex gap-1">
              {BEFORE_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setBeforeMinutes(m)}
                  className="px-2 py-1 rounded text-[10px] font-mono transition-colors"
                  style={{
                    background: beforeMinutes === m ? "hsl(var(--bullish) / 0.15)" : "hsl(var(--card))",
                    color: beforeMinutes === m ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))",
                    border: "1px solid hsl(var(--border))",
                  }}
                >
                  {m}m
                </button>
              ))}
            </div>
          )}

          {triggerType === "big_surprise" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">If surprise exceeds ±</span>
              <input
                type="text"
                value={surpriseThreshold}
                onChange={(e) => setSurpriseThreshold(e.target.value)}
                className="w-16 px-2 py-1 rounded border border-border bg-card text-foreground text-[11px] font-mono"
              />
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
          )}

          {/* Custom message */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Note (optional)</label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a note to this alert..."
              className="w-full h-16 px-2 py-1.5 rounded border border-border bg-card text-foreground text-[11px] resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={createAlert}
              className="flex-1 py-2 rounded text-[11px] font-medium transition-colors"
              style={{ background: "hsl(var(--bullish))", color: "hsl(var(--primary-foreground))" }}
            >
              Save Alert
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-4 py-2 rounded text-[11px] border border-border text-muted-foreground hover:bg-card transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

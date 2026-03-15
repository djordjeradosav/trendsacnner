import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAutoScan, scanIntervalOptions } from "@/hooks/useAutoScan";
import { useTimeframe, timeframeOptions } from "@/hooks/useTimeframe";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Timer, Clock, Bell, Volume2, Palette, Database, User, Trash2,
  Download, TestTube, Send, Shield, Loader2,
} from "lucide-react";

function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { scanInterval, setScanInterval } = useAutoScan();
  const { selectedTimeframe, setTimeframe } = useTimeframe();
  const { toast } = useToast();

  const [alertSound, setAlertSound] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [compactView, setCompactView] = useState(false);
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [testingScan, setTestingScan] = useState(false);
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [saved, setSaved] = useState(false);

  // Markets toggles
  const [markets, setMarkets] = useState({ forex: true, futures: true, commodity: true });
  const { permission: pushPermission, requestPermission } = usePushNotifications();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setAlertSound(data.alert_sound);
        }
      });
  }, [user]);

  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const saveSetting = async (updates: Record<string, unknown>) => {
    if (!user) return;
    await supabase.from("user_settings").upsert(
      { user_id: user.id, ...updates },
      { onConflict: "user_id" }
    );
    flashSaved();
  };

  const handleTestScan = async () => {
    setTestingScan(true);
    try {
      const { data: pairs } = await supabase.from("pairs").select("id, symbol").eq("is_active", true).limit(5);
      if (!pairs?.length) throw new Error("No pairs found");
      toast({ title: "Test scan OK", description: `Found ${pairs.length} pairs: ${pairs.map(p => p.symbol).join(", ")}` });
    } catch (err) {
      toast({ title: "Test scan failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setTestingScan(false);
  };

  const handleTestDiscord = async () => {
    if (!discordWebhook) return;
    setTestingDiscord(true);
    try {
      const res = await fetch(discordWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "🟢 TrendScan AI — Test notification successful!" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: "Discord test sent!" });
    } catch (err) {
      toast({ title: "Discord test failed", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    }
    setTestingDiscord(false);
  };

  const handleTestTelegram = async () => {
    if (!telegramToken || !telegramChatId) return;
    setTestingTelegram(true);
    try {
      const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: telegramChatId, text: "🟢 TrendScan AI — Test notification successful!" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.description);
      toast({ title: "Telegram test sent!" });
    } catch (err) {
      toast({ title: "Telegram test failed", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    }
    setTestingTelegram(false);
  };

  const handleExportCSV = async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("scores")
      .select("pair_id, score, trend, timeframe, scanned_at, ema_score, adx_score, rsi_score, macd_score")
      .gte("scanned_at", thirtyDaysAgo)
      .order("scanned_at", { ascending: false });

    if (!data?.length) {
      toast({ title: "No data to export" });
      return;
    }

    const headers = ["pair_id", "score", "trend", "timeframe", "scanned_at", "ema_score", "adx_score", "rsi_score", "macd_score"];
    const csv = [
      headers.join(","),
      ...data.map(row => headers.map(h => (row as any)[h] ?? "").join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trendscan-scores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported" });
  };

  const handleClearHistory = async () => {
    setClearingHistory(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Note: We can only delete scores we have access to via RLS
    const { error } = await supabase.from("scan_history").delete().lt("scanned_at", sevenDaysAgo);
    if (error) {
      toast({ title: "Failed to clear history", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Scan history cleared", description: "Entries older than 7 days have been removed." });
    }
    setClearingHistory(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);
    try {
      // Delete user data
      await Promise.all([
        supabase.from("watchlists").delete().eq("user_id", user.id),
        supabase.from("alert_rules").delete().eq("user_id", user.id),
        supabase.from("user_settings").delete().eq("user_id", user.id),
        supabase.from("scan_history").delete().eq("user_id", user.id),
      ]);
      await supabase.auth.signOut();
      navigate("/");
      toast({ title: "Account data deleted", description: "You have been signed out." });
    } catch (err) {
      toast({ title: "Delete failed", variant: "destructive" });
    }
    setDeletingAccount(false);
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password reset email sent", description: "Check your inbox." });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-display text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your preferences.</p>
          {saved && <span className="text-xs text-primary font-display animate-in fade-in">✓ Saved</span>}
        </div>

        {/* ── SCAN SETTINGS ── */}
        <Section icon={<Timer className="w-4 h-4 text-primary" />} title="Scan Settings">
          <Label>Default Timeframe</Label>
          <div className="flex flex-wrap gap-2">
            {timeframeOptions.map((opt) => (
              <OptionButton
                key={opt.value}
                active={selectedTimeframe === opt.value}
                onClick={() => { setTimeframe(opt.value); saveSetting({ default_timeframe: opt.value }); }}
              >
                {opt.label}
              </OptionButton>
            ))}
          </div>

          <Label className="mt-4">Auto-Scan Interval</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {scanIntervalOptions.map((opt) => (
              <OptionButton
                key={opt.value}
                active={scanInterval === opt.value}
                onClick={() => setScanInterval(opt.value)}
              >
                {opt.label}
              </OptionButton>
            ))}
          </div>

          <Label className="mt-4">Markets to Include</Label>
          <div className="flex flex-col gap-3">
            {(["forex", "futures", "commodity"] as const).map((m) => (
              <div key={m} className="flex items-center justify-between">
                <span className="text-sm text-foreground capitalize font-display">{m}</span>
                <Switch checked={markets[m]} onCheckedChange={(v) => setMarkets(prev => ({ ...prev, [m]: v }))} />
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={handleTestScan} disabled={testingScan}>
            {testingScan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
            Run test scan (5 pairs)
          </Button>
        </Section>

        {/* ── NOTIFICATIONS ── */}
        <Section icon={<Bell className="w-4 h-4 text-primary" />} title="Notifications">
          <div className="space-y-4">
            <ToggleRow
              label="In-app notifications"
              checked={inAppNotifications}
              onChange={setInAppNotifications}
            />
            <ToggleRow
              label="Sound alerts"
              description="Plays a brief chime when an alert fires"
              checked={alertSound}
              onChange={(v) => {
                setAlertSound(v);
                saveSetting({ alert_sound: v });
                if (v) playChime();
              }}
            />
          </div>

          <div className="mt-5 space-y-3">
            <Label>Discord Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://discord.com/api/webhooks/..."
                value={discordWebhook}
                onChange={(e) => setDiscordWebhook(e.target.value)}
                className="text-xs font-body"
              />
              <Button variant="outline" size="sm" onClick={handleTestDiscord} disabled={!discordWebhook || testingDiscord}>
                {testingDiscord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Label>Telegram</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input placeholder="Bot token" value={telegramToken} onChange={(e) => setTelegramToken(e.target.value)} className="text-xs font-body" />
              <Input placeholder="Chat ID" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} className="text-xs font-body" />
            </div>
            <Button variant="outline" size="sm" onClick={handleTestTelegram} disabled={!telegramToken || !telegramChatId || testingTelegram} className="gap-2">
              {testingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Test Telegram
            </Button>
          </div>
        </Section>

        {/* ── APPEARANCE ── */}
        <Section icon={<Palette className="w-4 h-4 text-primary" />} title="Appearance">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-foreground font-display">Dark mode</span>
                <p className="text-xs text-muted-foreground">Always on — light mode coming soon</p>
              </div>
              <Switch checked disabled />
            </div>
            <ToggleRow
              label="Compact view"
              description="Reduces heatmap cell padding for more pairs on screen"
              checked={compactView}
              onChange={setCompactView}
            />
          </div>
        </Section>

        {/* ── DATA & ACCOUNT ── */}
        <Section icon={<Database className="w-4 h-4 text-primary" />} title="Data & Account">
          <div className="space-y-4">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
              <Download className="w-3.5 h-3.5" />
              Export scores as CSV (last 30 days)
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear scan history (&gt;7 days)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear scan history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all scan history entries older than 7 days. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearHistory} disabled={clearingHistory}>
                    {clearingHistory ? "Clearing..." : "Clear history"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="mt-6 pt-4 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-body">{user?.email ?? "—"}</span>
            </div>

            <Button variant="outline" size="sm" className="gap-2" onClick={handleChangePassword}>
              <Shield className="w-3.5 h-3.5" />
              Change password
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your data including watchlists, alerts, scan history, and settings. You will be signed out. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingAccount ? "Deleting..." : "Yes, delete my account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Section>
      </div>
    </AppLayout>
  );
}

// ── Subcomponents ──

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider font-display">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs font-display text-muted-foreground font-medium ${className}`}>{children}</p>;
}

function OptionButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border text-sm font-display font-semibold transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground hover:text-foreground hover:border-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm text-foreground font-display">{label}</span>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAutoScan, scanIntervalOptions } from "@/hooks/useAutoScan";
import { useTimeframe, timeframeOptions } from "@/hooks/useTimeframe";
import { Clock, Volume2, Palette, Timer } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { scanInterval, setScanInterval } = useAutoScan();
  const { selectedTimeframe, setTimeframe } = useTimeframe();
  const [alertSound, setAlertSound] = useState(true);
  const [saved, setSaved] = useState(false);

  // Load settings
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

  const handleAlertSoundChange = async (value: boolean) => {
    setAlertSound(value);
    if (!user) return;
    await supabase.from("user_settings").upsert(
      { user_id: user.id, alert_sound: value },
      { onConflict: "user_id" }
    );
    flashSaved();
  };

  const handleDefaultTimeframeChange = async (tf: string) => {
    setTimeframe(tf);
    if (!user) return;
    await supabase.from("user_settings").upsert(
      { user_id: user.id, default_timeframe: tf },
      { onConflict: "user_id" }
    );
    flashSaved();
  };

  const handleScanIntervalChange = async (interval: string) => {
    await setScanInterval(interval);
    flashSaved();
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-display text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your scanning preferences and notifications.
          </p>
          {saved && (
            <span className="text-xs text-primary font-display">✓ Saved</span>
          )}
        </div>

        {/* Scan Schedule */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider font-display">
              Scan Schedule
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose how often the app automatically scans all pairs. The server also runs an hourly scan via pg_cron.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {scanIntervalOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleScanIntervalChange(opt.value)}
                className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  scanInterval === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Default Timeframe */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider font-display">
              Default Timeframe
            </h2>
          </div>
          <div className="flex gap-2">
            {timeframeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleDefaultTimeframeChange(opt.value)}
                className={`px-4 py-2 rounded-lg border text-sm font-display font-semibold transition-colors ${
                  selectedTimeframe === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Alert Sound */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider font-display">
              Alert Sound
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleAlertSoundChange(!alertSound)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                alertSound ? "bg-primary" : "bg-muted"
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-foreground transition-transform ${
                  alertSound ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-sm text-muted-foreground">
              {alertSound ? "Sound enabled" : "Sound disabled"}
            </span>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

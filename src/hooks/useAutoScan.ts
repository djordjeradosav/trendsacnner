import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ScanIntervalOption {
  value: string;
  label: string;
  ms: number | null; // null = manual
}

export const scanIntervalOptions: ScanIntervalOption[] = [
  { value: "manual", label: "Manual only", ms: null },
  { value: "15min", label: "Every 15 min", ms: 15 * 60 * 1000 },
  { value: "1hour", label: "Every 1 hour", ms: 60 * 60 * 1000 },
  { value: "4hours", label: "Every 4 hours", ms: 4 * 60 * 60 * 1000 },
];

export function useAutoScan(onAutoScan?: () => Promise<void>) {
  const { user } = useAuth();
  const [scanInterval, setScanIntervalState] = useState<string>("manual");
  const [timeUntilNextScan, setTimeUntilNextScan] = useState<number | null>(null);
  const [lastAutoScan, setLastAutoScan] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextScanRef = useRef<number | null>(null);

  // Load settings from DB and subscribe to changes
  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("scan_interval")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setScanIntervalState(data.scan_interval);
      }
    };

    loadSettings();

    // Listen for settings changes (e.g. from Settings page)
    const channel = supabase
      .channel("user-settings-autoscan")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_settings", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newRow = payload.new as { scan_interval?: string };
          if (newRow?.scan_interval) {
            setScanIntervalState(newRow.scan_interval);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const setScanInterval = useCallback(
    async (interval: string) => {
      setScanIntervalState(interval);
      if (!user) return;

      await supabase.from("user_settings").upsert(
        { user_id: user.id, scan_interval: interval },
        { onConflict: "user_id" }
      );
    },
    [user]
  );

  // Set up auto-scan timer
  useEffect(() => {
    // Clear existing timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    timerRef.current = null;
    countdownRef.current = null;
    nextScanRef.current = null;
    setTimeUntilNextScan(null);

    const option = scanIntervalOptions.find((o) => o.value === scanInterval);
    if (!option?.ms || !onAutoScan) return;

    const intervalMs = option.ms;
    nextScanRef.current = Date.now() + intervalMs;

    // Countdown
    countdownRef.current = setInterval(() => {
      if (nextScanRef.current) {
        const remaining = Math.max(0, nextScanRef.current - Date.now());
        setTimeUntilNextScan(remaining);
      }
    }, 1000);

    // Auto-scan
    timerRef.current = setInterval(async () => {
      setLastAutoScan(new Date());
      nextScanRef.current = Date.now() + intervalMs;
      try {
        await onAutoScan();
      } catch (err) {
        console.warn("Auto-scan failed:", err);
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [scanInterval, onAutoScan]);

  const isAutoScanEnabled = scanInterval !== "manual";

  const autoScanAgo = lastAutoScan
    ? Math.round((Date.now() - lastAutoScan.getTime()) / 60000)
    : null;

  return {
    scanInterval,
    setScanInterval,
    timeUntilNextScan,
    isAutoScanEnabled,
    lastAutoScan,
    autoScanAgo,
    scanIntervalOptions,
  };
}

export function formatCountdown(ms: number | null): string {
  if (ms === null || ms <= 0) return "--:--:--";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

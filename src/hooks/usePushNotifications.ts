import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const VAPID_PUBLIC_KEY = ""; // We'll use the Notification API directly (no service worker push for now)

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  // Poll for upcoming high-impact events and fire notifications
  useEffect(() => {
    if (permission !== "granted" || !user) return;

    const notifiedEvents = new Set<string>();

    async function checkUpcomingEvents() {
      const now = new Date();
      const soon = new Date(now.getTime() + 15 * 60 * 1000); // 15 min ahead

      const { data: events } = await supabase
        .from("economic_events")
        .select("id, event_name, currency, impact, scheduled_at")
        .eq("impact", "high")
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", soon.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(5);

      if (!events) return;

      for (const evt of events) {
        if (notifiedEvents.has(evt.id)) continue;
        notifiedEvents.add(evt.id);

        const minutesUntil = Math.round(
          (new Date(evt.scheduled_at).getTime() - Date.now()) / 60000
        );

        new Notification("⚡ High-Impact Event", {
          body: `${evt.currency ?? ""} ${evt.event_name} in ${minutesUntil} min`,
          icon: "/favicon.ico",
          tag: evt.id,
        });
      }
    }

    checkUpcomingEvents();
    const interval = setInterval(checkUpcomingEvents, 60_000); // check every minute
    return () => clearInterval(interval);
  }, [permission, user]);

  return { permission, requestPermission };
}

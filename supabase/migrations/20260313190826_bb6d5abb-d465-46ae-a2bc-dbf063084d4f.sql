ALTER TABLE public.alert_notifications ADD COLUMN IF NOT EXISTS delivery_failed boolean NOT NULL DEFAULT false;

ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_notifications;

-- Add columns to alert_rules for webhook and category filter support
ALTER TABLE public.alert_rules 
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS category_filter text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS last_triggered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS description text;

-- Allow service role to insert notifications (for post-scan check)
CREATE POLICY "Service role can insert notifications" 
  ON public.alert_notifications 
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM alert_rules 
      WHERE alert_rules.id = alert_notifications.rule_id 
      AND alert_rules.user_id = auth.uid()
    )
  );

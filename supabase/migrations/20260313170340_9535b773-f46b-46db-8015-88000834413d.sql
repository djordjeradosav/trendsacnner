
-- Create pairs table
CREATE TABLE public.pairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('forex', 'futures', 'commodity')),
  base_currency TEXT,
  quote_currency TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pairs are viewable by everyone" ON public.pairs FOR SELECT USING (true);

-- Create candles table
CREATE TABLE public.candles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_id UUID NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  timeframe TEXT NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC DEFAULT 0,
  ts TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.candles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Candles are viewable by everyone" ON public.candles FOR SELECT USING (true);
CREATE INDEX idx_candles_pair_timeframe ON public.candles(pair_id, timeframe, ts DESC);

-- Create scores table
CREATE TABLE public.scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_id UUID NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  timeframe TEXT NOT NULL,
  score NUMERIC NOT NULL,
  trend TEXT NOT NULL CHECK (trend IN ('bullish', 'neutral', 'bearish')),
  ema_score NUMERIC,
  adx_score NUMERIC,
  rsi_score NUMERIC,
  macd_score NUMERIC,
  ema20 NUMERIC,
  ema50 NUMERIC,
  ema200 NUMERIC,
  adx NUMERIC,
  rsi NUMERIC,
  macd_hist NUMERIC,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scores are viewable by everyone" ON public.scores FOR SELECT USING (true);
CREATE INDEX idx_scores_pair_timeframe ON public.scores(pair_id, timeframe, scanned_at DESC);

-- Create alert_rules table
CREATE TABLE public.alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair_id UUID REFERENCES public.pairs(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  direction TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own alert rules" ON public.alert_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own alert rules" ON public.alert_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own alert rules" ON public.alert_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own alert rules" ON public.alert_rules FOR DELETE USING (auth.uid() = user_id);

-- Create alert_notifications table
CREATE TABLE public.alert_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  pair_id UUID NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  score_at_trigger NUMERIC NOT NULL,
  trend_at_trigger TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own notifications" ON public.alert_notifications FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.alert_rules WHERE alert_rules.id = alert_notifications.rule_id AND alert_rules.user_id = auth.uid())
);
CREATE POLICY "Users can update their own notifications" ON public.alert_notifications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.alert_rules WHERE alert_rules.id = alert_notifications.rule_id AND alert_rules.user_id = auth.uid())
);

-- Create watchlists table
CREATE TABLE public.watchlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pair_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own watchlists" ON public.watchlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own watchlists" ON public.watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own watchlists" ON public.watchlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own watchlists" ON public.watchlists FOR DELETE USING (auth.uid() = user_id);

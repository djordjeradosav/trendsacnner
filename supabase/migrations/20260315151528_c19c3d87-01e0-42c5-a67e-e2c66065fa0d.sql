
-- Event analyses (AI scenario cache)
CREATE TABLE IF NOT EXISTS public.event_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  currency text,
  analysis jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Event notes (user personal notes)
CREATE TABLE IF NOT EXISTS public.event_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_name text NOT NULL,
  currency text,
  scheduled_at timestamptz,
  content text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_name, currency, scheduled_at)
);

-- User favourites
CREATE TABLE IF NOT EXISTS public.user_favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_name text NOT NULL,
  currency text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_name, currency)
);

-- Add event_metadata to alert_rules
ALTER TABLE public.alert_rules ADD COLUMN IF NOT EXISTS event_metadata jsonb;

-- RLS for event_analyses (public read)
ALTER TABLE public.event_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event analyses are viewable by authenticated users" ON public.event_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage event analyses" ON public.event_analyses FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RLS for event_notes (user owns their rows)
ALTER TABLE public.event_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own event notes" ON public.event_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own event notes" ON public.event_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own event notes" ON public.event_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own event notes" ON public.event_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS for user_favourites (user owns their rows)
ALTER TABLE public.user_favourites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own favourites" ON public.user_favourites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own favourites" ON public.user_favourites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own favourites" ON public.user_favourites FOR DELETE TO authenticated USING (auth.uid() = user_id);

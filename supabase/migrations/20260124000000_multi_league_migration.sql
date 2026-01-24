-- Create leagues table
CREATE TABLE IF NOT EXISTS public.leagues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  league_manager_id UUID REFERENCES auth.users(id),
  manager_count INTEGER NOT NULL DEFAULT 8,
  active_size INTEGER NOT NULL DEFAULT 11,
  bench_size INTEGER NOT NULL DEFAULT 3,
  min_batsmen INTEGER NOT NULL DEFAULT 1,
  max_batsmen INTEGER NOT NULL DEFAULT 6,
  min_bowlers INTEGER NOT NULL DEFAULT 3,
  min_wks INTEGER NOT NULL DEFAULT 1,
  min_all_rounders INTEGER NOT NULL DEFAULT 1,
  max_international INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for leagues
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist before recreating
DROP POLICY IF EXISTS "Users can only view their own leagues" ON public.leagues;
DROP POLICY IF EXISTS "Managers can update their own leagues" ON public.leagues;
DROP POLICY IF EXISTS "Authenticated users can create leagues" ON public.leagues;
DROP POLICY IF EXISTS "Anyone can view leagues" ON public.leagues;

CREATE POLICY "Users can only view their own leagues" ON public.leagues FOR SELECT USING (auth.uid() = league_manager_id);
CREATE POLICY "Managers can update their own leagues" ON public.leagues FOR UPDATE USING (auth.uid() = league_manager_id);
CREATE POLICY "Authenticated users can create leagues" ON public.leagues FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add triggers for updated_at on leagues
DROP TRIGGER IF EXISTS update_leagues_updated_at ON public.leagues;
CREATE TRIGGER update_leagues_updated_at
BEFORE UPDATE ON public.leagues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add user_id to managers
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add league_id to all relevant tables with CASCADE
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_league_id_fkey;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE;

ALTER TABLE public.managers DROP CONSTRAINT IF EXISTS managers_league_id_fkey;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE;

ALTER TABLE public.schedule DROP CONSTRAINT IF EXISTS schedule_league_id_fkey;
ALTER TABLE public.schedule ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_league_id_fkey;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE;

ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_league_id_fkey;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE;

ALTER TABLE public.draft_picks DROP CONSTRAINT IF EXISTS draft_picks_league_id_fkey;
ALTER TABLE public.draft_picks ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE;

ALTER TABLE public.draft_order DROP CONSTRAINT IF EXISTS draft_order_league_id_fkey;
ALTER TABLE public.draft_order ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE;

ALTER TABLE public.draft_state DROP CONSTRAINT IF EXISTS draft_state_league_id_fkey;
ALTER TABLE public.draft_state ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE;


-- Update draft constraints to be per-league
ALTER TABLE public.draft_picks DROP CONSTRAINT IF EXISTS draft_picks_round_pick_position_key;
ALTER TABLE public.draft_picks DROP CONSTRAINT IF EXISTS draft_picks_league_id_round_pick_position_key;
ALTER TABLE public.draft_picks ADD CONSTRAINT draft_picks_league_id_round_pick_position_key UNIQUE (league_id, round, pick_position);

ALTER TABLE public.draft_order DROP CONSTRAINT IF EXISTS draft_order_position_key;
ALTER TABLE public.draft_order DROP CONSTRAINT IF EXISTS draft_order_league_id_position_key;
ALTER TABLE public.draft_order ADD CONSTRAINT draft_order_league_id_position_key UNIQUE (league_id, position);

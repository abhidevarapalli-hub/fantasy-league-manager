-- Create players table (IPL pool)
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create managers table (teams with rosters/wins/losses)
CREATE TABLE public.managers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  team_name TEXT NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  roster UUID[] DEFAULT '{}',
  bench UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create schedule table (7-week matchups)
CREATE TABLE public.schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week INTEGER NOT NULL,
  home_manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE,
  away_manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE,
  home_score INTEGER,
  away_score INTEGER,
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table (activity log)
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('add', 'drop', 'trade', 'score')),
  manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE,
  manager_team_name TEXT,
  description TEXT NOT NULL,
  players JSONB,
  week INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (fantasy league is public)
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Anyone can insert players" ON public.players FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view managers" ON public.managers FOR SELECT USING (true);
CREATE POLICY "Anyone can update managers" ON public.managers FOR UPDATE USING (true);
CREATE POLICY "Anyone can insert managers" ON public.managers FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view schedule" ON public.schedule FOR SELECT USING (true);
CREATE POLICY "Anyone can update schedule" ON public.schedule FOR UPDATE USING (true);
CREATE POLICY "Anyone can insert schedule" ON public.schedule FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.managers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
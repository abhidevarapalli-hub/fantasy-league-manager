-- Revise Leagues RLS to allow public viewing
DROP POLICY IF EXISTS "Users can only view their own leagues" ON public.leagues;
DROP POLICY IF EXISTS "Anyone can view leagues" ON public.leagues;

CREATE POLICY "Anyone can view leagues" ON public.leagues 
FOR SELECT USING (true);

-- Ensure all other tables are also readable
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view players" ON public.players;
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);

ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view managers" ON public.managers;
CREATE POLICY "Anyone can view managers" ON public.managers FOR SELECT USING (true);

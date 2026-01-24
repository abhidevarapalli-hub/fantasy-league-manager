-- Add DELETE policy for leagues
DROP POLICY IF EXISTS "Managers can delete their own leagues" ON public.leagues;
CREATE POLICY "Managers can delete their own leagues" ON public.leagues 
FOR DELETE USING (auth.uid() = league_manager_id);

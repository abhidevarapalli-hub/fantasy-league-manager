-- Fix RLS policy to allow users to view leagues where they are managers
-- OR allow viewing any league details (needed for join flow)
-- The Leagues page will filter to show only user's leagues client-side

DROP POLICY IF EXISTS "Users can only view their own leagues" ON public.leagues;
DROP POLICY IF EXISTS "Authenticated users can view all leagues" ON public.leagues;

-- Allow users to view leagues where they are a manager (via managers table)
-- OR if they are the league owner
CREATE POLICY "Users can view leagues they are part of or own" 
  ON public.leagues 
  FOR SELECT 
  USING (
    auth.uid() = league_manager_id 
    OR 
    EXISTS (
      SELECT 1 FROM public.managers 
      WHERE managers.league_id = leagues.id 
      AND managers.user_id = auth.uid()
    )
    OR
    auth.role() = 'authenticated' -- Allow all authenticated users (needed for join flow)
  );

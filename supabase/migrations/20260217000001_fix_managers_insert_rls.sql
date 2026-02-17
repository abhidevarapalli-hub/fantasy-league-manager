-- Fix: Allow league managers to insert placeholder manager records
--
-- The policy from 20260216100000 restricts managers INSERT to auth.uid() = user_id,
-- which breaks league creation because CreateLeague inserts placeholder managers
-- with user_id = null. The league creator (who is the league_manager) needs to be
-- able to insert these placeholder rows.

DROP POLICY IF EXISTS "Users can insert their own manager record" ON public.managers;

CREATE POLICY "Users or league manager can insert managers"
  ON public.managers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can insert their own manager record
    auth.uid() = user_id
    OR
    -- League manager can insert placeholder managers (user_id is null or different)
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = managers.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

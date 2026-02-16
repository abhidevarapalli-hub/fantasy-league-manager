-- Fix JoinLeague flow after managers RLS hardening.
--
-- The JoinLeague page claims a placeholder manager row by updating:
--   user_id, name, team_name
-- on rows where user_id IS NULL.
--
-- After 20260216100000_fix_rls_policies.sql, UPDATE on managers is limited to:
--   - row owner (auth.uid() = user_id), or
--   - league manager
-- which blocks first-time claims of placeholder rows.

DROP POLICY IF EXISTS "Users can claim open manager slot" ON public.managers;

CREATE POLICY "Users can claim open manager slot"
  ON public.managers
  FOR UPDATE
  TO authenticated
  USING (
    -- Can only target unclaimed placeholder rows
    user_id IS NULL
    -- And cannot claim a second slot in the same league
    AND NOT EXISTS (
      SELECT 1
      FROM public.managers m
      WHERE m.league_id = managers.league_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Claimed row must belong to the authenticated user
    user_id = auth.uid()
    -- Claiming a slot must not create a duplicate membership in same league
    AND NOT EXISTS (
      SELECT 1
      FROM public.managers m
      WHERE m.league_id = managers.league_id
        AND m.user_id = auth.uid()
        AND m.id <> managers.id
    )
    -- Joining user should not self-promote to league manager
    AND COALESCE(is_league_manager, false) = false
  );

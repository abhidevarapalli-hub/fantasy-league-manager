-- Security: Enforce ownership checks on roster and score operations
--
-- Problems addressed:
--   1. manager_roster SELECT uses USING(true), allowing any authenticated user to see
--      every roster in every league. Should be scoped to league members only.
--   2. league_schedules UPDATE via the FOR ALL policy is already restricted to league
--      managers. Verified: no changes needed.
--   3. transactions INSERT uses WITH CHECK(auth.role() = 'authenticated'), allowing
--      any authenticated user to insert transactions into any league. Should require
--      league membership.

-- ============================================================================
-- 1. MANAGER_ROSTER TABLE - Restrict SELECT to league members
-- ============================================================================

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view rosters" ON public.manager_roster;

-- New SELECT: Only authenticated users who are members of the same league
-- can view rosters. This ensures users in League A cannot see rosters from League B.
CREATE POLICY "League members can view rosters"
  ON public.manager_roster
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managers AS roster_manager
      WHERE roster_manager.id = manager_roster.manager_id
        AND roster_manager.league_id IN (
          SELECT m.league_id FROM public.managers m WHERE m.user_id = auth.uid()
        )
    )
  );


-- ============================================================================
-- 2. LEAGUE_SCHEDULES TABLE - Verify UPDATE restriction
-- ============================================================================

-- The existing "League managers can manage schedules" policy from
-- 20260214000000_create_missing_tables.sql already uses:
--   FOR ALL TO authenticated
--   USING (EXISTS (SELECT 1 FROM leagues WHERE leagues.id = league_schedules.league_id
--          AND leagues.league_manager_id = auth.uid()))
--
-- This correctly restricts INSERT/UPDATE/DELETE to the league manager only.
-- The separate SELECT policy allows all authenticated users to read schedules.
--
-- No changes needed for league_schedules.


-- ============================================================================
-- 3. TRANSACTIONS TABLE - Restrict INSERT to league members
-- ============================================================================

-- Drop all overly permissive INSERT policies
DROP POLICY IF EXISTS "Anyone can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow authenticated users to insert transactions" ON public.transactions;

-- New INSERT: Only allow if the authenticated user is a member of the league
-- referenced in the transaction (via the managers table), or is the league manager.
-- This prevents users from inserting fake transaction records into leagues they
-- don't belong to.
CREATE POLICY "League members can insert transactions"
  ON public.transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User is a manager in the referenced league
    EXISTS (
      SELECT 1 FROM public.managers m
      WHERE m.league_id = transactions.league_id
        AND m.user_id = auth.uid()
    )
    OR
    -- User is the league manager (admin)
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = transactions.league_id
        AND l.league_manager_id = auth.uid()
    )
  );

-- NOTE: Existing SELECT policies on transactions are kept as-is.
-- "Allow public read access on transactions" / "Anyone can view transactions"
-- provide audit trail visibility. This is acceptable since transaction records
-- are non-sensitive activity logs.


-- ============================================================================
-- 4. TRANSACTIONS TABLE - Restrict DELETE to league manager
-- ============================================================================

-- Currently there is no DELETE policy on transactions, but the resetLeague
-- action in useGameStore.ts calls .delete().eq("league_id", ...). Without a
-- policy, this will silently fail for non-service-role users. Add one scoped
-- to the league manager only.
DROP POLICY IF EXISTS "League manager can delete transactions" ON public.transactions;

CREATE POLICY "League manager can delete transactions"
  ON public.transactions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = transactions.league_id
        AND l.league_manager_id = auth.uid()
    )
  );

-- Security: Fix overly permissive RLS policies on core tables
--
-- Problem: Many tables use USING(true) / WITH CHECK(true) policies, meaning any
-- authenticated user has full CRUD access to all rows regardless of ownership.
--
-- Solution: Replace blanket-open policies with proper ownership and role checks:
--   - managers: users can only modify their own row; league managers can modify league members
--   - draft tables: read by league members, write by league manager (or current drafter)
--   - trades: scoped to proposer, target, or league manager
--   - cricket_matches & player_match_stats: write restricted to service_role
--   - historical_records & head_to_head: write restricted to league manager
--   - extended player tables (master_players): write restricted to service_role
--   - schedule (legacy): write restricted to league manager

-- ============================================================================
-- MANAGERS TABLE
-- ============================================================================

-- Keep SELECT as-is (viewing managers in a league is fine for all authenticated users)

-- Drop overly permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can insert managers" ON public.managers;

-- Drop overly permissive UPDATE policies
DROP POLICY IF EXISTS "Anyone can update managers" ON public.managers;
DROP POLICY IF EXISTS "Allow authenticated users to update managers" ON public.managers;

-- INSERT: Users can only create manager records for themselves
CREATE POLICY "Users can insert their own manager record"
  ON public.managers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own record, OR the league manager can update any member
CREATE POLICY "Users or league manager can update managers"
  ON public.managers
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = managers.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = managers.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

-- DELETE: Only league manager can remove a manager from the league
DROP POLICY IF EXISTS "League manager can delete managers" ON public.managers;
CREATE POLICY "League manager can delete managers"
  ON public.managers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = managers.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );


-- ============================================================================
-- DRAFT_PICKS TABLE
-- ============================================================================

-- Drop all existing permissive policies
DROP POLICY IF EXISTS "Anyone can view draft picks" ON public.draft_picks;
DROP POLICY IF EXISTS "Anyone can insert draft picks" ON public.draft_picks;
DROP POLICY IF EXISTS "Anyone can update draft picks" ON public.draft_picks;
DROP POLICY IF EXISTS "Anyone can delete draft picks" ON public.draft_picks;

-- SELECT: Authenticated users in the same league
CREATE POLICY "League members can view draft picks"
  ON public.draft_picks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managers
      WHERE managers.league_id = draft_picks.league_id
        AND managers.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_picks.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

-- INSERT: Only the manager whose turn it is, OR the league manager (for auto-draft)
CREATE POLICY "Current drafter or league manager can insert draft picks"
  ON public.draft_picks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- League manager can always insert (for auto-draft, corrections)
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_picks.league_id
        AND leagues.league_manager_id = auth.uid()
    )
    OR
    -- The manager making the pick must be the authenticated user
    EXISTS (
      SELECT 1 FROM public.managers
      WHERE managers.id = draft_picks.manager_id
        AND managers.user_id = auth.uid()
        AND managers.league_id = draft_picks.league_id
    )
  );

-- UPDATE: Only league manager
CREATE POLICY "League manager can update draft picks"
  ON public.draft_picks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_picks.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_picks.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

-- DELETE: Only league manager
CREATE POLICY "League manager can delete draft picks"
  ON public.draft_picks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_picks.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );


-- ============================================================================
-- DRAFT_ORDER TABLE
-- ============================================================================

-- Drop all existing permissive policies
DROP POLICY IF EXISTS "Anyone can view draft order" ON public.draft_order;
DROP POLICY IF EXISTS "Anyone can insert draft order" ON public.draft_order;
DROP POLICY IF EXISTS "Anyone can update draft order" ON public.draft_order;
DROP POLICY IF EXISTS "Anyone can delete draft order" ON public.draft_order;

-- SELECT: Authenticated users in the same league
CREATE POLICY "League members can view draft order"
  ON public.draft_order
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managers
      WHERE managers.league_id = draft_order.league_id
        AND managers.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_order.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

-- INSERT: Only league manager
CREATE POLICY "League manager can insert draft order"
  ON public.draft_order
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_order.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

-- UPDATE: Only league manager
CREATE POLICY "League manager can update draft order"
  ON public.draft_order
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_order.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_order.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

-- DELETE: Only league manager
CREATE POLICY "League manager can delete draft order"
  ON public.draft_order
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_order.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );


-- ============================================================================
-- DRAFT_STATE TABLE
-- ============================================================================

-- Drop all existing permissive policies
DROP POLICY IF EXISTS "Anyone can view draft state" ON public.draft_state;
DROP POLICY IF EXISTS "Anyone can insert draft state" ON public.draft_state;
DROP POLICY IF EXISTS "Anyone can update draft state" ON public.draft_state;

-- SELECT: Authenticated users in the same league
CREATE POLICY "League members can view draft state"
  ON public.draft_state
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managers
      WHERE managers.league_id = draft_state.league_id
        AND managers.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_state.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

-- INSERT: Only league manager
CREATE POLICY "League manager can insert draft state"
  ON public.draft_state
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_state.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

-- UPDATE: Only league manager
CREATE POLICY "League manager can update draft state"
  ON public.draft_state
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_state.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_state.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );


-- ============================================================================
-- TRADES TABLE
-- ============================================================================

-- Drop all existing permissive policies
DROP POLICY IF EXISTS "Anyone can view trades" ON public.trades;
DROP POLICY IF EXISTS "Anyone can insert trades" ON public.trades;
DROP POLICY IF EXISTS "Anyone can update trades" ON public.trades;
DROP POLICY IF EXISTS "Anyone can delete trades" ON public.trades;

-- SELECT: Authenticated league members can view trades
CREATE POLICY "League members can view trades"
  ON public.trades
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managers
      WHERE managers.league_id = trades.league_id
        AND managers.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = trades.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

-- INSERT: Only the proposing manager (auth.uid() must match the proposer's user_id)
CREATE POLICY "Proposer can insert trades"
  ON public.trades
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.managers
      WHERE managers.id = trades.proposer_id
        AND managers.user_id = auth.uid()
        AND managers.league_id = trades.league_id
    )
  );

-- UPDATE: Only the proposer, target manager (for accept/reject), or league manager
CREATE POLICY "Trade participants or league manager can update trades"
  ON public.trades
  FOR UPDATE
  TO authenticated
  USING (
    -- Proposer
    EXISTS (
      SELECT 1 FROM public.managers
      WHERE managers.id = trades.proposer_id
        AND managers.user_id = auth.uid()
    )
    OR
    -- Target manager
    EXISTS (
      SELECT 1 FROM public.managers
      WHERE managers.id = trades.target_id
        AND managers.user_id = auth.uid()
    )
    OR
    -- League manager
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = trades.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.managers
      WHERE managers.id = trades.proposer_id
        AND managers.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.managers
      WHERE managers.id = trades.target_id
        AND managers.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = trades.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

-- DELETE: Only the proposer or league manager
CREATE POLICY "Proposer or league manager can delete trades"
  ON public.trades
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managers
      WHERE managers.id = trades.proposer_id
        AND managers.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = trades.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );


-- ============================================================================
-- SCHEDULE TABLE (legacy - may still exist)
-- ============================================================================

-- Drop permissive policies and create new ones (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schedule') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can update schedule" ON public.schedule';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated users to update schedule" ON public.schedule';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can insert schedule" ON public.schedule';
    EXECUTE 'CREATE POLICY "League manager can update schedule" ON public.schedule FOR UPDATE TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.leagues
        WHERE leagues.id = schedule.league_id
          AND leagues.league_manager_id = auth.uid()
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.leagues
        WHERE leagues.id = schedule.league_id
          AND leagues.league_manager_id = auth.uid()
      )
    )';

    EXECUTE 'CREATE POLICY "League manager can insert schedule" ON public.schedule FOR INSERT TO authenticated WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.leagues
        WHERE leagues.id = schedule.league_id
          AND leagues.league_manager_id = auth.uid()
      )
    )';
  END IF;
END $$;


-- ============================================================================
-- CRICKET_MATCHES TABLE
-- ============================================================================

-- Drop permissive INSERT/UPDATE policies
DROP POLICY IF EXISTS "cricket_matches_insert_policy" ON public.cricket_matches;
DROP POLICY IF EXISTS "cricket_matches_update_policy" ON public.cricket_matches;

-- INSERT: Only service_role (data synced from external APIs)
CREATE POLICY "Only service role can insert cricket matches"
  ON public.cricket_matches
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- UPDATE: Only service_role
CREATE POLICY "Only service role can update cricket matches"
  ON public.cricket_matches
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- PLAYER_MATCH_STATS TABLE (may not exist in production)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'player_match_stats') THEN
    EXECUTE 'DROP POLICY IF EXISTS "player_match_stats_insert_policy" ON public.player_match_stats';
    EXECUTE 'DROP POLICY IF EXISTS "player_match_stats_update_policy" ON public.player_match_stats';

    EXECUTE 'CREATE POLICY "Only service role can insert player match stats"
      ON public.player_match_stats FOR INSERT TO service_role WITH CHECK (true)';

    EXECUTE 'CREATE POLICY "Only service role can update player match stats"
      ON public.player_match_stats FOR UPDATE TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;


-- ============================================================================
-- HISTORICAL_RECORDS TABLE (may not exist in production)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'historical_records') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can insert historical records" ON public.historical_records';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can update historical records" ON public.historical_records';

    EXECUTE 'CREATE POLICY "League manager can insert historical records"
      ON public.historical_records FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.leagues WHERE leagues.league_manager_id = auth.uid()))';

    EXECUTE 'CREATE POLICY "League manager can update historical records"
      ON public.historical_records FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.leagues WHERE leagues.league_manager_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.leagues WHERE leagues.league_manager_id = auth.uid()))';
  END IF;
END $$;


-- ============================================================================
-- HEAD_TO_HEAD TABLE (may not exist in production)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'head_to_head') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can insert head to head" ON public.head_to_head';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can update head to head" ON public.head_to_head';

    EXECUTE 'CREATE POLICY "League manager can insert head to head"
      ON public.head_to_head FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.leagues WHERE leagues.league_manager_id = auth.uid()))';

    EXECUTE 'CREATE POLICY "League manager can update head to head"
      ON public.head_to_head FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.leagues WHERE leagues.league_manager_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.leagues WHERE leagues.league_manager_id = auth.uid()))';
  END IF;
END $$;


-- ============================================================================
-- MASTER_PLAYERS TABLE (extended player data, from player_deduplication migration)
-- ============================================================================

-- Drop permissive INSERT/UPDATE policies
DROP POLICY IF EXISTS "Master players can be inserted by authenticated users" ON public.master_players;
DROP POLICY IF EXISTS "Master players can be updated by authenticated users" ON public.master_players;

-- INSERT: Only service_role (data synced from external APIs)
CREATE POLICY "Only service role can insert master players"
  ON public.master_players
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- UPDATE: Only service_role
CREATE POLICY "Only service role can update master players"
  ON public.master_players
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- TRADE_PLAYERS TABLE (may not exist in all environments)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trade_players') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can insert trade players" ON public.trade_players';

    EXECUTE 'CREATE POLICY "Trade proposer can insert trade players"
      ON public.trade_players
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.trades t
          JOIN public.managers m ON m.id = t.proposer_id
          WHERE t.id = trade_players.trade_id
            AND m.user_id = auth.uid()
        )
      )';
  END IF;
END $$;

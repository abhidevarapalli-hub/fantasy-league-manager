-- Platform Admin v2
-- Adds platform admin role on top of prod's current schema.
-- This single migration replaces the 3 deleted local migrations
-- (20260217000000, 20260217000001, 20260217000002) which conflicted with prod.
--
-- What this migration does:
--   a) Adds is_platform_admin column to profiles
--   b) Creates helper functions (is_platform_admin, is_league_manager_of)
--   c) Tightens RLS policies on stats/match tables
--   d) Fixes managers INSERT for league creation flow
--   e) Opens master_players to authenticated users
--   f) Updates handle_new_user() with admin auto-grant
--   g) Creates all_cricket_matches view for admin UI

-- ============================================
-- a) Add is_platform_admin column to profiles
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_platform_admin
  IS 'Whether the user has platform-wide admin privileges (can import global match stats)';

-- ============================================
-- b) Helper functions
-- ============================================

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_league_manager_of(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.managers
    WHERE user_id = auth.uid()
      AND league_id = p_league_id
      AND is_league_manager = true
  );
$$;

-- ============================================
-- c) Tighten RLS policies
-- ============================================

-- ----- match_player_stats -----
-- Drop prod's permissive policies (names vary between local and prod)
DROP POLICY IF EXISTS "Authenticated users can insert match stats" ON match_player_stats;
DROP POLICY IF EXISTS "Authenticated users can update match stats" ON match_player_stats;
DROP POLICY IF EXISTS "match_player_stats_insert" ON match_player_stats;
DROP POLICY IF EXISTS "match_player_stats_update" ON match_player_stats;
-- Also drop the old local platform admin policies in case they exist
DROP POLICY IF EXISTS "Platform admins can insert match stats" ON match_player_stats;
DROP POLICY IF EXISTS "Platform admins can update match stats" ON match_player_stats;

-- SELECT: keep existing (match_player_stats_select or similar)
-- INSERT: platform admin only
CREATE POLICY "Platform admins can insert match stats"
  ON match_player_stats FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

-- UPDATE: platform admin only
CREATE POLICY "Platform admins can update match stats"
  ON match_player_stats FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Ensure grants exist
GRANT INSERT, UPDATE ON match_player_stats TO authenticated;

-- ----- league_player_match_scores -----
DROP POLICY IF EXISTS "Authenticated users can insert league scores" ON league_player_match_scores;
DROP POLICY IF EXISTS "Authenticated users can update league scores" ON league_player_match_scores;
DROP POLICY IF EXISTS "league_player_match_scores_insert" ON league_player_match_scores;
DROP POLICY IF EXISTS "league_player_match_scores_update" ON league_player_match_scores;
DROP POLICY IF EXISTS "Admins and league managers can insert league scores" ON league_player_match_scores;
DROP POLICY IF EXISTS "Admins and league managers can update league scores" ON league_player_match_scores;

-- INSERT: platform admin OR league manager
CREATE POLICY "Admins and league managers can insert league scores"
  ON league_player_match_scores FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR public.is_league_manager_of(league_id)
  );

-- UPDATE: platform admin OR league manager
CREATE POLICY "Admins and league managers can update league scores"
  ON league_player_match_scores FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin()
    OR public.is_league_manager_of(league_id)
  )
  WITH CHECK (
    public.is_platform_admin()
    OR public.is_league_manager_of(league_id)
  );

GRANT INSERT, UPDATE ON league_player_match_scores TO authenticated;

-- ----- league_matches -----
DROP POLICY IF EXISTS "Authenticated users can insert league matches" ON league_matches;
DROP POLICY IF EXISTS "Authenticated users can update league matches" ON league_matches;
DROP POLICY IF EXISTS "league_matches_insert" ON league_matches;
DROP POLICY IF EXISTS "league_matches_update" ON league_matches;
DROP POLICY IF EXISTS "Managers and admins can insert league matches" ON league_matches;
DROP POLICY IF EXISTS "Managers and admins can update league matches" ON league_matches;

-- SELECT: ensure it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'league_matches'
      AND policyname = 'Authenticated users can read league matches'
  ) THEN
    CREATE POLICY "Authenticated users can read league matches"
      ON league_matches FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- INSERT: league managers and platform admins
CREATE POLICY "Managers and admins can insert league matches"
  ON league_matches FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR public.is_league_manager_of(league_id)
  );

-- UPDATE: league managers and platform admins
CREATE POLICY "Managers and admins can update league matches"
  ON league_matches FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin()
    OR public.is_league_manager_of(league_id)
  )
  WITH CHECK (
    public.is_platform_admin()
    OR public.is_league_manager_of(league_id)
  );

GRANT SELECT, INSERT, UPDATE ON league_matches TO authenticated;

-- ----- cricket_matches -----
ALTER TABLE cricket_matches ENABLE ROW LEVEL SECURITY;

-- Drop service_role-only policies from 20260216100000
DROP POLICY IF EXISTS "Only service role can insert cricket matches" ON cricket_matches;
DROP POLICY IF EXISTS "Only service role can update cricket matches" ON cricket_matches;
-- Drop any old platform admin policies
DROP POLICY IF EXISTS "Platform admins can insert cricket matches" ON cricket_matches;
DROP POLICY IF EXISTS "Platform admins can update cricket matches" ON cricket_matches;

-- Platform admins can insert cricket matches
CREATE POLICY "Platform admins can insert cricket matches"
  ON cricket_matches FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

-- Platform admins can update cricket matches
CREATE POLICY "Platform admins can update cricket matches"
  ON cricket_matches FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- All authenticated users can read cricket matches (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cricket_matches'
      AND policyname = 'Authenticated users can read cricket matches'
  ) THEN
    CREATE POLICY "Authenticated users can read cricket matches"
      ON cricket_matches FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- ----- live_match_polling -----
ALTER TABLE live_match_polling ENABLE ROW LEVEL SECURITY;

-- Drop prod's permissive policies
DROP POLICY IF EXISTS "Users can insert polling status" ON live_match_polling;
DROP POLICY IF EXISTS "Users can update polling status" ON live_match_polling;
DROP POLICY IF EXISTS "Users can insert/update polling status" ON live_match_polling;
-- Drop any old platform admin policies
DROP POLICY IF EXISTS "Platform admins can insert polling records" ON live_match_polling;
DROP POLICY IF EXISTS "Platform admins can update polling records" ON live_match_polling;

-- Platform admins can insert polling records
CREATE POLICY "Platform admins can insert polling records"
  ON live_match_polling FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

-- Platform admins can update polling records
CREATE POLICY "Platform admins can update polling records"
  ON live_match_polling FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- All authenticated users can read polling records (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_match_polling'
      AND policyname = 'Authenticated users can read polling records'
  ) THEN
    CREATE POLICY "Authenticated users can read polling records"
      ON live_match_polling FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================
-- d) Fix managers INSERT for league creation
-- ============================================

-- Drop the restrictive self-insert-only policy
DROP POLICY IF EXISTS "Users can insert their own manager record" ON public.managers;
-- Drop the old fix policy if it exists from a previous migration
DROP POLICY IF EXISTS "Users or league manager can insert managers" ON public.managers;
-- Drop prod's permissive policy
DROP POLICY IF EXISTS "managers_insert_policy" ON public.managers;

-- Allow self-insert OR league-manager insert (for placeholder managers during league creation)
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

-- ============================================
-- e) Open master_players to authenticated
-- ============================================

-- Drop service_role-only policies
DROP POLICY IF EXISTS "Only service role can insert master players" ON public.master_players;
DROP POLICY IF EXISTS "Only service role can update master players" ON public.master_players;
-- Drop any old authenticated policies
DROP POLICY IF EXISTS "Authenticated users can insert master players" ON public.master_players;
DROP POLICY IF EXISTS "Authenticated users can update master players" ON public.master_players;

-- Authenticated users can insert master players (needed for league creation flow)
CREATE POLICY "Authenticated users can insert master players"
  ON public.master_players
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update master players
CREATE POLICY "Authenticated users can update master players"
  ON public.master_players
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- f) Update handle_new_user() with admin auto-grant
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');

  -- Auto-grant platform admin for designated admin emails
  IF new.email IN ('10krishnadonepudi@gmail.com', 'abhi.devarapalli@gmail.com', 'abhidev@gmail.com') THEN
    UPDATE public.profiles SET is_platform_admin = true WHERE id = new.id;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- g) Create all_cricket_matches view for admin UI
-- ============================================

CREATE OR REPLACE VIEW public.all_cricket_matches AS
SELECT
  cm.id,
  cm.cricbuzz_match_id,
  cm.series_id,
  cm.match_description,
  cm.team1_name,
  cm.team2_name,
  cm.match_date,
  cm.venue,
  cm.result,
  cm.state,
  cm.created_at,
  lmp.match_state,
  lmp.polling_enabled,
  lmp.auto_enabled,
  lmp.last_polled_at,
  lmp.poll_count,
  lmp.error_count,
  (SELECT COUNT(*) FROM league_matches lm WHERE lm.match_id = cm.id) AS linked_league_count,
  EXISTS (
    SELECT 1 FROM match_player_stats mps WHERE mps.match_id = cm.id
  ) AS has_raw_stats
FROM cricket_matches cm
LEFT JOIN live_match_polling lmp ON lmp.cricbuzz_match_id = cm.cricbuzz_match_id;

-- Grant access to authenticated users (read-only view)
GRANT SELECT ON public.all_cricket_matches TO authenticated;

-- ============================================
-- h) Grant existing admin users the flag (for prod)
-- ============================================

UPDATE public.profiles
SET is_platform_admin = true
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN ('10krishnadonepudi@gmail.com', 'abhi.devarapalli@gmail.com', 'abhidev@gmail.com')
);

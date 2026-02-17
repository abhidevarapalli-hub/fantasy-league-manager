-- Platform Admin Role
-- Adds is_platform_admin flag to profiles and tightens RLS policies so that
-- only platform admins can write global stats, while league managers retain
-- write access to league-specific score tables.

-- ============================================
-- 1. Add is_platform_admin column to profiles
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_platform_admin
  IS 'Whether the user has platform-wide admin privileges (can import global match stats)';

-- ============================================
-- 2. Helper: check if current user is a platform admin
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

-- ============================================
-- 3. Helper: check if current user is a league manager for a given league
-- ============================================
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
-- 4. Tighten RLS on match_player_stats (global stats — platform admin only)
-- ============================================
-- Drop overly permissive policies from migration 20260216000003
DROP POLICY IF EXISTS "Authenticated users can insert match stats" ON match_player_stats;
DROP POLICY IF EXISTS "Authenticated users can update match stats" ON match_player_stats;

-- Platform admins can insert global match stats
CREATE POLICY "Platform admins can insert match stats"
  ON match_player_stats FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

-- Platform admins can update global match stats
CREATE POLICY "Platform admins can update match stats"
  ON match_player_stats FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ============================================
-- 5. Tighten RLS on league_player_match_scores (league managers + platform admins)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can insert league scores" ON league_player_match_scores;
DROP POLICY IF EXISTS "Authenticated users can update league scores" ON league_player_match_scores;

-- Platform admins or league managers can insert league scores
CREATE POLICY "Admins and league managers can insert league scores"
  ON league_player_match_scores FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR public.is_league_manager_of(league_id)
  );

-- Platform admins or league managers can update league scores
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

-- ============================================
-- 6. Tighten RLS on league_matches
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read league matches" ON league_matches;
DROP POLICY IF EXISTS "Authenticated users can insert league matches" ON league_matches;
DROP POLICY IF EXISTS "Authenticated users can update league matches" ON league_matches;

-- All authenticated users can read league_matches (needed for dashboard views)
CREATE POLICY "Authenticated users can read league matches"
  ON league_matches FOR SELECT TO authenticated
  USING (true);

-- League managers and platform admins can insert league matches
CREATE POLICY "Managers and admins can insert league matches"
  ON league_matches FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR public.is_league_manager_of(league_id)
  );

-- League managers and platform admins can update league matches
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

-- ============================================
-- 7. Add platform admin write policies on cricket_matches
-- ============================================
-- Ensure RLS is enabled
ALTER TABLE cricket_matches ENABLE ROW LEVEL SECURITY;

-- Platform admins can insert cricket matches
CREATE POLICY "Platform admins can insert cricket matches"
  ON cricket_matches FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

-- Platform admins can update cricket matches
CREATE POLICY "Platform admins can update cricket matches"
  ON cricket_matches FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- All authenticated users can read cricket matches
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

-- ============================================
-- 8. Add platform admin write policies on live_match_polling
-- ============================================
ALTER TABLE live_match_polling ENABLE ROW LEVEL SECURITY;

-- Platform admins can insert polling records
CREATE POLICY "Platform admins can insert polling records"
  ON live_match_polling FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

-- Platform admins can update polling records
CREATE POLICY "Platform admins can update polling records"
  ON live_match_polling FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- All authenticated users can read polling records
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
-- 9. Create all_cricket_matches view for platform admin UI
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

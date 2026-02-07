-- Migration: Refactor cricket_matches to separate shared match data from league-specific data
-- Description: Creates league_matches junction table to eliminate duplication
--
-- Problem: cricket_matches currently duplicates match data per league (same cricbuzz_match_id
-- appears multiple times with different league_id values)
--
-- Solution:
-- 1. Create league_matches junction table for league-specific data (week, stats_imported)
-- 2. Deduplicate cricket_matches to one row per cricbuzz_match_id
-- 3. Update references and functions

-- ============================================
-- Step 1: Create league_matches junction table
-- ============================================
CREATE TABLE IF NOT EXISTS league_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES cricket_matches(id) ON DELETE CASCADE,
  week INTEGER,
  stats_imported BOOLEAN DEFAULT false,
  stats_imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, match_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_league_matches_league_id ON league_matches(league_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_match_id ON league_matches(match_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_stats ON league_matches(stats_imported) WHERE stats_imported = false;

-- Enable RLS
ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can see league_matches for leagues they belong to
CREATE POLICY "Users can view league matches for their leagues"
  ON league_matches
  FOR SELECT
  TO authenticated
  USING (
    league_id IN (
      SELECT league_id FROM managers WHERE user_id = auth.uid()
    )
  );

-- League managers can insert/update league_matches
CREATE POLICY "League managers can manage league matches"
  ON league_matches
  FOR ALL
  TO authenticated
  USING (
    league_id IN (
      SELECT id FROM leagues WHERE league_manager_id = auth.uid()
    )
  )
  WITH CHECK (
    league_id IN (
      SELECT id FROM leagues WHERE league_manager_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT ON league_matches TO authenticated;
GRANT ALL ON league_matches TO service_role;

-- ============================================
-- Step 2: Migrate existing data to league_matches
-- This preserves all league-specific data before deduplication
-- ============================================
INSERT INTO league_matches (league_id, match_id, week, stats_imported, stats_imported_at)
SELECT
  league_id,
  id as match_id,
  week,
  stats_imported,
  stats_imported_at
FROM cricket_matches
WHERE league_id IS NOT NULL
ON CONFLICT (league_id, match_id) DO NOTHING;

-- ============================================
-- Step 3: Deduplicate cricket_matches
-- Keep one row per cricbuzz_match_id, preferring the one with most data
-- ============================================

-- First, create a temp table to track which match IDs survive deduplication
CREATE TEMP TABLE surviving_matches AS
SELECT DISTINCT ON (cricbuzz_match_id)
  id as surviving_id,
  cricbuzz_match_id
FROM cricket_matches
WHERE cricbuzz_match_id IS NOT NULL
ORDER BY cricbuzz_match_id,
  -- Prefer matches with more complete data
  (CASE WHEN result IS NOT NULL THEN 1 ELSE 0 END) DESC,
  (CASE WHEN man_of_match_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
  (CASE WHEN team1_name IS NOT NULL THEN 1 ELSE 0 END) DESC,
  created_at ASC;

-- Create mapping from old IDs to surviving IDs
CREATE TEMP TABLE match_id_mapping AS
SELECT
  cm.id as old_id,
  sm.surviving_id as new_id
FROM cricket_matches cm
JOIN surviving_matches sm ON cm.cricbuzz_match_id = sm.cricbuzz_match_id
WHERE cm.id != sm.surviving_id;

-- Update player_match_stats to point to surviving match IDs
UPDATE player_match_stats pms
SET match_id = mim.new_id
FROM match_id_mapping mim
WHERE pms.match_id = mim.old_id;

-- Update league_matches to point to surviving match IDs
UPDATE league_matches lm
SET match_id = mim.new_id
FROM match_id_mapping mim
WHERE lm.match_id = mim.old_id;

-- Now delete duplicate cricket_matches rows (ones not in surviving_matches)
DELETE FROM cricket_matches cm
WHERE EXISTS (
  SELECT 1 FROM match_id_mapping mim WHERE mim.old_id = cm.id
);

-- Clean up temp tables
DROP TABLE IF EXISTS surviving_matches;
DROP TABLE IF EXISTS match_id_mapping;

-- ============================================
-- Step 4: Update cricket_matches schema
-- Remove league-specific columns, add unique constraint on cricbuzz_match_id
-- ============================================

-- Drop the old league_id foreign key constraint first
ALTER TABLE cricket_matches DROP CONSTRAINT IF EXISTS cricket_matches_league_id_fkey;

-- Remove league-specific columns from cricket_matches
ALTER TABLE cricket_matches
  DROP COLUMN IF EXISTS league_id,
  DROP COLUMN IF EXISTS week,
  DROP COLUMN IF EXISTS stats_imported,
  DROP COLUMN IF EXISTS stats_imported_at;

-- Add unique constraint on cricbuzz_match_id (if not already unique)
-- The table already has a unique constraint from the original schema
-- Just ensure it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cricket_matches_cricbuzz_match_id_key'
  ) THEN
    ALTER TABLE cricket_matches
      ADD CONSTRAINT cricket_matches_cricbuzz_match_id_key UNIQUE (cricbuzz_match_id);
  END IF;
END $$;

-- ============================================
-- Step 5: Add match_id to live_match_polling
-- Links polling status to the deduplicated cricket_matches
-- ============================================
ALTER TABLE live_match_polling
  ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES cricket_matches(id);

-- Populate match_id from cricbuzz_match_id
UPDATE live_match_polling lmp
SET match_id = cm.id
FROM cricket_matches cm
WHERE cm.cricbuzz_match_id = lmp.cricbuzz_match_id
  AND lmp.match_id IS NULL;

-- Index for match_id lookups
CREATE INDEX IF NOT EXISTS idx_live_match_polling_match_id ON live_match_polling(match_id);

-- ============================================
-- Step 6: Update get_leagues_for_cricbuzz_match function
-- Now queries through league_matches junction table
-- ============================================
CREATE OR REPLACE FUNCTION get_leagues_for_cricbuzz_match(
  p_cricbuzz_match_id INTEGER
)
RETURNS TABLE (
  league_id UUID,
  match_id UUID,
  scoring_rules JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lm.league_id,
    cm.id as match_id,
    l.scoring_rules
  FROM cricket_matches cm
  JOIN league_matches lm ON lm.match_id = cm.id
  JOIN leagues l ON l.id = lm.league_id
  WHERE cm.cricbuzz_match_id = p_cricbuzz_match_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Step 7: Update finalize_match_stats function
-- Now updates league_matches for league-specific fields
-- ============================================
CREATE OR REPLACE FUNCTION finalize_match_stats(
  p_league_id UUID,
  p_match_id UUID,
  p_man_of_match_cricbuzz_id TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Update all stats for this match to finalized
  UPDATE player_match_stats
  SET
    is_live_stats = false,
    finalized_at = NOW(),
    is_man_of_match = CASE
      WHEN p_man_of_match_cricbuzz_id IS NOT NULL
        AND cricbuzz_player_id = p_man_of_match_cricbuzz_id
      THEN true
      ELSE is_man_of_match
    END
  WHERE league_id = p_league_id
    AND match_id = p_match_id
    AND finalized_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Update the league_matches record (league-specific)
  UPDATE league_matches
  SET
    stats_imported = true,
    stats_imported_at = NOW()
  WHERE league_id = p_league_id
    AND match_id = p_match_id;

  -- Update the cricket_matches record (shared) for MoM
  UPDATE cricket_matches
  SET
    match_state = 'Complete',
    man_of_match_id = COALESCE(p_man_of_match_cricbuzz_id, man_of_match_id)
  WHERE id = p_match_id;

  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 8: Create helper function for upserting matches
-- Used by frontend to add matches to a league
-- ============================================
CREATE OR REPLACE FUNCTION upsert_league_match(
  p_league_id UUID,
  p_cricbuzz_match_id INTEGER,
  p_series_id INTEGER DEFAULT NULL,
  p_match_description TEXT DEFAULT NULL,
  p_match_format TEXT DEFAULT NULL,
  p_match_date TIMESTAMPTZ DEFAULT NULL,
  p_team1_name TEXT DEFAULT NULL,
  p_team2_name TEXT DEFAULT NULL,
  p_venue TEXT DEFAULT NULL,
  p_result TEXT DEFAULT NULL,
  p_week INTEGER DEFAULT NULL
)
RETURNS TABLE (
  match_id UUID,
  league_match_id UUID,
  is_new_match BOOLEAN
) AS $$
DECLARE
  v_match_id UUID;
  v_league_match_id UUID;
  v_is_new BOOLEAN := false;
BEGIN
  -- First, upsert the cricket_matches record (shared data)
  INSERT INTO cricket_matches (
    cricbuzz_match_id,
    series_id,
    match_description,
    match_format,
    match_date,
    team1_name,
    team2_name,
    venue,
    result
  ) VALUES (
    p_cricbuzz_match_id,
    p_series_id,
    p_match_description,
    p_match_format,
    p_match_date,
    p_team1_name,
    p_team2_name,
    p_venue,
    p_result
  )
  ON CONFLICT (cricbuzz_match_id) DO UPDATE SET
    series_id = COALESCE(EXCLUDED.series_id, cricket_matches.series_id),
    match_description = COALESCE(EXCLUDED.match_description, cricket_matches.match_description),
    match_format = COALESCE(EXCLUDED.match_format, cricket_matches.match_format),
    match_date = COALESCE(EXCLUDED.match_date, cricket_matches.match_date),
    team1_name = COALESCE(EXCLUDED.team1_name, cricket_matches.team1_name),
    team2_name = COALESCE(EXCLUDED.team2_name, cricket_matches.team2_name),
    venue = COALESCE(EXCLUDED.venue, cricket_matches.venue),
    result = COALESCE(EXCLUDED.result, cricket_matches.result)
  RETURNING id INTO v_match_id;

  -- Check if this is a new match
  v_is_new := NOT EXISTS (
    SELECT 1 FROM league_matches
    WHERE league_id = p_league_id AND match_id = v_match_id
  );

  -- Insert the league_matches record (league-specific data)
  INSERT INTO league_matches (
    league_id,
    match_id,
    week,
    stats_imported
  ) VALUES (
    p_league_id,
    v_match_id,
    p_week,
    false
  )
  ON CONFLICT (league_id, match_id) DO UPDATE SET
    week = COALESCE(EXCLUDED.week, league_matches.week)
  RETURNING id INTO v_league_match_id;

  RETURN QUERY SELECT v_match_id, v_league_match_id, v_is_new;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION upsert_league_match(UUID, INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_league_match(UUID, INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;

-- ============================================
-- Step 9: Create view for backwards compatibility
-- Combines cricket_matches with league_matches for easy querying
-- ============================================
CREATE OR REPLACE VIEW league_cricket_matches AS
SELECT
  cm.id,
  cm.cricbuzz_match_id,
  cm.series_id,
  cm.match_description,
  cm.match_format,
  cm.match_date,
  cm.team1_id,
  cm.team1_name,
  cm.team1_short,
  cm.team1_score,
  cm.team2_id,
  cm.team2_name,
  cm.team2_short,
  cm.team2_score,
  cm.result,
  cm.winner_team_id,
  cm.venue,
  cm.city,
  cm.state,
  cm.man_of_match_id,
  cm.man_of_match_name,
  cm.polling_enabled,
  cm.match_state,
  cm.created_at,
  -- League-specific fields from league_matches
  lm.league_id,
  lm.week,
  lm.stats_imported,
  lm.stats_imported_at,
  lm.id as league_match_id
FROM cricket_matches cm
JOIN league_matches lm ON lm.match_id = cm.id;

-- Grant access to the view
GRANT SELECT ON league_cricket_matches TO authenticated;
GRANT SELECT ON league_cricket_matches TO service_role;

-- ============================================
-- Verification queries (commented out, for manual testing)
-- ============================================
-- Check no duplicate cricbuzz_match_ids:
-- SELECT cricbuzz_match_id, COUNT(*) FROM cricket_matches GROUP BY cricbuzz_match_id HAVING COUNT(*) > 1;

-- Check all league_matches have valid references:
-- SELECT COUNT(*) FROM league_matches lm
-- LEFT JOIN cricket_matches cm ON cm.id = lm.match_id
-- WHERE cm.id IS NULL;

-- Check player_match_stats still valid:
-- SELECT COUNT(*) FROM player_match_stats pms
-- LEFT JOIN cricket_matches cm ON cm.id = pms.match_id
-- WHERE pms.match_id IS NOT NULL AND cm.id IS NULL;

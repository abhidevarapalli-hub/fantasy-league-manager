-- Fix RLS policies for stats import tables.
-- The admin "Sync & Import All" flow writes to these tables from the
-- authenticated user context. Previously only service_role could write,
-- causing 403 errors on every stats save.

-- ============================================
-- 1. match_player_stats: allow authenticated INSERT/UPDATE
-- ============================================
CREATE POLICY "Authenticated users can insert match stats"
  ON match_player_stats FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update match stats"
  ON match_player_stats FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

GRANT INSERT, UPDATE ON match_player_stats TO authenticated;

-- ============================================
-- 2. league_player_match_scores: allow authenticated INSERT/UPDATE
-- ============================================
CREATE POLICY "Authenticated users can insert league scores"
  ON league_player_match_scores FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update league scores"
  ON league_player_match_scores FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

GRANT INSERT, UPDATE ON league_player_match_scores TO authenticated;

-- Add missing unique constraint for upsert on (league_id, match_id, player_id)
-- PostgREST requires an actual unique constraint matching the onConflict columns.
ALTER TABLE league_player_match_scores
  ADD CONSTRAINT league_player_match_scores_league_match_player_key
  UNIQUE (league_id, match_id, player_id);

-- ============================================
-- 3. league_matches: add missing SELECT and write policies
--    (RLS was enabled but zero policies existed)
-- ============================================
CREATE POLICY "Authenticated users can read league matches"
  ON league_matches FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert league matches"
  ON league_matches FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update league matches"
  ON league_matches FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON league_matches TO authenticated;

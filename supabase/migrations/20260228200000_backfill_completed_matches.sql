-- Migration: Auto-backfill stats for completed matches
-- Creates an RPC that finds completed matches missing stats data,
-- and adds an audit log column to track backfill counts.

-- 1. RPC to find completed matches that need stats backfill
CREATE OR REPLACE FUNCTION get_matches_needing_backfill(p_max_results INTEGER DEFAULT 3)
RETURNS TABLE (
  cricbuzz_match_id BIGINT,
  match_id UUID,
  match_description TEXT,
  match_date TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    cm.cricbuzz_match_id,
    cm.id AS match_id,
    cm.match_description,
    cm.match_date
  FROM cricket_matches cm
  WHERE
    -- Match is complete (by state or by result text)
    (cm.state = 'Complete' OR cm.result ~* '\bwon\b')
    -- Match belongs to at least one league
    AND EXISTS (SELECT 1 FROM league_matches lm WHERE lm.match_id = cm.id)
    -- No stats have ever been imported for this match
    AND NOT EXISTS (SELECT 1 FROM match_player_stats mps WHERE mps.match_id = cm.id)
    -- Has a valid cricbuzz ID for API lookup
    AND cm.cricbuzz_match_id IS NOT NULL
    AND cm.cricbuzz_match_id > 0
  ORDER BY cm.match_date DESC NULLS LAST
  LIMIT p_max_results;
$$;

-- Grant execute to service_role (used by edge functions)
GRANT EXECUTE ON FUNCTION get_matches_needing_backfill(INTEGER) TO service_role;

-- 2. Add backfill tracking column to audit log
ALTER TABLE lifecycle_audit_log
  ADD COLUMN IF NOT EXISTS matches_backfilled INTEGER DEFAULT 0;

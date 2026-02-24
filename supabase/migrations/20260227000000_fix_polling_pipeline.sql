-- Migration: Fix Live Scoring Pipeline
-- Fixes 4 issues:
--   1. Missing get_upcoming_matches_to_activate RPC
--   2. enable_match_polling parameter mismatch (2-param → 3-param)
--   3. finalize_match_stats references old schema (player_match_stats → match_player_stats)
--   4. SECURITY DEFINER on polling lock/record functions

-- ============================================
-- 1. Create get_upcoming_matches_to_activate
-- Used by match-lifecycle-manager to find matches approaching start time
-- Must DROP first because the production version has a different return type
-- ============================================
DROP FUNCTION IF EXISTS get_upcoming_matches_to_activate(INTEGER);

CREATE OR REPLACE FUNCTION get_upcoming_matches_to_activate(
  p_lookahead_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
  cricbuzz_match_id INTEGER,
  match_id UUID,
  match_description TEXT,
  match_date TIMESTAMPTZ,
  team1_name TEXT,
  team2_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.cricbuzz_match_id,
    cm.id AS match_id,
    cm.match_description,
    cm.match_date,
    cm.team1_name,
    cm.team2_name
  FROM cricket_matches cm
  WHERE
    -- Match is within the lookahead window (or up to 6 hours past start)
    cm.match_date BETWEEN (NOW() - INTERVAL '6 hours') AND (NOW() + (p_lookahead_minutes || ' minutes')::INTERVAL)
    -- Not already polling
    AND NOT EXISTS (
      SELECT 1 FROM live_match_polling lmp
      WHERE lmp.cricbuzz_match_id = cm.cricbuzz_match_id
        AND lmp.polling_enabled = true
    )
    -- Not manually disabled
    AND NOT EXISTS (
      SELECT 1 FROM live_match_polling lmp
      WHERE lmp.cricbuzz_match_id = cm.cricbuzz_match_id
        AND lmp.auto_enabled = false
    )
    -- Not already completed
    AND NOT EXISTS (
      SELECT 1 FROM live_match_polling lmp
      WHERE lmp.cricbuzz_match_id = cm.cricbuzz_match_id
        AND lmp.match_state = 'Complete'
    )
    -- Must be associated with at least one league
    AND EXISTS (
      SELECT 1 FROM league_matches lm
      WHERE lm.match_id = cm.id
    )
  ORDER BY cm.match_date ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 2. enable_match_polling — superseded by migration 20260224195201
--    (4-param version with p_match_id UUID)
--    Only drop the old 2-param overload if it still exists.
-- ============================================
DROP FUNCTION IF EXISTS enable_match_polling(INTEGER, TEXT);

-- ============================================
-- 3. Rewrite finalize_match_stats for new schema
-- Old version referenced player_match_stats with league_id (no longer exists).
-- New version updates match_player_stats (by match_id) and
-- league_player_match_scores (by league_id + match_id).
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
  -- Update global match_player_stats (no league_id column — filter by match_id only)
  UPDATE match_player_stats
  SET
    is_live = false,
    finalized_at = NOW(),
    is_man_of_match = CASE
      WHEN p_man_of_match_cricbuzz_id IS NOT NULL
        AND cricbuzz_player_id = p_man_of_match_cricbuzz_id
      THEN true
      ELSE is_man_of_match
    END
  WHERE match_id = p_match_id
    AND finalized_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Update league-specific scores
  UPDATE league_player_match_scores
  SET
    is_live = false,
    finalized_at = NOW()
  WHERE league_id = p_league_id
    AND match_id = p_match_id
    AND finalized_at IS NULL;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. Add SECURITY DEFINER to polling lock/record functions
-- Ensures edge functions calling via service_role can bypass RLS
-- ============================================
CREATE OR REPLACE FUNCTION acquire_polling_lock(
  p_cricbuzz_match_id INTEGER,
  p_lock_duration_seconds INTEGER DEFAULT 90
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE live_match_polling
  SET
    polling_lock_until = NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL,
    updated_at = NOW()
  WHERE cricbuzz_match_id = p_cricbuzz_match_id
    AND polling_enabled = true
    AND (polling_lock_until IS NULL OR polling_lock_until < NOW())
  RETURNING 1 INTO v_updated;

  RETURN v_updated IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION release_polling_lock(
  p_cricbuzz_match_id INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE live_match_polling
  SET
    polling_lock_until = NULL,
    updated_at = NOW()
  WHERE cricbuzz_match_id = p_cricbuzz_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_poll_success(
  p_cricbuzz_match_id INTEGER,
  p_match_state TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE live_match_polling
  SET
    last_polled_at = NOW(),
    poll_count = poll_count + 1,
    polling_lock_until = NULL,
    error_count = 0,
    last_error = NULL,
    match_state = COALESCE(p_match_state, match_state),
    polling_enabled = CASE WHEN p_match_state = 'Complete' THEN false ELSE polling_enabled END,
    updated_at = NOW()
  WHERE cricbuzz_match_id = p_cricbuzz_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_poll_error(
  p_cricbuzz_match_id INTEGER,
  p_error_message TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE live_match_polling
  SET
    error_count = error_count + 1,
    last_error = p_error_message,
    polling_lock_until = NULL,
    polling_enabled = CASE WHEN (error_count + 1) >= 4 THEN false ELSE polling_enabled END,
    updated_at = NOW()
  WHERE cricbuzz_match_id = p_cricbuzz_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Grant permissions on new/modified functions
-- ============================================
GRANT EXECUTE ON FUNCTION get_upcoming_matches_to_activate(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_upcoming_matches_to_activate(INTEGER) TO service_role;
-- enable_match_polling grants handled by migration 20260224195201 (4-param version)
GRANT EXECUTE ON FUNCTION finalize_match_stats(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_match_stats(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION acquire_polling_lock(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION acquire_polling_lock(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION release_polling_lock(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION release_polling_lock(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION record_poll_success(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_poll_success(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION record_poll_error(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_poll_error(INTEGER, TEXT) TO service_role;

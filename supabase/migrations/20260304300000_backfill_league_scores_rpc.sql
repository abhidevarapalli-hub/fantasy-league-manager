-- ============================================
-- Backfill League Scores RPC
-- Safety net for when live-stats-poller misses a league.
-- Creates skeleton league_player_match_scores rows from match_player_stats
-- so that recomputeLeaguePoints() can calculate actual fantasy points.
-- ============================================

-- Step 1: Add a unique constraint for ON CONFLICT support.
-- This prevents duplicate rows if backfill is run multiple times.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lpms_league_match_player
  ON league_player_match_scores (league_id, match_id, player_id);

-- Step 2: Create the backfill RPC
CREATE OR REPLACE FUNCTION backfill_league_scores(p_league_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  -- Only platform admins can run this
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Insert skeleton rows for all match_player_stats that exist in
  -- league_matches but are missing from league_player_match_scores.
  -- Joins through master_players.cricbuzz_id to map cricbuzz IDs to UUIDs.
  INSERT INTO league_player_match_scores (
    match_player_stats_id, league_id, match_id, player_id,
    manager_id, was_in_active_roster, week,
    points_breakdown, total_points, is_live, finalized_at
  )
  SELECT
    mps.id,
    lm.league_id,
    mps.match_id,
    mp.id,
    mr.manager_id,
    COALESCE(mr.slot_type = 'active', false),
    lm.week,
    '{}'::jsonb,
    0,
    false,
    CASE WHEN cm.state = 'Complete' THEN COALESCE(mps.finalized_at, NOW()) END
  FROM match_player_stats mps
  JOIN league_matches lm ON lm.match_id = mps.match_id
  JOIN cricket_matches cm ON cm.id = mps.match_id
  JOIN master_players mp ON mp.cricbuzz_id = mps.cricbuzz_player_id
  -- Only backfill for players in this league's player pool
  JOIN league_player_pool lpp ON lpp.player_id = mp.id
                               AND lpp.league_id = lm.league_id
  LEFT JOIN manager_roster mr ON mr.player_id = mp.id
                              AND mr.league_id = lm.league_id
                              AND mr.week = lm.week
  WHERE lm.league_id = p_league_id
  ON CONFLICT (league_id, match_id, player_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Also mark completed matches as stats_imported
  UPDATE league_matches lm
  SET stats_imported = true, stats_imported_at = NOW()
  FROM cricket_matches cm
  WHERE cm.id = lm.match_id
    AND cm.state = 'Complete'
    AND lm.league_id = p_league_id
    AND lm.stats_imported = false;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION backfill_league_scores(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION backfill_league_scores(UUID) TO service_role;

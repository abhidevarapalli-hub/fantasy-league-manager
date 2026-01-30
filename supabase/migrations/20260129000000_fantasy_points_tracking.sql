-- Migration: Fantasy Points Tracking
-- Description: Add columns for tracking fantasy points with manager ownership
-- Purpose: Enable per-match fantasy point calculation and attribution to managers

-- ============================================
-- Extend cricket_matches table
-- ============================================
-- Add fantasy week mapping and import tracking
ALTER TABLE cricket_matches
  ADD COLUMN IF NOT EXISTS week INTEGER,
  ADD COLUMN IF NOT EXISTS stats_imported BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stats_imported_at TIMESTAMP WITH TIME ZONE;

-- Index for week lookups
CREATE INDEX IF NOT EXISTS idx_cricket_matches_week ON cricket_matches(week);
CREATE INDEX IF NOT EXISTS idx_cricket_matches_league_week ON cricket_matches(league_id, week);

-- ============================================
-- Extend player_match_stats table
-- ============================================
-- Add manager ownership and fantasy context fields
ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES managers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS was_in_active_roster BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS week INTEGER,
  ADD COLUMN IF NOT EXISTS is_in_playing_11 BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_impact_player BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_man_of_match BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS team_won BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lbw_bowled_count INTEGER DEFAULT 0;

-- Indexes for fantasy point aggregation
CREATE INDEX IF NOT EXISTS idx_player_match_stats_manager_id ON player_match_stats(manager_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_week ON player_match_stats(week);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_active_roster ON player_match_stats(was_in_active_roster);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_league_manager ON player_match_stats(league_id, manager_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_league_week ON player_match_stats(league_id, week);

-- ============================================
-- Function: Get manager fantasy points for a week
-- ============================================
CREATE OR REPLACE FUNCTION get_manager_weekly_points(
  p_league_id UUID,
  p_manager_id UUID,
  p_week INTEGER
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(fantasy_points)
     FROM player_match_stats
     WHERE league_id = p_league_id
       AND manager_id = p_manager_id
       AND week = p_week
       AND was_in_active_roster = true),
    0
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Function: Get manager total fantasy points
-- ============================================
CREATE OR REPLACE FUNCTION get_manager_total_points(
  p_league_id UUID,
  p_manager_id UUID
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(fantasy_points)
     FROM player_match_stats
     WHERE league_id = p_league_id
       AND manager_id = p_manager_id
       AND was_in_active_roster = true),
    0
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Function: Get league standings by fantasy points
-- ============================================
CREATE OR REPLACE FUNCTION get_fantasy_standings(p_league_id UUID)
RETURNS TABLE (
  manager_id UUID,
  manager_name TEXT,
  team_name TEXT,
  total_points DECIMAL,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as manager_id,
    m.name as manager_name,
    m.team_name,
    COALESCE(SUM(pms.fantasy_points), 0) as total_points,
    RANK() OVER (ORDER BY COALESCE(SUM(pms.fantasy_points), 0) DESC) as rank
  FROM managers m
  LEFT JOIN player_match_stats pms ON pms.manager_id = m.id
    AND pms.was_in_active_roster = true
    AND pms.league_id = p_league_id
  WHERE m.league_id = p_league_id
  GROUP BY m.id, m.name, m.team_name
  ORDER BY total_points DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Function: Get player fantasy points for a week
-- ============================================
CREATE OR REPLACE FUNCTION get_player_weekly_points(
  p_league_id UUID,
  p_player_id UUID,
  p_week INTEGER
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(fantasy_points)
     FROM player_match_stats
     WHERE league_id = p_league_id
       AND player_id = p_player_id
       AND week = p_week),
    0
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- View: Weekly fantasy summary per manager
-- ============================================
CREATE OR REPLACE VIEW fantasy_weekly_summary AS
SELECT
  pms.league_id,
  pms.week,
  pms.manager_id,
  m.name as manager_name,
  m.team_name,
  COUNT(DISTINCT pms.player_id) as players_with_stats,
  SUM(CASE WHEN pms.was_in_active_roster THEN pms.fantasy_points ELSE 0 END) as active_points,
  SUM(CASE WHEN NOT pms.was_in_active_roster THEN pms.fantasy_points ELSE 0 END) as bench_points,
  SUM(CASE WHEN pms.was_in_active_roster THEN pms.fantasy_points ELSE 0 END) as total_points
FROM player_match_stats pms
JOIN managers m ON m.id = pms.manager_id
GROUP BY pms.league_id, pms.week, pms.manager_id, m.name, m.team_name;

-- ============================================
-- View: Player fantasy performance
-- ============================================
CREATE OR REPLACE VIEW player_fantasy_performance AS
SELECT
  pms.league_id,
  pms.player_id,
  p.name as player_name,
  p.team as ipl_team,
  p.role,
  COUNT(DISTINCT pms.match_id) as matches_played,
  SUM(pms.runs) as total_runs,
  SUM(pms.wickets) as total_wickets,
  SUM(pms.catches + pms.stumpings + pms.run_outs) as total_dismissals,
  SUM(pms.fantasy_points) as total_fantasy_points,
  AVG(pms.fantasy_points) as avg_fantasy_points
FROM player_match_stats pms
JOIN players p ON p.id = pms.player_id
GROUP BY pms.league_id, pms.player_id, p.name, p.team, p.role;

-- ============================================
-- Grant permissions for new functions
-- ============================================
GRANT EXECUTE ON FUNCTION get_manager_weekly_points(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_manager_total_points(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_fantasy_standings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_weekly_points(UUID, UUID, INTEGER) TO authenticated;

-- Grant view access
GRANT SELECT ON fantasy_weekly_summary TO authenticated;
GRANT SELECT ON player_fantasy_performance TO authenticated;

-- Migration: Scoring Rules Refactor
-- Description: Replace scoring_rule_versions with a flat scoring_rules table (one row per league).
--              Drop scoring_version_id from league_player_match_scores.
--              Update RPCs and views to use league_player_match_scores instead of player_match_stats
--              for fantasy point totals.
-- Purpose: Simplify scoring rules storage; when rules change, frontend recomputes all scores.

-- ============================================
-- Step 1: Create scoring_rules table
-- ============================================
CREATE TABLE IF NOT EXISTS scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL UNIQUE REFERENCES leagues(id) ON DELETE CASCADE,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update trigger on updated_at
CREATE OR REPLACE FUNCTION update_scoring_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scoring_rules_updated_at ON scoring_rules;
CREATE TRIGGER scoring_rules_updated_at
  BEFORE UPDATE ON scoring_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_scoring_rules_timestamp();

-- RLS
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read scoring rules"
  ON scoring_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "League managers can insert scoring rules"
  ON scoring_rules FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = scoring_rules.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

CREATE POLICY "League managers can update scoring rules"
  ON scoring_rules FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = scoring_rules.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

-- Grants
GRANT SELECT ON scoring_rules TO authenticated;
GRANT INSERT, UPDATE ON scoring_rules TO authenticated;
GRANT ALL ON scoring_rules TO service_role;

-- ============================================
-- Step 2: Migrate data from scoring_rule_versions (active rows)
-- ============================================
-- Wrap data migration in a block to safely handle missing source table on fresh installs
DO $$
BEGIN
  -- Only migrate if scoring_rule_versions table exists (production path)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scoring_rule_versions') THEN
    INSERT INTO scoring_rules (league_id, rules, created_at)
    SELECT DISTINCT ON (league_id)
      league_id,
      rules,
      created_at
    FROM scoring_rule_versions
    WHERE is_active = true
    ORDER BY league_id, version DESC
    ON CONFLICT (league_id) DO NOTHING;
  END IF;

  -- Fill gaps: leagues that have scoring_rules JSONB column but no scoring_rules row
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leagues' AND column_name = 'scoring_rules') THEN
    EXECUTE '
      INSERT INTO scoring_rules (league_id, rules)
      SELECT l.id, l.scoring_rules
      FROM leagues l
      WHERE l.scoring_rules IS NOT NULL
        AND l.scoring_rules != ''{}''::jsonb
        AND NOT EXISTS (SELECT 1 FROM scoring_rules sr WHERE sr.league_id = l.id)
      ON CONFLICT (league_id) DO NOTHING;
    ';
  END IF;
END $$;

-- ============================================
-- Step 3: Drop old schema
-- ============================================

-- Drop FK constraint and column on league_player_match_scores (may not exist on fresh installs)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'league_player_match_scores') THEN
    ALTER TABLE league_player_match_scores
      DROP CONSTRAINT IF EXISTS league_player_match_scores_scoring_version_id_fkey;
    ALTER TABLE league_player_match_scores
      DROP COLUMN IF EXISTS scoring_version_id;
  END IF;
END $$;

-- Drop scoring_rule_versions table
DROP TABLE IF EXISTS scoring_rule_versions;

-- Drop scoring_rules column from leagues table
ALTER TABLE leagues
  DROP COLUMN IF EXISTS scoring_rules;

-- ============================================
-- Step 4: Update get_leagues_for_cricbuzz_match RPC
-- Now JOIN scoring_rules table instead of leagues.scoring_rules
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
    sr.rules as scoring_rules
  FROM cricket_matches cm
  JOIN league_matches lm ON lm.match_id = cm.id
  JOIN scoring_rules sr ON sr.league_id = lm.league_id
  WHERE cm.cricbuzz_match_id = p_cricbuzz_match_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Step 5: Create recompute RPCs
-- ============================================

-- 5a. Get raw stats + league score rows for recompute
CREATE OR REPLACE FUNCTION get_league_match_stats_for_recompute(p_league_id UUID)
RETURNS TABLE (
  score_id UUID,
  player_id UUID,
  match_id UUID,
  -- Raw stats from match_player_stats
  runs INTEGER,
  balls_faced INTEGER,
  fours INTEGER,
  sixes INTEGER,
  is_out BOOLEAN,
  overs DECIMAL,
  maidens INTEGER,
  runs_conceded INTEGER,
  wickets INTEGER,
  dots INTEGER,
  wides INTEGER,
  no_balls INTEGER,
  lbw_bowled_count INTEGER,
  catches INTEGER,
  stumpings INTEGER,
  run_outs INTEGER,
  is_in_playing_11 BOOLEAN,
  is_impact_player BOOLEAN,
  is_man_of_match BOOLEAN,
  team_won BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lpms.id as score_id,
    lpms.player_id,
    lpms.match_id,
    mps.runs,
    mps.balls_faced,
    mps.fours,
    mps.sixes,
    mps.is_out,
    mps.overs,
    mps.maidens,
    mps.runs_conceded,
    mps.wickets,
    mps.dots,
    mps.wides,
    mps.no_balls,
    mps.lbw_bowled_count,
    mps.catches,
    mps.stumpings,
    mps.run_outs,
    mps.is_in_playing_11,
    mps.is_impact_player,
    mps.is_man_of_match,
    mps.team_won
  FROM league_player_match_scores lpms
  JOIN match_player_stats mps ON mps.id = lpms.match_player_stats_id
  WHERE lpms.league_id = p_league_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5b. Batch update league scores
CREATE OR REPLACE FUNCTION batch_update_league_scores(p_updates JSONB)
RETURNS INTEGER AS $$
DECLARE
  v_update JSONB;
  v_count INTEGER := 0;
BEGIN
  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE league_player_match_scores
    SET
      total_points = (v_update->>'total_points')::DECIMAL,
      batting_points = (v_update->>'batting_points')::DECIMAL,
      bowling_points = (v_update->>'bowling_points')::DECIMAL,
      fielding_points = (v_update->>'fielding_points')::DECIMAL,
      common_points = (v_update->>'common_points')::DECIMAL,
      points_breakdown = (v_update->'points_breakdown')::JSONB,
      computed_at = NOW()
    WHERE id = (v_update->>'id')::UUID;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Grants for recompute RPCs
GRANT EXECUTE ON FUNCTION get_league_match_stats_for_recompute(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_league_match_stats_for_recompute(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION batch_update_league_scores(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_league_scores(JSONB) TO service_role;

-- ============================================
-- Step 6: Update standings RPCs to use league_player_match_scores
-- ============================================

-- 6a. get_fantasy_standings
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
    COALESCE(SUM(lpms.total_points), 0) as total_points,
    RANK() OVER (ORDER BY COALESCE(SUM(lpms.total_points), 0) DESC) as rank
  FROM managers m
  LEFT JOIN league_player_match_scores lpms ON lpms.manager_id = m.id
    AND lpms.was_in_active_roster = true
    AND lpms.league_id = p_league_id
  WHERE m.league_id = p_league_id
  GROUP BY m.id, m.name, m.team_name
  ORDER BY total_points DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6b. get_live_fantasy_standings
CREATE OR REPLACE FUNCTION get_live_fantasy_standings(p_league_id UUID)
RETURNS TABLE (
  manager_id UUID,
  manager_name TEXT,
  team_name TEXT,
  total_points DECIMAL,
  live_points DECIMAL,
  finalized_points DECIMAL,
  has_live_stats BOOLEAN,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as manager_id,
    m.name as manager_name,
    m.team_name,
    COALESCE(SUM(lpms.total_points), 0) as total_points,
    COALESCE(SUM(CASE WHEN lpms.is_live THEN lpms.total_points ELSE 0 END), 0) as live_points,
    COALESCE(SUM(CASE WHEN NOT lpms.is_live OR lpms.is_live IS NULL THEN lpms.total_points ELSE 0 END), 0) as finalized_points,
    EXISTS(
      SELECT 1 FROM league_player_match_scores lpms2
      WHERE lpms2.manager_id = m.id
        AND lpms2.league_id = p_league_id
        AND lpms2.is_live = true
    ) as has_live_stats,
    RANK() OVER (ORDER BY COALESCE(SUM(lpms.total_points), 0) DESC) as rank
  FROM managers m
  LEFT JOIN league_player_match_scores lpms ON lpms.manager_id = m.id
    AND lpms.was_in_active_roster = true
    AND lpms.league_id = p_league_id
  WHERE m.league_id = p_league_id
  GROUP BY m.id, m.name, m.team_name
  ORDER BY total_points DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6c. get_manager_weekly_points
CREATE OR REPLACE FUNCTION get_manager_weekly_points(
  p_league_id UUID,
  p_manager_id UUID,
  p_week INTEGER
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(total_points)
     FROM league_player_match_scores
     WHERE league_id = p_league_id
       AND manager_id = p_manager_id
       AND week = p_week
       AND was_in_active_roster = true),
    0
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 6d. get_manager_total_points
CREATE OR REPLACE FUNCTION get_manager_total_points(
  p_league_id UUID,
  p_manager_id UUID
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(total_points)
     FROM league_player_match_scores
     WHERE league_id = p_league_id
       AND manager_id = p_manager_id
       AND was_in_active_roster = true),
    0
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 6e. get_player_weekly_points
CREATE OR REPLACE FUNCTION get_player_weekly_points(
  p_league_id UUID,
  p_player_id UUID,
  p_week INTEGER
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(total_points)
     FROM league_player_match_scores
     WHERE league_id = p_league_id
       AND player_id = p_player_id
       AND week = p_week),
    0
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Step 7: Update views to use league_player_match_scores
-- ============================================

-- 7a. fantasy_weekly_summary
CREATE OR REPLACE VIEW fantasy_weekly_summary AS
SELECT
  lpms.league_id,
  lpms.week,
  lpms.manager_id,
  m.name as manager_name,
  m.team_name,
  COUNT(DISTINCT lpms.player_id) as players_with_stats,
  SUM(CASE WHEN lpms.was_in_active_roster THEN lpms.total_points ELSE 0 END) as active_points,
  SUM(CASE WHEN NOT lpms.was_in_active_roster THEN lpms.total_points ELSE 0 END) as bench_points,
  SUM(CASE WHEN lpms.was_in_active_roster THEN lpms.total_points ELSE 0 END) as total_points
FROM league_player_match_scores lpms
JOIN managers m ON m.id = lpms.manager_id
GROUP BY lpms.league_id, lpms.week, lpms.manager_id, m.name, m.team_name;

-- 7b. player_fantasy_performance
-- Uses league_player_match_scores for points, match_player_stats for raw stat aggregates
CREATE OR REPLACE VIEW player_fantasy_performance AS
SELECT
  lpms.league_id,
  lpms.player_id,
  mp.name as player_name,
  COALESCE(lpp.team_override, mp.teams[1]) as ipl_team,
  mp.primary_role as role,
  COUNT(DISTINCT lpms.match_id) as matches_played,
  COALESCE(SUM(mps.runs), 0) as total_runs,
  COALESCE(SUM(mps.wickets), 0) as total_wickets,
  COALESCE(SUM(mps.catches + mps.stumpings + mps.run_outs), 0) as total_dismissals,
  COALESCE(SUM(lpms.total_points), 0) as total_fantasy_points,
  COALESCE(AVG(lpms.total_points), 0) as avg_fantasy_points
FROM league_player_match_scores lpms
JOIN match_player_stats mps ON mps.id = lpms.match_player_stats_id
JOIN master_players mp ON mp.id = lpms.player_id
LEFT JOIN league_player_pool lpp ON lpp.league_id = lpms.league_id AND lpp.player_id = lpms.player_id
GROUP BY lpms.league_id, lpms.player_id, mp.name, lpp.team_override, mp.teams[1], mp.primary_role;

-- Grant view access
GRANT SELECT ON fantasy_weekly_summary TO authenticated;
GRANT SELECT ON player_fantasy_performance TO authenticated;
GRANT SELECT ON fantasy_weekly_summary TO service_role;
GRANT SELECT ON player_fantasy_performance TO service_role;

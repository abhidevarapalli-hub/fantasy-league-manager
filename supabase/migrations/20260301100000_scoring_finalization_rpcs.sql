-- ============================================
-- Scoring Finalization & Standings Pipeline RPCs
-- Part of: scoring-standings-finalization design
-- ============================================

-- 1. Update get_league_match_stats_for_recompute to include player role
CREATE OR REPLACE FUNCTION get_league_match_stats_for_recompute(p_league_id UUID)
RETURNS TABLE (
  score_id UUID,
  player_id UUID,
  match_id UUID,
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
  team_won BOOLEAN,
  primary_role TEXT
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
    mps.team_won,
    mp.primary_role
  FROM league_player_match_scores lpms
  JOIN match_player_stats mps ON mps.id = lpms.match_player_stats_id
  LEFT JOIN master_players mp ON mp.id = lpms.player_id
  WHERE lpms.league_id = p_league_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 2. admin_finalize_match — Finalize a match with admin-confirmed MoM and winner
-- Called by super-admin from PlatformAdmin UI.
-- Only updates flags; points recalculation happens on the frontend via recomputeLeaguePoints().
-- ============================================

CREATE OR REPLACE FUNCTION admin_finalize_match(
  p_match_id UUID,
  p_man_of_match_cricbuzz_id TEXT DEFAULT NULL,
  p_winner_team_id INTEGER DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_mom_name TEXT;
BEGIN
  -- Look up MoM player name if provided
  IF p_man_of_match_cricbuzz_id IS NOT NULL THEN
    SELECT
      COALESCE(mp.name, mps.cricbuzz_player_id)
    INTO v_mom_name
    FROM match_player_stats mps
    LEFT JOIN master_players mp ON mp.cricbuzz_id = mps.cricbuzz_player_id
    WHERE mps.match_id = p_match_id
      AND mps.cricbuzz_player_id = p_man_of_match_cricbuzz_id
    LIMIT 1;
  END IF;

  -- 1. Update cricket_matches
  UPDATE cricket_matches
  SET
    state = 'Complete',
    man_of_match_id = COALESCE(p_man_of_match_cricbuzz_id, man_of_match_id),
    man_of_match_name = COALESCE(v_mom_name, man_of_match_name),
    winner_team_id = COALESCE(p_winner_team_id, winner_team_id)
  WHERE id = p_match_id;

  -- 2. Update match_player_stats: MoM flag and finalize
  UPDATE match_player_stats
  SET
    is_man_of_match = CASE
      WHEN p_man_of_match_cricbuzz_id IS NOT NULL
        THEN (cricbuzz_player_id = p_man_of_match_cricbuzz_id)
      ELSE is_man_of_match
    END,
    is_live = false,
    finalized_at = COALESCE(finalized_at, NOW())
  WHERE match_id = p_match_id;

  -- 3. Finalize league_player_match_scores for ALL leagues with this match
  UPDATE league_player_match_scores
  SET
    is_live = false,
    finalized_at = COALESCE(finalized_at, NOW())
  WHERE match_id = p_match_id
    AND finalized_at IS NULL;

  -- 4. Mark league_matches as stats_imported for ALL leagues
  UPDATE league_matches
  SET
    stats_imported = true,
    stats_imported_at = COALESCE(stats_imported_at, NOW())
  WHERE match_id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_finalize_match(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_finalize_match(UUID, TEXT, INTEGER) TO service_role;

-- ============================================
-- 3. check_week_finalization_ready — Check if all matches in a week are finalized
-- ============================================

CREATE OR REPLACE FUNCTION check_week_finalization_ready(
  p_league_id UUID,
  p_week INTEGER
)
RETURNS TABLE (
  total_matches INTEGER,
  finalized_matches INTEGER,
  is_ready BOOLEAN,
  unfinalized_match_ids UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_matches,
    COUNT(*) FILTER (WHERE lm.stats_imported = true)::INTEGER as finalized_matches,
    (COUNT(*) > 0 AND COUNT(*) = COUNT(*) FILTER (WHERE lm.stats_imported = true)) as is_ready,
    ARRAY_AGG(lm.match_id) FILTER (WHERE lm.stats_imported IS NOT TRUE) as unfinalized_match_ids
  FROM league_matches lm
  WHERE lm.league_id = p_league_id
    AND lm.week = p_week;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_week_finalization_ready(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_week_finalization_ready(UUID, INTEGER) TO service_role;

-- ============================================
-- 4. finalize_week — Calculate matchup scores, determine W/L, update standings
-- Captain (2x) and Vice-Captain (1.5x) multipliers applied here.
-- manager_roster uses: is_captain BOOLEAN, is_vice_captain BOOLEAN
-- slot_type is 'active' or 'bench' (NOT captain/vc)
-- ============================================

CREATE OR REPLACE FUNCTION finalize_week(
  p_league_id UUID,
  p_week INTEGER
)
RETURNS void AS $$
DECLARE
  v_matchup RECORD;
  v_score1 DECIMAL;
  v_score2 DECIMAL;
  v_winner UUID;
  v_loser UUID;
  v_total_matches INTEGER;
  v_finalized_matches INTEGER;
BEGIN
  -- 1. Verify all matches are finalized
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE lm.stats_imported = true)::INTEGER
  INTO v_total_matches, v_finalized_matches
  FROM league_matches lm
  WHERE lm.league_id = p_league_id
    AND lm.week = p_week;

  IF v_total_matches = 0 THEN
    RAISE EXCEPTION 'No matches found for league % week %', p_league_id, p_week;
  END IF;

  IF v_total_matches <> v_finalized_matches THEN
    RAISE EXCEPTION 'Not all matches finalized for league % week %. % of % done.',
      p_league_id, p_week, v_finalized_matches, v_total_matches;
  END IF;

  -- 2. Calculate scores and finalize each matchup
  FOR v_matchup IN
    SELECT id, manager1_id, manager2_id
    FROM league_matchups
    WHERE league_id = p_league_id
      AND week = p_week
      AND is_finalized = false
  LOOP
    -- Skip byes
    IF v_matchup.manager2_id IS NULL THEN
      UPDATE league_matchups
      SET is_finalized = true
      WHERE id = v_matchup.id;
      CONTINUE;
    END IF;

    -- Calculate manager1 score with C/VC multipliers
    SELECT COALESCE(SUM(
      lpms.total_points * CASE
        WHEN mr.is_captain THEN 2.0
        WHEN mr.is_vice_captain THEN 1.5
        ELSE 1.0
      END
    ), 0)
    INTO v_score1
    FROM league_player_match_scores lpms
    JOIN manager_roster mr ON mr.player_id = lpms.player_id
      AND mr.manager_id = lpms.manager_id
      AND mr.league_id = lpms.league_id
    WHERE lpms.league_id = p_league_id
      AND lpms.week = p_week
      AND lpms.manager_id = v_matchup.manager1_id
      AND lpms.was_in_active_roster = true;

    -- Calculate manager2 score with C/VC multipliers
    SELECT COALESCE(SUM(
      lpms.total_points * CASE
        WHEN mr.is_captain THEN 2.0
        WHEN mr.is_vice_captain THEN 1.5
        ELSE 1.0
      END
    ), 0)
    INTO v_score2
    FROM league_player_match_scores lpms
    JOIN manager_roster mr ON mr.player_id = lpms.player_id
      AND mr.manager_id = lpms.manager_id
      AND mr.league_id = lpms.league_id
    WHERE lpms.league_id = p_league_id
      AND lpms.week = p_week
      AND lpms.manager_id = v_matchup.manager2_id
      AND lpms.was_in_active_roster = true;

    -- Determine winner
    IF v_score1 > v_score2 THEN
      v_winner := v_matchup.manager1_id;
      v_loser := v_matchup.manager2_id;
    ELSIF v_score2 > v_score1 THEN
      v_winner := v_matchup.manager2_id;
      v_loser := v_matchup.manager1_id;
    ELSE
      v_winner := NULL;
      v_loser := NULL;
    END IF;

    -- Update matchup
    UPDATE league_matchups
    SET
      manager1_score = v_score1,
      manager2_score = v_score2,
      winner_id = v_winner,
      is_finalized = true
    WHERE id = v_matchup.id;

    -- Update W/L records (skip ties)
    IF v_winner IS NOT NULL THEN
      UPDATE managers SET wins = wins + 1 WHERE id = v_winner;
      UPDATE managers SET losses = losses + 1 WHERE id = v_loser;
    END IF;
  END LOOP;

  -- 3. Update total points for all managers in the league
  -- Sum all active roster points across all weeks with C/VC multipliers
  UPDATE managers m
  SET points = sub.total_pts
  FROM (
    SELECT
      lpms.manager_id,
      COALESCE(SUM(
        lpms.total_points * CASE
          WHEN mr.is_captain THEN 2.0
          WHEN mr.is_vice_captain THEN 1.5
          ELSE 1.0
        END
      ), 0) as total_pts
    FROM league_player_match_scores lpms
    JOIN manager_roster mr ON mr.player_id = lpms.player_id
      AND mr.manager_id = lpms.manager_id
      AND mr.league_id = lpms.league_id
    WHERE lpms.league_id = p_league_id
      AND lpms.was_in_active_roster = true
    GROUP BY lpms.manager_id
  ) sub
  WHERE m.id = sub.manager_id
    AND m.league_id = p_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION finalize_week(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_week(UUID, INTEGER) TO service_role;

-- ============================================
-- 5. Update get_live_fantasy_standings to include W/L and sort by wins first
-- ============================================

CREATE OR REPLACE FUNCTION get_live_fantasy_standings(p_league_id UUID)
RETURNS TABLE (
  manager_id UUID,
  manager_name TEXT,
  team_name TEXT,
  total_points DECIMAL,
  live_points DECIMAL,
  finalized_points DECIMAL,
  has_live_stats BOOLEAN,
  wins INTEGER,
  losses INTEGER,
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
    m.wins,
    m.losses,
    RANK() OVER (ORDER BY m.wins DESC, COALESCE(SUM(lpms.total_points), 0) DESC) as rank
  FROM managers m
  LEFT JOIN league_player_match_scores lpms ON lpms.manager_id = m.id
    AND lpms.was_in_active_roster = true
    AND lpms.league_id = p_league_id
  WHERE m.league_id = p_league_id
  GROUP BY m.id, m.name, m.team_name, m.wins, m.losses
  ORDER BY m.wins DESC, total_points DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Also update the non-live version
CREATE OR REPLACE FUNCTION get_fantasy_standings(p_league_id UUID)
RETURNS TABLE (
  manager_id UUID,
  manager_name TEXT,
  team_name TEXT,
  total_points DECIMAL,
  wins INTEGER,
  losses INTEGER,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as manager_id,
    m.name as manager_name,
    m.team_name,
    COALESCE(SUM(lpms.total_points), 0) as total_points,
    m.wins,
    m.losses,
    RANK() OVER (ORDER BY m.wins DESC, COALESCE(SUM(lpms.total_points), 0) DESC) as rank
  FROM managers m
  LEFT JOIN league_player_match_scores lpms ON lpms.manager_id = m.id
    AND lpms.was_in_active_roster = true
    AND lpms.league_id = p_league_id
  WHERE m.league_id = p_league_id
  GROUP BY m.id, m.name, m.team_name, m.wins, m.losses
  ORDER BY m.wins DESC, total_points DESC;
END;
$$ LANGUAGE plpgsql STABLE;

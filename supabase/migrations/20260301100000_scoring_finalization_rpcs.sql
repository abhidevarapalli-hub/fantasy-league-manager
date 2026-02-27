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

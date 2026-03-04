-- Auto-resolve winner from match result text + update admin_finalize_match to use it

--------------------------------------------------------------------------------
-- auto_resolve_winner: extract winner team ID from result text
-- e.g. "India won by 29 runs" -> team1_id or team2_id
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_resolve_winner(p_match_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_result TEXT;
  v_team1_name TEXT;
  v_team2_name TEXT;
  v_team1_short TEXT;
  v_team2_short TEXT;
  v_team1_id INTEGER;
  v_team2_id INTEGER;
  v_winner_name TEXT;
BEGIN
  SELECT result, team1_name, team2_name, team1_short, team2_short, team1_id, team2_id
  INTO v_result, v_team1_name, v_team2_name, v_team1_short, v_team2_short, v_team1_id, v_team2_id
  FROM cricket_matches
  WHERE id = p_match_id;

  IF v_result IS NULL THEN
    RETURN NULL;
  END IF;

  -- Extract team name from "X won by..." pattern
  v_winner_name := (regexp_match(v_result, '^(.+?)\s+won\s+by', 'i'))[1];

  IF v_winner_name IS NULL THEN
    RETURN NULL; -- tie, abandoned, no result
  END IF;

  -- Match against team names (case-insensitive)
  IF lower(v_team1_name) = lower(v_winner_name)
     OR lower(v_team1_short) = lower(v_winner_name) THEN
    RETURN v_team1_id;
  ELSIF lower(v_team2_name) = lower(v_winner_name)
     OR lower(v_team2_short) = lower(v_winner_name) THEN
    RETURN v_team2_id;
  END IF;

  RETURN NULL; -- no match found
END;
$$ LANGUAGE plpgsql STABLE;

--------------------------------------------------------------------------------
-- admin_finalize_match: auto-resolve winner when p_winner_team_id is NULL
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_finalize_match(
  p_match_id UUID,
  p_man_of_match_cricbuzz_id TEXT DEFAULT NULL,
  p_winner_team_id INTEGER DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_mom_name TEXT;
  v_actual_winner INTEGER;
BEGIN
  -- Auth check — platform admin only
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only platform admins can finalize matches';
  END IF;

  -- Handle winner: sentinel (0 or negative) = no winner, NULL = auto-resolve
  IF p_winner_team_id IS NOT NULL AND p_winner_team_id <= 0 THEN
    v_actual_winner := NULL;
  ELSIF p_winner_team_id IS NOT NULL THEN
    v_actual_winner := p_winner_team_id;
  ELSE
    -- Auto-resolve from result text
    v_actual_winner := auto_resolve_winner(p_match_id);
  END IF;

  -- Look up MoM player name if provided
  IF p_man_of_match_cricbuzz_id IS NOT NULL THEN
    SELECT COALESCE(mp.name, mps.cricbuzz_player_id)
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
    winner_team_id = COALESCE(v_actual_winner, winner_team_id)
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

  -- When no winner (sentinel), set team_won = false for all
  IF p_winner_team_id IS NOT NULL AND p_winner_team_id <= 0 THEN
    UPDATE match_player_stats
    SET team_won = false
    WHERE match_id = p_match_id;
  END IF;

  -- 3. Finalize league_player_match_scores
  UPDATE league_player_match_scores
  SET
    is_live = false,
    finalized_at = COALESCE(finalized_at, NOW())
  WHERE match_id = p_match_id
    AND finalized_at IS NULL;

  -- 4. Mark league_matches as stats_imported
  UPDATE league_matches
  SET
    stats_imported = true,
    stats_imported_at = COALESCE(stats_imported_at, NOW())
  WHERE match_id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

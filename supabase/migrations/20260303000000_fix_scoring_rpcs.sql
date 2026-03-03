-- Fix scoring RPCs: auth checks (H2), week filter in JOINs (H1), no-winner handling (H3)

--------------------------------------------------------------------------------
-- admin_finalize_match: add auth check (H2) + no-winner / tie handling (H3)
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
  -- H2: Auth check — platform admin only
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only platform admins can finalize matches';
  END IF;

  -- H3: Treat sentinel (0 or negative) as "no winner"
  IF p_winner_team_id IS NOT NULL AND p_winner_team_id <= 0 THEN
    v_actual_winner := NULL;
  ELSE
    v_actual_winner := p_winner_team_id;
  END IF;

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
    winner_team_id = CASE
      WHEN p_winner_team_id IS NOT NULL THEN v_actual_winner
      ELSE winner_team_id
    END
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

  -- H3: When no winner (sentinel), set team_won = false for all players in match
  IF p_winner_team_id IS NOT NULL AND p_winner_team_id <= 0 THEN
    UPDATE match_player_stats
    SET team_won = false
    WHERE match_id = p_match_id;
  END IF;

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

--------------------------------------------------------------------------------
-- check_week_finalization_ready: add auth check (H2)
-- Allow platform admin OR league manager
--------------------------------------------------------------------------------
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
  -- H2: Auth check — platform admin or league manager
  IF NOT is_platform_admin() AND NOT is_league_manager_of(p_league_id) THEN
    RAISE EXCEPTION 'Unauthorized: only platform admins or league managers can check week readiness';
  END IF;

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

--------------------------------------------------------------------------------
-- finalize_week: add auth check (H2) + week filter on JOINs (H1)
--------------------------------------------------------------------------------
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
  -- H2: Auth check — platform admin only
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only platform admins can finalize weeks';
  END IF;

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

    -- H1: Calculate manager1 score with C/VC multipliers — filter by week
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
      AND mr.week = p_week
    WHERE lpms.league_id = p_league_id
      AND lpms.week = p_week
      AND lpms.manager_id = v_matchup.manager1_id
      AND lpms.was_in_active_roster = true;

    -- H1: Calculate manager2 score with C/VC multipliers — filter by week
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
      AND mr.week = p_week
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

  -- 3. H1: Update total points for all managers in the league
  -- Join mr.week = lpms.week so each score row uses its own week's roster
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
      AND mr.week = lpms.week
    WHERE lpms.league_id = p_league_id
      AND lpms.was_in_active_roster = true
    GROUP BY lpms.manager_id
  ) sub
  WHERE m.id = sub.manager_id
    AND m.league_id = p_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

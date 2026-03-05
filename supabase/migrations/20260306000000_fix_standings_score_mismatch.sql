-- ============================================================
-- Migration: Fix standings score mismatch & admin override visibility
-- ============================================================
-- Bug #1: get_live_fantasy_standings and get_fantasy_standings did not
--         apply captain/vice-captain multipliers (2x / 1.5x), causing
--         standings to show lower points than team page.
-- Bug #2: admin_update_matchup_scores only wrote to league_matchups
--         but neither standings RPCs nor managers.points reflected
--         the override. Fix: compute delta on the fly and cascade
--         to managers.points.
-- ============================================================

-- 1. Fix get_live_fantasy_standings: add C/VC multipliers + override deltas
DROP FUNCTION IF EXISTS get_live_fantasy_standings(UUID);
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
  WITH cvc_scores AS (
    -- Player scores with C/VC multipliers per manager per week
    SELECT
      lpms.manager_id,
      lpms.week,
      SUM(lpms.total_points * CASE
        WHEN mr.is_captain THEN 2.0
        WHEN mr.is_vice_captain THEN 1.5
        ELSE 1.0
      END) as week_pts,
      SUM(CASE WHEN lpms.is_live THEN
        lpms.total_points * CASE
          WHEN mr.is_captain THEN 2.0
          WHEN mr.is_vice_captain THEN 1.5
          ELSE 1.0
        END
      ELSE 0 END) as live_pts,
      SUM(CASE WHEN NOT lpms.is_live OR lpms.is_live IS NULL THEN
        lpms.total_points * CASE
          WHEN mr.is_captain THEN 2.0
          WHEN mr.is_vice_captain THEN 1.5
          ELSE 1.0
        END
      ELSE 0 END) as finalized_pts,
      BOOL_OR(lpms.is_live) as is_live_week
    FROM league_player_match_scores lpms
    JOIN manager_roster mr ON mr.player_id = lpms.player_id
      AND mr.manager_id = lpms.manager_id
      AND mr.league_id = lpms.league_id
      AND mr.week = lpms.week
    WHERE lpms.league_id = p_league_id
      AND lpms.was_in_active_roster = true
    GROUP BY lpms.manager_id, lpms.week
  ),
  manager_base AS (
    SELECT
      cs.manager_id,
      COALESCE(SUM(cs.week_pts), 0) as base_total,
      COALESCE(SUM(cs.live_pts), 0) as live_total,
      COALESCE(SUM(cs.finalized_pts), 0) as finalized_total
    FROM cvc_scores cs
    GROUP BY cs.manager_id
  ),
  override_adjustments AS (
    -- For admin-overridden matchups, delta = matchup_score - calculated_CVC_score
    SELECT
      vals.mgr_id as manager_id,
      SUM(vals.matchup_score - COALESCE(cs.week_pts, 0)) as adjustment
    FROM league_matchups lm
    CROSS JOIN LATERAL (
      VALUES
        (lm.manager1_id, lm.manager1_score),
        (lm.manager2_id, lm.manager2_score)
    ) AS vals(mgr_id, matchup_score)
    LEFT JOIN cvc_scores cs ON cs.manager_id = vals.mgr_id AND cs.week = lm.week
    WHERE lm.league_id = p_league_id
      AND lm.modified_by IS NOT NULL
      AND vals.mgr_id IS NOT NULL
    GROUP BY vals.mgr_id
  )
  SELECT
    m.id as manager_id,
    m.name as manager_name,
    m.team_name,
    COALESCE(mb.base_total, 0) + COALESCE(oa.adjustment, 0) as total_points,
    COALESCE(mb.live_total, 0) as live_points,
    COALESCE(mb.finalized_total, 0) + COALESCE(oa.adjustment, 0) as finalized_points,
    EXISTS(
      SELECT 1 FROM league_player_match_scores lpms2
      WHERE lpms2.manager_id = m.id
        AND lpms2.league_id = p_league_id
        AND lpms2.is_live = true
    ) as has_live_stats,
    m.wins,
    m.losses,
    RANK() OVER (ORDER BY m.wins DESC,
      COALESCE(mb.base_total, 0) + COALESCE(oa.adjustment, 0) DESC) as rank
  FROM managers m
  LEFT JOIN manager_base mb ON mb.manager_id = m.id
  LEFT JOIN override_adjustments oa ON oa.manager_id = m.id
  WHERE m.league_id = p_league_id
  ORDER BY m.wins DESC, total_points DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Fix get_fantasy_standings (non-live version): same C/VC + override logic
DROP FUNCTION IF EXISTS get_fantasy_standings(UUID);
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
  WITH cvc_scores AS (
    SELECT
      lpms.manager_id,
      lpms.week,
      SUM(lpms.total_points * CASE
        WHEN mr.is_captain THEN 2.0
        WHEN mr.is_vice_captain THEN 1.5
        ELSE 1.0
      END) as week_pts
    FROM league_player_match_scores lpms
    JOIN manager_roster mr ON mr.player_id = lpms.player_id
      AND mr.manager_id = lpms.manager_id
      AND mr.league_id = lpms.league_id
      AND mr.week = lpms.week
    WHERE lpms.league_id = p_league_id
      AND lpms.was_in_active_roster = true
    GROUP BY lpms.manager_id, lpms.week
  ),
  manager_base AS (
    SELECT cs.manager_id, COALESCE(SUM(cs.week_pts), 0) as base_total
    FROM cvc_scores cs
    GROUP BY cs.manager_id
  ),
  override_adjustments AS (
    SELECT
      vals.mgr_id as manager_id,
      SUM(vals.matchup_score - COALESCE(cs.week_pts, 0)) as adjustment
    FROM league_matchups lm
    CROSS JOIN LATERAL (
      VALUES
        (lm.manager1_id, lm.manager1_score),
        (lm.manager2_id, lm.manager2_score)
    ) AS vals(mgr_id, matchup_score)
    LEFT JOIN cvc_scores cs ON cs.manager_id = vals.mgr_id AND cs.week = lm.week
    WHERE lm.league_id = p_league_id
      AND lm.modified_by IS NOT NULL
      AND vals.mgr_id IS NOT NULL
    GROUP BY vals.mgr_id
  )
  SELECT
    m.id as manager_id,
    m.name as manager_name,
    m.team_name,
    COALESCE(mb.base_total, 0) + COALESCE(oa.adjustment, 0) as total_points,
    m.wins,
    m.losses,
    RANK() OVER (ORDER BY m.wins DESC,
      COALESCE(mb.base_total, 0) + COALESCE(oa.adjustment, 0) DESC) as rank
  FROM managers m
  LEFT JOIN manager_base mb ON mb.manager_id = m.id
  LEFT JOIN override_adjustments oa ON oa.manager_id = m.id
  WHERE m.league_id = p_league_id
  ORDER BY m.wins DESC, total_points DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Update admin_update_matchup_scores to cascade delta to managers.points
CREATE OR REPLACE FUNCTION admin_update_matchup_scores(
  p_matchup_id UUID,
  p_manager1_score NUMERIC,
  p_manager2_score NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old RECORD;
  v_new_winner UUID;
  v_delta1 NUMERIC;
  v_delta2 NUMERIC;
BEGIN
  -- Auth check
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only platform admins can update matchup scores';
  END IF;

  -- Load existing matchup
  SELECT id, manager1_id, manager2_id, manager1_score, manager2_score,
         winner_id, is_finalized
    INTO v_old
    FROM league_matchups
   WHERE id = p_matchup_id;

  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Matchup not found: %', p_matchup_id;
  END IF;

  -- Skip BYE matchups
  IF v_old.manager2_id IS NULL THEN
    RAISE EXCEPTION 'Cannot edit BYE matchup scores';
  END IF;

  -- Compute new winner
  v_new_winner := NULL;
  IF p_manager1_score > p_manager2_score THEN
    v_new_winner := v_old.manager1_id;
  ELSIF p_manager2_score > p_manager1_score THEN
    v_new_winner := v_old.manager2_id;
  END IF;

  -- Cascade W/L changes if matchup was finalized and winner changed
  IF v_old.is_finalized THEN
    IF (v_old.winner_id IS DISTINCT FROM v_new_winner) THEN
      -- Reverse old result
      IF v_old.winner_id IS NOT NULL THEN
        UPDATE managers SET wins = GREATEST(wins - 1, 0)
         WHERE id = v_old.winner_id;
        UPDATE managers SET losses = GREATEST(losses - 1, 0)
         WHERE id = CASE
           WHEN v_old.winner_id = v_old.manager1_id THEN v_old.manager2_id
           ELSE v_old.manager1_id
         END;
      END IF;

      -- Apply new result
      IF v_new_winner IS NOT NULL THEN
        UPDATE managers SET wins = wins + 1
         WHERE id = v_new_winner;
        UPDATE managers SET losses = losses + 1
         WHERE id = CASE
           WHEN v_new_winner = v_old.manager1_id THEN v_old.manager2_id
           ELSE v_old.manager1_id
         END;
      END IF;
    END IF;
  END IF;

  -- Cascade score delta to managers.points
  v_delta1 := p_manager1_score - COALESCE(v_old.manager1_score, 0);
  v_delta2 := p_manager2_score - COALESCE(v_old.manager2_score, 0);

  IF v_delta1 <> 0 THEN
    UPDATE managers SET points = points + ROUND(v_delta1)
     WHERE id = v_old.manager1_id;
  END IF;

  IF v_delta2 <> 0 AND v_old.manager2_id IS NOT NULL THEN
    UPDATE managers SET points = points + ROUND(v_delta2)
     WHERE id = v_old.manager2_id;
  END IF;

  -- Update the matchup row
  UPDATE league_matchups
     SET manager1_score = p_manager1_score,
         manager2_score = p_manager2_score,
         winner_id      = v_new_winner,
         modified_by    = auth.uid(),
         modified_at    = NOW()
   WHERE id = p_matchup_id;
END;
$$;

-- 4. Update finalize_week step 3 to preserve override deltas in managers.points
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
  -- Auth check
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
      AND mr.week = p_week
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

  -- 3. Update total points for all managers in the league
  -- Base: sum all active roster points with C/VC multipliers
  -- Plus: admin override deltas from previously overridden matchups
  UPDATE managers m
  SET points = ROUND(sub.total_pts)
  FROM (
    WITH cvc_scores AS (
      SELECT
        lpms.manager_id,
        lpms.week,
        SUM(
          lpms.total_points * CASE
            WHEN mr.is_captain THEN 2.0
            WHEN mr.is_vice_captain THEN 1.5
            ELSE 1.0
          END
        ) as week_pts
      FROM league_player_match_scores lpms
      JOIN manager_roster mr ON mr.player_id = lpms.player_id
        AND mr.manager_id = lpms.manager_id
        AND mr.league_id = lpms.league_id
        AND mr.week = lpms.week
      WHERE lpms.league_id = p_league_id
        AND lpms.was_in_active_roster = true
      GROUP BY lpms.manager_id, lpms.week
    ),
    override_adj AS (
      SELECT
        vals.mgr_id as manager_id,
        SUM(vals.matchup_score - COALESCE(cs.week_pts, 0)) as adjustment
      FROM league_matchups lm
      CROSS JOIN LATERAL (
        VALUES
          (lm.manager1_id, lm.manager1_score),
          (lm.manager2_id, lm.manager2_score)
      ) AS vals(mgr_id, matchup_score)
      LEFT JOIN cvc_scores cs ON cs.manager_id = vals.mgr_id AND cs.week = lm.week
      WHERE lm.league_id = p_league_id
        AND lm.modified_by IS NOT NULL
        AND vals.mgr_id IS NOT NULL
      GROUP BY vals.mgr_id
    )
    SELECT
      cs.manager_id,
      COALESCE(SUM(cs.week_pts), 0) + COALESCE(MAX(oa.adjustment), 0) as total_pts
    FROM cvc_scores cs
    LEFT JOIN override_adj oa ON oa.manager_id = cs.manager_id
    GROUP BY cs.manager_id
  ) sub
  WHERE m.id = sub.manager_id
    AND m.league_id = p_league_id;

  -- Also update managers who have ONLY override deltas (no player scores, e.g. empty teams)
  UPDATE managers m
  SET points = ROUND(oa_only.adjustment)
  FROM (
    WITH cvc_scores AS (
      SELECT
        lpms.manager_id,
        lpms.week,
        SUM(
          lpms.total_points * CASE
            WHEN mr.is_captain THEN 2.0
            WHEN mr.is_vice_captain THEN 1.5
            ELSE 1.0
          END
        ) as week_pts
      FROM league_player_match_scores lpms
      JOIN manager_roster mr ON mr.player_id = lpms.player_id
        AND mr.manager_id = lpms.manager_id
        AND mr.league_id = lpms.league_id
        AND mr.week = lpms.week
      WHERE lpms.league_id = p_league_id
        AND lpms.was_in_active_roster = true
      GROUP BY lpms.manager_id, lpms.week
    )
    SELECT
      vals.mgr_id as manager_id,
      SUM(vals.matchup_score - COALESCE(cs.week_pts, 0)) as adjustment
    FROM league_matchups lm
    CROSS JOIN LATERAL (
      VALUES
        (lm.manager1_id, lm.manager1_score),
        (lm.manager2_id, lm.manager2_score)
    ) AS vals(mgr_id, matchup_score)
    LEFT JOIN cvc_scores cs ON cs.manager_id = vals.mgr_id AND cs.week = lm.week
    WHERE lm.league_id = p_league_id
      AND lm.modified_by IS NOT NULL
      AND vals.mgr_id IS NOT NULL
      AND vals.mgr_id NOT IN (SELECT DISTINCT cs2.manager_id FROM cvc_scores cs2)
    GROUP BY vals.mgr_id
  ) oa_only
  WHERE m.id = oa_only.manager_id
    AND m.league_id = p_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

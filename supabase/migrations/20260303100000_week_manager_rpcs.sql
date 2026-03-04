-- Week Manager RPCs: manage match-to-week assignments

-- 1. update_match_week: reassign a single match to a new week (or NULL to unassign)
CREATE OR REPLACE FUNCTION update_match_week(
  p_league_id UUID,
  p_match_id UUID,
  p_new_week INTEGER  -- NULL means unassign
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_week INTEGER;
  v_stats_imported BOOLEAN;
  v_week_finalized BOOLEAN;
BEGIN
  -- Auth: platform admin or league manager
  IF NOT is_platform_admin() AND NOT is_league_manager_of(p_league_id) THEN
    RAISE EXCEPTION 'Unauthorized: only platform admins or league managers can update match weeks';
  END IF;

  -- Get current state of this league_match
  SELECT lm.week, COALESCE(lm.stats_imported, false)
  INTO v_current_week, v_stats_imported
  FROM league_matches lm
  WHERE lm.league_id = p_league_id AND lm.match_id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found in this league';
  END IF;

  -- Guard: cannot move a match whose stats are already imported
  IF v_stats_imported THEN
    RAISE EXCEPTION 'Cannot reassign match: stats already imported';
  END IF;

  -- Guard: cannot move out of a finalized week
  IF v_current_week IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM league_matchups
      WHERE league_id = p_league_id
        AND week = v_current_week
        AND is_finalized = true
    ) INTO v_week_finalized;

    IF v_week_finalized THEN
      RAISE EXCEPTION 'Cannot reassign match: week % is already finalized', v_current_week;
    END IF;
  END IF;

  -- Guard: cannot move into a finalized week
  IF p_new_week IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM league_matchups
      WHERE league_id = p_league_id
        AND week = p_new_week
        AND is_finalized = true
    ) INTO v_week_finalized;

    IF v_week_finalized THEN
      RAISE EXCEPTION 'Cannot assign match to week %: week is already finalized', p_new_week;
    END IF;
  END IF;

  -- Perform the update
  UPDATE league_matches
  SET week = p_new_week
  WHERE league_id = p_league_id AND match_id = p_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_match_week(UUID, UUID, INTEGER) TO authenticated;

-- 2. bulk_update_match_weeks: batch reassignment from JSONB array
-- Input: [{"match_id": "uuid-here", "week": 2}, ...]
CREATE OR REPLACE FUNCTION bulk_update_match_weeks(
  p_league_id UUID,
  p_assignments JSONB
)
RETURNS TABLE (updated_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment JSONB;
  v_match_id UUID;
  v_week INTEGER;
  v_count INTEGER := 0;
BEGIN
  -- Auth: platform admin or league manager
  IF NOT is_platform_admin() AND NOT is_league_manager_of(p_league_id) THEN
    RAISE EXCEPTION 'Unauthorized: only platform admins or league managers can update match weeks';
  END IF;

  FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    v_match_id := (v_assignment->>'match_id')::UUID;
    v_week := (v_assignment->>'week')::INTEGER;  -- can be null

    -- Delegate to update_match_week for per-match guards
    PERFORM update_match_week(p_league_id, v_match_id, v_week);
    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_update_match_weeks(UUID, JSONB) TO authenticated;

-- 3. auto_generate_weeks: group unassigned matches into N-day windows
-- Returns preview (does NOT apply changes)
CREATE OR REPLACE FUNCTION auto_generate_weeks(
  p_league_id UUID,
  p_interval_days INTEGER DEFAULT 7
)
RETURNS TABLE (match_id UUID, match_title TEXT, match_date TIMESTAMPTZ, proposed_week INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
BEGIN
  -- Auth: platform admin or league manager
  IF NOT is_platform_admin() AND NOT is_league_manager_of(p_league_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Find the earliest match date among unassigned matches
  SELECT MIN(cm.match_date)
  INTO v_start_date
  FROM league_matches lm
  JOIN cricket_matches cm ON cm.id = lm.match_id
  WHERE lm.league_id = p_league_id
    AND lm.week IS NULL
    AND COALESCE(lm.stats_imported, false) = false;

  IF v_start_date IS NULL THEN
    -- No unassigned matches, return empty
    RETURN;
  END IF;

  -- Find the highest existing week number to offset new weeks
  -- so auto-generate doesn't collide with existing week numbers
  RETURN QUERY
  WITH max_week AS (
    SELECT COALESCE(MAX(lm2.week), 0) AS mw
    FROM league_matches lm2
    WHERE lm2.league_id = p_league_id AND lm2.week IS NOT NULL
  )
  SELECT
    lm.match_id,
    COALESCE(cm.match_title, cm.team1_name || ' vs ' || cm.team2_name) AS match_title,
    cm.match_date,
    (mw.mw + 1 + FLOOR(EXTRACT(EPOCH FROM (cm.match_date - v_start_date)) / (p_interval_days * 86400))::INTEGER) AS proposed_week
  FROM league_matches lm
  JOIN cricket_matches cm ON cm.id = lm.match_id
  CROSS JOIN max_week mw
  WHERE lm.league_id = p_league_id
    AND lm.week IS NULL
    AND COALESCE(lm.stats_imported, false) = false
  ORDER BY cm.match_date;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_generate_weeks(UUID, INTEGER) TO authenticated;

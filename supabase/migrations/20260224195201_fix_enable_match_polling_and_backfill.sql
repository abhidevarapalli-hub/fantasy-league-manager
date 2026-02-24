-- Migration: Fix broken match polling pipeline
-- Root cause: enable_match_polling omits match_id column (NOT NULL constraint)
-- Also: get_matches_needing_backfill only finds state='Complete' matches (none exist)

-- ============================================
-- 1a. Replace enable_match_polling to accept and insert match_id
-- ============================================
DROP FUNCTION IF EXISTS enable_match_polling(INTEGER, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION enable_match_polling(
  p_cricbuzz_match_id INTEGER,
  p_match_id UUID,
  p_initial_state TEXT DEFAULT 'Upcoming',
  p_auto BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO live_match_polling (cricbuzz_match_id, match_id, match_state, polling_enabled, auto_enabled)
  VALUES (p_cricbuzz_match_id, p_match_id, p_initial_state, true, true)
  ON CONFLICT (cricbuzz_match_id)
  DO UPDATE SET
    match_id = COALESCE(EXCLUDED.match_id, live_match_polling.match_id),
    polling_enabled = true,
    match_state = EXCLUDED.match_state,
    auto_enabled = CASE WHEN p_auto THEN live_match_polling.auto_enabled ELSE true END,
    error_count = 0,
    last_error = NULL,
    consecutive_errors = 0,
    circuit_state = 'closed',
    circuit_opened_at = NULL,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions (new signature has 4 params)
GRANT EXECUTE ON FUNCTION enable_match_polling(INTEGER, UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION enable_match_polling(INTEGER, UUID, TEXT, BOOLEAN) TO service_role;

-- ============================================
-- 1b. Widen get_matches_needing_backfill to find matches by date
-- Matches may not have state='Complete' if they were never polled,
-- but if match_date is >3 hours in the past, they're certainly done
-- ============================================
CREATE OR REPLACE FUNCTION get_matches_needing_backfill(p_max_results INTEGER DEFAULT 3)
RETURNS TABLE (
  cricbuzz_match_id BIGINT,
  match_id UUID,
  match_description TEXT,
  match_date TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    cm.cricbuzz_match_id,
    cm.id AS match_id,
    cm.match_description,
    cm.match_date
  FROM cricket_matches cm
  WHERE
    -- Match is complete by state/result OR match_date is well past
    (
      cm.state = 'Complete'
      OR cm.result ~* '\bwon\b'
      OR cm.match_date < NOW() - INTERVAL '3 hours'
    )
    -- Match belongs to at least one league
    AND EXISTS (SELECT 1 FROM league_matches lm WHERE lm.match_id = cm.id)
    -- No stats have ever been imported for this match
    AND NOT EXISTS (SELECT 1 FROM match_player_stats mps WHERE mps.match_id = cm.id)
    -- Has a valid cricbuzz ID for API lookup
    AND cm.cricbuzz_match_id IS NOT NULL
    AND cm.cricbuzz_match_id > 0
  ORDER BY cm.match_date ASC NULLS LAST
  LIMIT p_max_results;
$$;

GRANT EXECUTE ON FUNCTION get_matches_needing_backfill(INTEGER) TO service_role;

-- ============================================
-- 1c. Create bulk_activate_stale_matches() RPC
-- Inserts live_match_polling rows for all past, league-linked matches
-- that have no polling record. Uses ON CONFLICT DO NOTHING for idempotency.
-- ============================================
CREATE OR REPLACE FUNCTION bulk_activate_stale_matches()
RETURNS TABLE (rows_inserted BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  INSERT INTO live_match_polling (cricbuzz_match_id, match_id, match_state, polling_enabled, auto_enabled)
  SELECT
    cm.cricbuzz_match_id,
    cm.id,
    CASE
      WHEN cm.state = 'Complete' OR cm.result ~* '\bwon\b' THEN 'Complete'
      WHEN cm.match_date < NOW() - INTERVAL '3 hours' THEN 'Complete'
      WHEN cm.match_date < NOW() THEN 'Live'
      ELSE 'Upcoming'
    END,
    true,
    true
  FROM cricket_matches cm
  WHERE
    -- Match date is in the past (or within a few hours)
    cm.match_date < NOW() + INTERVAL '1 hour'
    -- Must belong to at least one league
    AND EXISTS (SELECT 1 FROM league_matches lm WHERE lm.match_id = cm.id)
    -- No existing polling row
    AND NOT EXISTS (
      SELECT 1 FROM live_match_polling lmp
      WHERE lmp.cricbuzz_match_id = cm.cricbuzz_match_id
    )
    -- Has valid cricbuzz ID
    AND cm.cricbuzz_match_id IS NOT NULL
    AND cm.cricbuzz_match_id > 0
  ON CONFLICT (cricbuzz_match_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_activate_stale_matches() TO service_role;

-- ============================================
-- 1d. Populate cricket_matches.match_week for series 11253
-- Tournament: Feb 7 - Mar 8, 2026
-- Group stage: Feb 7-12 (Week 1), Feb 13-19 (Week 2)
-- Super 8s: Feb 20-25 (Week 3), Feb 26-Mar 1 (Week 4)
-- Semi-finals: Mar 4-5 (Week 5)
-- Final: Mar 8 (Week 6)
-- ============================================
UPDATE cricket_matches
SET match_week = CASE
  WHEN match_date < '2026-02-13 00:00:00+00' THEN 1
  WHEN match_date < '2026-02-20 00:00:00+00' THEN 2
  WHEN match_date < '2026-02-26 00:00:00+00' THEN 3
  WHEN match_date < '2026-03-02 00:00:00+00' THEN 4
  WHEN match_date < '2026-03-06 00:00:00+00' THEN 5
  ELSE 6
END
WHERE series_id = 11253
  AND match_week IS NULL;

-- ============================================
-- 1e. Propagate match_week to league_matches.week
-- ============================================
UPDATE league_matches lm
SET week = cm.match_week
FROM cricket_matches cm
WHERE lm.match_id = cm.id
  AND cm.series_id = 11253
  AND cm.match_week IS NOT NULL
  AND (lm.week IS NULL OR lm.week != cm.match_week);

-- Migration: Live Stats Polling System
-- Description: Backend polling infrastructure for live cricket match stats
-- Purpose: Auto-poll live matches, calculate fantasy points, finalize when complete

-- ============================================
-- New Table: live_match_polling
-- Tracks which matches need polling and prevents duplicate polls
-- ============================================
CREATE TABLE IF NOT EXISTS live_match_polling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cricbuzz_match_id INTEGER NOT NULL UNIQUE,
  match_state TEXT DEFAULT 'Upcoming' CHECK (match_state IN ('Upcoming', 'Live', 'Complete')),
  polling_enabled BOOLEAN DEFAULT false,
  auto_enabled BOOLEAN DEFAULT true,  -- False if admin manually disabled
  last_polled_at TIMESTAMPTZ,
  poll_count INTEGER DEFAULT 0,
  polling_lock_until TIMESTAMPTZ,     -- Distributed lock for concurrent poll prevention
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient polling queries
CREATE INDEX IF NOT EXISTS idx_live_match_polling_enabled ON live_match_polling(polling_enabled) WHERE polling_enabled = true;
CREATE INDEX IF NOT EXISTS idx_live_match_polling_state ON live_match_polling(match_state);
CREATE INDEX IF NOT EXISTS idx_live_match_polling_lock ON live_match_polling(polling_lock_until);

-- ============================================
-- Modify: player_match_stats - Add live stats tracking
-- ============================================
ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS is_live_stats BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

-- Index for live stats queries
CREATE INDEX IF NOT EXISTS idx_player_match_stats_live ON player_match_stats(is_live_stats) WHERE is_live_stats = true;
CREATE INDEX IF NOT EXISTS idx_player_match_stats_finalized ON player_match_stats(finalized_at);

-- ============================================
-- Modify: cricket_matches - Add Man of Match and polling fields
-- ============================================
ALTER TABLE cricket_matches
  ADD COLUMN IF NOT EXISTS man_of_match_id TEXT,
  ADD COLUMN IF NOT EXISTS man_of_match_name TEXT,
  ADD COLUMN IF NOT EXISTS polling_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS match_state TEXT DEFAULT 'Upcoming' CHECK (match_state IN ('Upcoming', 'Live', 'Complete'));

-- Index for match state queries
CREATE INDEX IF NOT EXISTS idx_cricket_matches_state ON cricket_matches(match_state);
CREATE INDEX IF NOT EXISTS idx_cricket_matches_polling ON cricket_matches(polling_enabled) WHERE polling_enabled = true;

-- ============================================
-- Function: Acquire polling lock for a match
-- Returns true if lock acquired, false otherwise
-- ============================================
CREATE OR REPLACE FUNCTION acquire_polling_lock(
  p_cricbuzz_match_id INTEGER,
  p_lock_duration_seconds INTEGER DEFAULT 90
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE live_match_polling
  SET
    polling_lock_until = NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL,
    updated_at = NOW()
  WHERE cricbuzz_match_id = p_cricbuzz_match_id
    AND polling_enabled = true
    AND (polling_lock_until IS NULL OR polling_lock_until < NOW())
  RETURNING 1 INTO v_updated;

  RETURN v_updated IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Release polling lock for a match
-- ============================================
CREATE OR REPLACE FUNCTION release_polling_lock(
  p_cricbuzz_match_id INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE live_match_polling
  SET
    polling_lock_until = NULL,
    updated_at = NOW()
  WHERE cricbuzz_match_id = p_cricbuzz_match_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Record successful poll
-- ============================================
CREATE OR REPLACE FUNCTION record_poll_success(
  p_cricbuzz_match_id INTEGER,
  p_match_state TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE live_match_polling
  SET
    last_polled_at = NOW(),
    poll_count = poll_count + 1,
    polling_lock_until = NULL,
    error_count = 0,
    last_error = NULL,
    match_state = COALESCE(p_match_state, match_state),
    polling_enabled = CASE WHEN p_match_state = 'Complete' THEN false ELSE polling_enabled END,
    updated_at = NOW()
  WHERE cricbuzz_match_id = p_cricbuzz_match_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Record poll error
-- ============================================
CREATE OR REPLACE FUNCTION record_poll_error(
  p_cricbuzz_match_id INTEGER,
  p_error_message TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE live_match_polling
  SET
    error_count = error_count + 1,
    last_error = p_error_message,
    polling_lock_until = NULL,
    -- Disable polling after 5 consecutive errors
    polling_enabled = CASE WHEN error_count >= 4 THEN false ELSE polling_enabled END,
    updated_at = NOW()
  WHERE cricbuzz_match_id = p_cricbuzz_match_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Get matches that need polling
-- ============================================
CREATE OR REPLACE FUNCTION get_matches_to_poll()
RETURNS TABLE (
  cricbuzz_match_id INTEGER,
  match_state TEXT,
  last_polled_at TIMESTAMPTZ,
  poll_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lmp.cricbuzz_match_id,
    lmp.match_state,
    lmp.last_polled_at,
    lmp.poll_count
  FROM live_match_polling lmp
  WHERE lmp.polling_enabled = true
    AND (lmp.polling_lock_until IS NULL OR lmp.polling_lock_until < NOW())
  ORDER BY lmp.last_polled_at NULLS FIRST;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Function: Enable polling for a match
-- Creates entry if not exists
-- ============================================
CREATE OR REPLACE FUNCTION enable_match_polling(
  p_cricbuzz_match_id INTEGER,
  p_initial_state TEXT DEFAULT 'Live'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO live_match_polling (cricbuzz_match_id, match_state, polling_enabled)
  VALUES (p_cricbuzz_match_id, p_initial_state, true)
  ON CONFLICT (cricbuzz_match_id)
  DO UPDATE SET
    polling_enabled = true,
    match_state = EXCLUDED.match_state,
    error_count = 0,
    last_error = NULL,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Disable polling for a match
-- ============================================
CREATE OR REPLACE FUNCTION disable_match_polling(
  p_cricbuzz_match_id INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE live_match_polling
  SET
    polling_enabled = false,
    auto_enabled = false,  -- Mark as manually disabled
    updated_at = NOW()
  WHERE cricbuzz_match_id = p_cricbuzz_match_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Get leagues for a Cricbuzz match
-- Used by poller to find all leagues with this match
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
    cm.league_id,
    cm.id as match_id,
    l.scoring_rules
  FROM cricket_matches cm
  JOIN leagues l ON l.id = cm.league_id
  WHERE cm.cricbuzz_match_id = p_cricbuzz_match_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Function: Finalize match stats
-- Marks stats as final when match completes
-- ============================================
CREATE OR REPLACE FUNCTION finalize_match_stats(
  p_league_id UUID,
  p_match_id UUID,
  p_man_of_match_cricbuzz_id TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Update all stats for this match to finalized
  UPDATE player_match_stats
  SET
    is_live_stats = false,
    finalized_at = NOW(),
    is_man_of_match = CASE
      WHEN p_man_of_match_cricbuzz_id IS NOT NULL
        AND cricbuzz_player_id = p_man_of_match_cricbuzz_id
      THEN true
      ELSE is_man_of_match
    END
  WHERE league_id = p_league_id
    AND match_id = p_match_id
    AND finalized_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Update the match record
  UPDATE cricket_matches
  SET
    match_state = 'Complete',
    man_of_match_id = COALESCE(p_man_of_match_cricbuzz_id, man_of_match_id),
    stats_imported = true,
    stats_imported_at = NOW()
  WHERE id = p_match_id;

  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Get live stats summary for standings
-- Returns manager standings including live stats
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
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as manager_id,
    m.name as manager_name,
    m.team_name,
    COALESCE(SUM(pms.fantasy_points), 0) as total_points,
    COALESCE(SUM(CASE WHEN pms.is_live_stats THEN pms.fantasy_points ELSE 0 END), 0) as live_points,
    COALESCE(SUM(CASE WHEN NOT pms.is_live_stats OR pms.is_live_stats IS NULL THEN pms.fantasy_points ELSE 0 END), 0) as finalized_points,
    EXISTS(
      SELECT 1 FROM player_match_stats pms2
      WHERE pms2.manager_id = m.id
        AND pms2.league_id = p_league_id
        AND pms2.is_live_stats = true
    ) as has_live_stats,
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
-- Trigger: Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_live_match_polling_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_match_polling_updated_at ON live_match_polling;
CREATE TRIGGER live_match_polling_updated_at
  BEFORE UPDATE ON live_match_polling
  FOR EACH ROW
  EXECUTE FUNCTION update_live_match_polling_timestamp();

-- ============================================
-- RLS Policies for live_match_polling
-- ============================================
ALTER TABLE live_match_polling ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read polling status
CREATE POLICY "Users can read polling status"
  ON live_match_polling
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow updates through functions (service role)
-- No direct INSERT/UPDATE/DELETE policies for regular users

-- ============================================
-- Grant permissions
-- ============================================
GRANT SELECT ON live_match_polling TO authenticated;
GRANT EXECUTE ON FUNCTION acquire_polling_lock(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION release_polling_lock(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION record_poll_success(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_poll_error(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_matches_to_poll() TO authenticated;
GRANT EXECUTE ON FUNCTION enable_match_polling(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION disable_match_polling(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_leagues_for_cricbuzz_match(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_match_stats(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_live_fantasy_standings(UUID) TO authenticated;

-- Grant to service role for Edge Functions
GRANT ALL ON live_match_polling TO service_role;
GRANT EXECUTE ON FUNCTION acquire_polling_lock(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION release_polling_lock(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION record_poll_success(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION record_poll_error(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_matches_to_poll() TO service_role;
GRANT EXECUTE ON FUNCTION enable_match_polling(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION disable_match_polling(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_leagues_for_cricbuzz_match(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION finalize_match_stats(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_live_fantasy_standings(UUID) TO service_role;

-- ============================================
-- Note on pg_cron setup
-- ============================================
-- pg_cron must be enabled by Supabase dashboard or support
-- Once enabled, run this to set up automatic polling:
--
-- SELECT cron.schedule(
--   'poll-live-matches',
--   '* * * * *',  -- Every minute
--   $$
--   SELECT net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/poll-trigger',
--     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{}'::jsonb
--   )
--   $$
-- );

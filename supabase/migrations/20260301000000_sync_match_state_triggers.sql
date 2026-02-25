-- Migration: Sync match state from live_match_polling to cricket_matches
--
-- Problem: live_match_polling.match_state and cricket_matches.state can diverge.
-- The poller updates cricket_matches.state directly AND live_match_polling.match_state
-- via record_poll_success(). If either update fails or runs out of order, the tables
-- diverge and the frontend (which reads cricket_matches.state) shows stale state.
--
-- Fix: When live_match_polling.match_state changes, auto-propagate to cricket_matches.state.
-- This provides a safety net — even if the poller's direct update to cricket_matches fails,
-- the trigger ensures state eventually converges.

-- ============================================
-- Trigger: live_match_polling → cricket_matches
-- When record_poll_success() updates match_state,
-- propagate the change to cricket_matches.state
-- ============================================
CREATE OR REPLACE FUNCTION sync_polling_state_to_cricket_matches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only act when match_state actually changed
  IF NEW.match_state IS DISTINCT FROM OLD.match_state THEN
    UPDATE cricket_matches
    SET state = NEW.match_state
    WHERE cricbuzz_match_id = NEW.cricbuzz_match_id
      AND state IS DISTINCT FROM NEW.match_state;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_polling_state ON live_match_polling;
CREATE TRIGGER trg_sync_polling_state
  AFTER UPDATE ON live_match_polling
  FOR EACH ROW
  EXECUTE FUNCTION sync_polling_state_to_cricket_matches();

-- ============================================
-- Backfill: Propagate current live_match_polling states to cricket_matches
-- in case live_match_polling has a more up-to-date state
-- Only propagate "forward" transitions (Upcoming→Live→Complete)
-- ============================================
UPDATE cricket_matches cm
SET state = lmp.match_state
FROM live_match_polling lmp
WHERE cm.cricbuzz_match_id = lmp.cricbuzz_match_id
  AND lmp.match_state IS NOT NULL
  AND cm.state IS DISTINCT FROM lmp.match_state
  AND CASE lmp.match_state
    WHEN 'Complete' THEN 3
    WHEN 'Live' THEN 2
    WHEN 'Upcoming' THEN 1
    ELSE 0
  END > CASE cm.state
    WHEN 'Complete' THEN 3
    WHEN 'Live' THEN 2
    WHEN 'Upcoming' THEN 1
    ELSE 0
  END;

-- ============================================
-- Grants
-- ============================================
GRANT EXECUTE ON FUNCTION sync_polling_state_to_cricket_matches() TO service_role;

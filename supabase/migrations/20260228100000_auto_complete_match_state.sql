-- Automatically set cricket_matches.state to 'Complete' when the result
-- column is updated to contain a winner (e.g. "India won by 46 runs").
-- This eliminates the need for manual backfills — any code path that writes
-- the result (admin sync, live-stats-poller, manual scorecard fetch) will
-- also fix the state as a side-effect.

CREATE OR REPLACE FUNCTION auto_complete_match_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only act when result changed AND state isn't already 'Complete'
  IF NEW.result IS DISTINCT FROM OLD.result
     AND NEW.state IS DISTINCT FROM 'Complete'
     AND NEW.result ~* '\bwon\b'
  THEN
    NEW.state := 'Complete';
  END IF;

  RETURN NEW;
END;
$$;

-- Fire BEFORE UPDATE so we can mutate the row in-place
DROP TRIGGER IF EXISTS trg_auto_complete_match_state ON cricket_matches;
CREATE TRIGGER trg_auto_complete_match_state
  BEFORE UPDATE ON cricket_matches
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_match_state();

-- Also handle a reconciliation pass for the lifecycle manager.
-- This function can be called periodically to fix any stale rows
-- that slipped through (e.g. result was set before the trigger existed).
CREATE OR REPLACE FUNCTION reconcile_match_states()
RETURNS TABLE (rows_updated INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  UPDATE cricket_matches
  SET state = 'Complete'
  WHERE state IS DISTINCT FROM 'Complete'
    AND result ~* '\bwon\b';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN QUERY SELECT v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION reconcile_match_states() TO service_role;
GRANT EXECUTE ON FUNCTION reconcile_match_states() TO authenticated;

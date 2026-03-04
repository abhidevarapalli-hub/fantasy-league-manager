-- Fix: prevent cricket_matches.state from being overwritten back to 'Live'
-- after it has reached 'Complete'.
--
-- Root cause: multiple writers (admin sync, live-stats-poller) update
-- cricket_matches directly, bypassing the polling-sync trigger.  The old
-- auto_complete_match_state() trigger only looked at the result text for
-- "won" — it missed abandoned matches, ties, draws, and (critically) did
-- nothing to prevent a backward Complete→Live transition.
--
-- This migration:
-- 1. Replaces the trigger function with one that enforces Complete as terminal
-- 2. Cross-checks live_match_polling as source of truth
-- 3. Expands result-pattern matching (abandoned, no result, tied, draw)
-- 4. Updates reconcile_match_states() to match the same expanded patterns
-- 5. Backfills the 2 currently-desynced rows

-- 1. Enhanced trigger function
CREATE OR REPLACE FUNCTION auto_complete_match_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_polling_state TEXT;
BEGIN
  -- Prevent backward transitions: Complete is a terminal state.
  -- No matter what the caller sets, we keep it Complete.
  IF OLD.state = 'Complete' THEN
    NEW.state := 'Complete';
    RETURN NEW;
  END IF;

  -- Cross-check the polling table as the authoritative source of truth.
  SELECT match_state INTO v_polling_state
  FROM live_match_polling
  WHERE cricbuzz_match_id = NEW.cricbuzz_match_id
  LIMIT 1;

  IF v_polling_state = 'Complete' THEN
    NEW.state := 'Complete';
    RETURN NEW;
  END IF;

  -- Auto-complete from result text (expanded patterns).
  IF NEW.result IS DISTINCT FROM OLD.result
     AND NEW.state IS DISTINCT FROM 'Complete'
     AND NEW.result ~* '(\ywon\y|abandoned|no result|\ytied\y|\ydraw\y)'
  THEN
    NEW.state := 'Complete';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Updated reconcile function with same expanded patterns
CREATE OR REPLACE FUNCTION reconcile_match_states()
RETURNS TABLE (rows_updated INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  -- Reconcile from polling table
  UPDATE cricket_matches cm
  SET state = 'Complete'
  FROM live_match_polling lmp
  WHERE cm.cricbuzz_match_id = lmp.cricbuzz_match_id
    AND lmp.match_state = 'Complete'
    AND cm.state IS DISTINCT FROM 'Complete';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Reconcile from result text (expanded patterns)
  UPDATE cricket_matches
  SET state = 'Complete'
  WHERE state IS DISTINCT FROM 'Complete'
    AND result ~* '(\ywon\y|abandoned|no result|\ytied\y|\ydraw\y)';

  v_updated := v_updated + ROW_COUNT;

  RETURN QUERY SELECT v_updated;
END;
$$;

-- 3. Backfill: sync any rows where polling says Complete but cricket_matches disagrees
UPDATE cricket_matches cm
SET state = 'Complete'
FROM live_match_polling lmp
WHERE cm.cricbuzz_match_id = lmp.cricbuzz_match_id
  AND lmp.match_state = 'Complete'
  AND cm.state IS DISTINCT FROM 'Complete';

-- Also catch result-based completions that the old trigger missed
UPDATE cricket_matches
SET state = 'Complete'
WHERE state IS DISTINCT FROM 'Complete'
  AND result ~* '(\ywon\y|abandoned|no result|\ytied\y|\ydraw\y)';

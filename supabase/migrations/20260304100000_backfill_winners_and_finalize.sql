-- Fix broken \b word boundaries in PostgreSQL regex (POSIX uses \y, not \b)
-- and backfill winner_team_id + stats_imported for completed matches.
--
-- Root cause: All regex patterns using \bwon\b silently fail in PostgreSQL
-- because \b is PCRE syntax, not POSIX. This broke:
--   - auto_complete_match_state trigger (never auto-set state to 'Complete')
--   - reconcile_match_states function (never reconciled stale rows)
--   - auto_resolve_winner (called with wrong regex in WHERE clauses)

--------------------------------------------------------------------------------
-- 1. Fix auto_complete_match_state trigger function
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_complete_match_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.result IS DISTINCT FROM OLD.result
     AND NEW.state IS DISTINCT FROM 'Complete'
     AND NEW.result ~* '\ywon\y'
  THEN
    NEW.state := 'Complete';
  END IF;

  RETURN NEW;
END;
$$;

--------------------------------------------------------------------------------
-- 2. Fix reconcile_match_states function
--------------------------------------------------------------------------------
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
    AND result ~* '\ywon\y';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN QUERY SELECT v_updated;
END;
$$;

--------------------------------------------------------------------------------
-- 3. Backfill winner_team_id from result text (e.g. "India won by 29 runs")
--------------------------------------------------------------------------------
UPDATE cricket_matches
SET winner_team_id = auto_resolve_winner(id)
WHERE winner_team_id IS NULL
  AND result IS NOT NULL
  AND result ~* '\ywon\y';

--------------------------------------------------------------------------------
-- 4. Also fix state for abandoned/no-result matches stuck in non-Complete state
--------------------------------------------------------------------------------
UPDATE cricket_matches
SET state = 'Complete'
WHERE state IS DISTINCT FROM 'Complete'
  AND result IS NOT NULL
  AND result != ''
  AND result ~* '(abandon|no result|cancelled|tied)';

--------------------------------------------------------------------------------
-- 5. Mark all completed matches as finalized in league_matches
--------------------------------------------------------------------------------
UPDATE league_matches lm
SET
  stats_imported = true,
  stats_imported_at = COALESCE(lm.stats_imported_at, NOW())
FROM cricket_matches cm
WHERE lm.match_id = cm.id
  AND cm.state = 'Complete'
  AND lm.stats_imported IS NOT TRUE;

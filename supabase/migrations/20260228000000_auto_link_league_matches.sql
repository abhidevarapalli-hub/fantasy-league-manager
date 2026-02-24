-- Auto-link cricket matches to leagues based on tournament_id / series_id.
-- Called by match-lifecycle-manager before checking for upcoming matches.
-- This ensures league_matches rows exist without needing manual admin sync.

CREATE OR REPLACE FUNCTION auto_link_league_matches()
RETURNS TABLE (
  rows_inserted INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  -- Insert league_matches for any cricket_match whose series_id matches
  -- a league's tournament_id, where the link doesn't already exist.
  INSERT INTO league_matches (league_id, match_id, week)
  SELECT
    l.id AS league_id,
    cm.id AS match_id,
    cm.match_week
  FROM cricket_matches cm
  JOIN leagues l ON l.tournament_id = cm.series_id
  WHERE NOT EXISTS (
    SELECT 1 FROM league_matches lm
    WHERE lm.league_id = l.id
      AND lm.match_id = cm.id
  )
  ON CONFLICT (league_id, match_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN QUERY SELECT v_inserted;
END;
$$;

-- Grant access so edge functions (service_role) can call it
GRANT EXECUTE ON FUNCTION auto_link_league_matches() TO service_role;
GRANT EXECUTE ON FUNCTION auto_link_league_matches() TO authenticated;

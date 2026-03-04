-- Fix auto_generate_weeks: anchor week numbering to the earliest match in the
-- league (not just unassigned matches) so weeks always start at 1.
-- Removes the max_week offset that caused week numbers to skip past existing ones.

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

  -- Anchor: earliest match date across ALL league matches (for consistent numbering)
  SELECT MIN(cm.match_date) INTO v_start_date
  FROM league_matches lm
  JOIN cricket_matches cm ON cm.id = lm.match_id
  WHERE lm.league_id = p_league_id;

  IF v_start_date IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT lm.match_id,
         COALESCE(cm.match_description, cm.team1_name || ' vs ' || cm.team2_name),
         cm.match_date,
         (1 + FLOOR(EXTRACT(EPOCH FROM (cm.match_date - v_start_date)) / (p_interval_days * 86400))::INTEGER)
  FROM league_matches lm
  JOIN cricket_matches cm ON cm.id = lm.match_id
  WHERE lm.league_id = p_league_id
    AND lm.week IS NULL
    AND COALESCE(lm.stats_imported, false) = false
  ORDER BY cm.match_date;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_generate_weeks(UUID, INTEGER) TO authenticated;

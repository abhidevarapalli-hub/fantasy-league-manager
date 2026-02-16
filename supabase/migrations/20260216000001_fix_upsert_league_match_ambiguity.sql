-- Fix ambiguous column reference in upsert_league_match.
-- The RETURNS TABLE columns (match_id, league_match_id) clash with
-- table columns of the same name inside the function body.
-- Rename output columns to out_* to resolve the ambiguity.

DROP FUNCTION IF EXISTS upsert_league_match(UUID, INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION upsert_league_match(
  p_league_id UUID,
  p_cricbuzz_match_id INTEGER,
  p_series_id INTEGER DEFAULT NULL,
  p_match_description TEXT DEFAULT NULL,
  p_match_format TEXT DEFAULT NULL,
  p_match_date TIMESTAMPTZ DEFAULT NULL,
  p_team1_name TEXT DEFAULT NULL,
  p_team2_name TEXT DEFAULT NULL,
  p_venue TEXT DEFAULT NULL,
  p_result TEXT DEFAULT NULL,
  p_week INTEGER DEFAULT NULL
)
RETURNS TABLE (
  out_match_id UUID,
  out_league_match_id UUID,
  is_new_match BOOLEAN
) AS $$
DECLARE
  v_match_id UUID;
  v_league_match_id UUID;
  v_is_new BOOLEAN := false;
BEGIN
  -- Upsert the cricket_matches record (shared data)
  INSERT INTO cricket_matches (
    cricbuzz_match_id,
    series_id,
    match_description,
    match_format,
    match_date,
    team1_name,
    team2_name,
    venue,
    result
  ) VALUES (
    p_cricbuzz_match_id,
    p_series_id,
    p_match_description,
    p_match_format,
    p_match_date,
    p_team1_name,
    p_team2_name,
    p_venue,
    p_result
  )
  ON CONFLICT (cricbuzz_match_id) DO UPDATE SET
    series_id = COALESCE(EXCLUDED.series_id, cricket_matches.series_id),
    match_description = COALESCE(EXCLUDED.match_description, cricket_matches.match_description),
    match_format = COALESCE(EXCLUDED.match_format, cricket_matches.match_format),
    match_date = COALESCE(EXCLUDED.match_date, cricket_matches.match_date),
    team1_name = COALESCE(EXCLUDED.team1_name, cricket_matches.team1_name),
    team2_name = COALESCE(EXCLUDED.team2_name, cricket_matches.team2_name),
    venue = COALESCE(EXCLUDED.venue, cricket_matches.venue),
    result = COALESCE(EXCLUDED.result, cricket_matches.result)
  RETURNING id INTO v_match_id;

  -- Check if this is a new league_match link
  v_is_new := NOT EXISTS (
    SELECT 1 FROM league_matches lm
    WHERE lm.league_id = p_league_id AND lm.match_id = v_match_id
  );

  -- Upsert the league_matches record (league-specific data)
  INSERT INTO league_matches (
    league_id,
    match_id,
    week,
    stats_imported
  ) VALUES (
    p_league_id,
    v_match_id,
    p_week,
    false
  )
  ON CONFLICT (league_id, match_id) DO UPDATE SET
    week = COALESCE(EXCLUDED.week, league_matches.week)
  RETURNING id INTO v_league_match_id;

  RETURN QUERY SELECT v_match_id, v_league_match_id, v_is_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permissions
GRANT EXECUTE ON FUNCTION upsert_league_match(UUID, INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_league_match(UUID, INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;

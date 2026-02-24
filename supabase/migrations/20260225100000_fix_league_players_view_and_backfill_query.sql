-- Fix 1: Recreate league_players view with cricbuzz_id
-- The view is missing cricbuzz_id in production, which causes the live-stats-poller
-- to fail silently when building the cricbuzz-to-player mapping, resulting in
-- zero league_player_match_scores being created.

DROP VIEW IF EXISTS league_players;

CREATE OR REPLACE VIEW league_players AS
SELECT
  p.id,
  p.name,
  COALESCE(lpp.team_override, p.teams[1]) AS team,
  p.primary_role AS role,
  p.is_international,
  p.image_id,
  p.cached_image_url,
  p.cricbuzz_id,
  lpp.league_id,
  lpp.is_available AS active,
  lpp.created_at
FROM master_players p
JOIN league_player_pool lpp ON p.id = lpp.player_id;

-- Fix 2: Widen get_matches_needing_backfill to also find matches that have
-- match_player_stats but are missing league_player_match_scores.
-- This picks up the ~30 matches that were backfilled before the view fix.
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
    -- Missing stats OR missing league scores
    AND (
      NOT EXISTS (SELECT 1 FROM match_player_stats mps WHERE mps.match_id = cm.id)
      OR NOT EXISTS (SELECT 1 FROM league_player_match_scores lpms WHERE lpms.match_id = cm.id)
    )
    -- Has a valid cricbuzz ID for API lookup
    AND cm.cricbuzz_match_id IS NOT NULL
    AND cm.cricbuzz_match_id > 0
  ORDER BY cm.match_date ASC NULLS LAST
  LIMIT p_max_results;
$$;

GRANT EXECUTE ON FUNCTION get_matches_needing_backfill(INTEGER) TO service_role;

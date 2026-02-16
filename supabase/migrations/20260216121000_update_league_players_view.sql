-- Update league_players view to include cached_image_url from master_players

DROP VIEW IF EXISTS league_players;

CREATE OR REPLACE VIEW league_players AS
SELECT
  p.id,
  p.name,
  COALESCE(lpp.team_override, p.teams[1]) as team,
  p.primary_role as role,
  p.is_international,
  p.image_id,
  p.cached_image_url,
  p.cricbuzz_id,
  lpp.league_id,
  lpp.is_available as active,
  lpp.created_at
FROM master_players p
JOIN league_player_pool lpp ON p.id = lpp.player_id;

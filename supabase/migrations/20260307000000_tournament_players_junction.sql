-- ============================================================
-- tournament_players junction table
-- Freezes team affiliations per tournament so that seeding
-- one tournament (e.g. T20 WC) never overwrites another (IPL).
-- Also merges 14 near-duplicate master_players rows created
-- by name mismatches between hardcoded data and Cricbuzz API.
-- ============================================================

-- 1a. Create tournament_players table
CREATE TABLE IF NOT EXISTS tournament_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES master_players(id) ON DELETE CASCADE,
  tournament_id INTEGER NOT NULL,
  team_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, tournament_id)
);

CREATE INDEX idx_tournament_players_tournament ON tournament_players(tournament_id);
CREATE INDEX idx_tournament_players_player ON tournament_players(player_id);

-- RLS
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tournament_players"
  ON tournament_players FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tournament_players"
  ON tournament_players FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tournament_players"
  ON tournament_players FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role bypass
GRANT ALL ON tournament_players TO service_role;

-- 1b. Merge 14 near-duplicate players
-- Each pair: old_id (null cricbuzz_id, from hardcoded data) -> new_id (has cricbuzz_id, from API)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Create temp table with merge pairs
  CREATE TEMP TABLE dup_merge(old_id UUID, new_id UUID) ON COMMIT DROP;
  INSERT INTO dup_merge VALUES
    ('2753bc60-5453-4d9b-ade2-79acd68ed92f', 'f46689d0-0504-49be-96e3-e22496f79c6e'),  -- Ajay Mandal -> Ajay Jadav Mandal
    ('62adef4a-f3c0-400b-90f3-6d19dd07db6b', '2bd1acf7-0d80-4d84-8d42-4d8b3a93d703'),  -- Akash Singh -> Akash Maharaj Singh
    ('63236e11-1fa1-44b9-a66a-11308940501a', '356a3ae6-2679-42fd-ab6a-097a45ad77ae'),  -- Aniket Varma -> Aniket Verma
    ('04bd9cdd-adb1-4563-bcc5-fb9a967f89bb', '895bf722-25e7-410a-b3d5-2cf8558df4b3'),  -- Echan Malinga -> Eshan Malinga
    ('8766367b-b2d2-4fb5-862a-b4a8e43f8821', '3d675d70-2321-4793-8032-2986f7eae5d2'),  -- Harnoor Pannu -> Harnoor Singh
    ('f61b9508-a5fa-4281-b14d-828fed91cd20', 'ce48ee82-f2f4-4f2f-a91e-7e9dd6ca4728'),  -- Lhuan-Dre Pretorious -> Lhuan-dre Pretorius
    ('179e3b96-5a1e-4cda-9689-0ce7cc641583', '7fed66c4-be7a-4873-a5f5-3f3460dc04e9'),  -- M Siddharth -> Manimaran Siddharth
    ('14efaf48-461e-4608-b32b-6ac4b8743f6d', '8f0d4bef-1e4e-44c9-887d-c9fd71d01030'),  -- Mathew Short -> Matthew Short
    ('606c6b07-2198-4e16-91da-9c810c3bbfa6', '0e050878-944b-4901-9867-8412145e4d3f'),  -- Mitch Owen -> Mitchell Owen
    ('b45050f8-3e5f-492e-a5e5-3426668878a7', 'bd017568-b4cf-4fc5-984a-e67773bc4cf0'),  -- Mohammed Izhar -> Mohammed Salahuddin Izhar
    ('89dd3051-b5b0-4aef-a598-4a5ff0f7839e', '9339a63a-78cc-400f-9f0b-0bb41e3dd5cb'),  -- Onkar Tarmale -> Onkar Tukaram Tarmale
    ('f2c8f532-94eb-4259-b324-595d0836ed0b', '08347c33-0fd1-42ad-827f-61c1e534568f'),  -- Raj Angad Bawa -> Raj Bawa
    ('d23d795b-528e-41f4-85f0-9f24fec104b2', '3b9a99fa-07ae-4740-a379-77b7602d7145'),  -- Rasikh Dar -> Rasikh Dar Salam
    ('75205c5a-c2f6-480f-b130-546f4ab85899', '88557320-9b6c-4b47-bc20-47319ff01529'); -- Vaibhav Suryavanshi -> Vaibhav Sooryavanshi

  -- Migrate FK references for each pair (skip conflicts — target may already exist)
  FOR r IN SELECT old_id, new_id FROM dup_merge LOOP
    UPDATE league_player_pool SET player_id = r.new_id WHERE player_id = r.old_id
      AND NOT EXISTS (
        SELECT 1 FROM league_player_pool lpp2
        WHERE lpp2.league_id = league_player_pool.league_id AND lpp2.player_id = r.new_id
      );
    -- Delete conflicting rows that couldn't be updated
    DELETE FROM league_player_pool WHERE player_id = r.old_id;

    -- manager_roster: unique on (player_id, league_id, week)
    UPDATE manager_roster SET player_id = r.new_id WHERE player_id = r.old_id
      AND NOT EXISTS (
        SELECT 1 FROM manager_roster mr2
        WHERE mr2.player_id = r.new_id
          AND mr2.league_id = manager_roster.league_id
          AND mr2.week = manager_roster.week
      );
    DELETE FROM manager_roster WHERE player_id = r.old_id;

    -- draft_picks: unique on (league_id, player_id)
    UPDATE draft_picks SET player_id = r.new_id WHERE player_id = r.old_id
      AND NOT EXISTS (
        SELECT 1 FROM draft_picks dp2
        WHERE dp2.league_id = draft_picks.league_id AND dp2.player_id = r.new_id
      );
    DELETE FROM draft_picks WHERE player_id = r.old_id;

    -- match_player_stats: player_id has no unique constraint
    UPDATE match_player_stats SET player_id = r.new_id WHERE player_id = r.old_id;

    UPDATE league_player_match_scores SET player_id = r.new_id WHERE player_id = r.old_id
      AND NOT EXISTS (
        SELECT 1 FROM league_player_match_scores lpms2
        WHERE lpms2.league_id = league_player_match_scores.league_id
          AND lpms2.match_id = league_player_match_scores.match_id
          AND lpms2.player_id = r.new_id
      );
    DELETE FROM league_player_match_scores WHERE player_id = r.old_id;
  END LOOP;

  -- Delete orphaned master_players rows
  DELETE FROM master_players WHERE id IN (SELECT old_id FROM dup_merge);

  RAISE NOTICE 'Merged 14 duplicate player pairs';
END $$;

-- 1c. Backfill tournament_players from existing league_player_pool data
INSERT INTO tournament_players (player_id, tournament_id, team_code)
SELECT DISTINCT lpp.player_id, l.tournament_id, lpp.team_override
FROM league_player_pool lpp
JOIN leagues l ON l.id = lpp.league_id
WHERE l.tournament_id IS NOT NULL AND lpp.team_override IS NOT NULL
ON CONFLICT (player_id, tournament_id) DO NOTHING;

-- 1d. Update views — remove mp.teams[1] fallback
DROP VIEW IF EXISTS league_players;
CREATE OR REPLACE VIEW league_players AS
SELECT
  p.id,
  p.name,
  COALESCE(lpp.team_override, 'Unknown') AS team,
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

-- Recreate player_fantasy_performance view without mp.teams[1]
CREATE OR REPLACE VIEW player_fantasy_performance AS
SELECT
  lpms.league_id,
  lpms.player_id,
  mp.name as player_name,
  COALESCE(lpp.team_override, 'Unknown') as ipl_team,
  mp.primary_role as role,
  COUNT(DISTINCT lpms.match_id) as matches_played,
  COALESCE(SUM(mps.runs), 0) as total_runs,
  COALESCE(SUM(mps.wickets), 0) as total_wickets,
  COALESCE(SUM(mps.catches + mps.stumpings + mps.run_outs), 0) as total_dismissals,
  COALESCE(SUM(lpms.total_points), 0) as total_fantasy_points,
  COALESCE(AVG(lpms.total_points), 0) as avg_fantasy_points
FROM league_player_match_scores lpms
JOIN match_player_stats mps ON mps.id = lpms.match_player_stats_id
JOIN master_players mp ON mp.id = lpms.player_id
LEFT JOIN league_player_pool lpp ON lpp.league_id = lpms.league_id AND lpp.player_id = lpms.player_id
GROUP BY lpms.league_id, lpms.player_id, mp.name, lpp.team_override, mp.primary_role;

GRANT SELECT ON league_players TO authenticated;
GRANT SELECT ON league_players TO service_role;
GRANT SELECT ON player_fantasy_performance TO authenticated;
GRANT SELECT ON player_fantasy_performance TO service_role;

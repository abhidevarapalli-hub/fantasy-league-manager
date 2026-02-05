-- Player Deduplication Migration
-- Consolidates ~1600 duplicate player rows into ~500 master players
-- Creates league_player_pool junction table for league-player associations

-- ============================================================================
-- PHASE 0: Drop dependent views (will be recreated later)
-- ============================================================================

DROP VIEW IF EXISTS fantasy_weekly_summary;
DROP VIEW IF EXISTS player_fantasy_performance;

-- ============================================================================
-- PHASE 1: Create new tables
-- ============================================================================

-- Master players table - single source of truth for all cricket players
CREATE TABLE master_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cricbuzz_id TEXT UNIQUE,
  name TEXT NOT NULL,
  primary_role TEXT NOT NULL CHECK (primary_role IN ('Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper')),
  is_international BOOLEAN DEFAULT false,
  -- Merged from extended_players
  image_id INTEGER,
  batting_style TEXT,
  bowling_style TEXT,
  dob TEXT,
  birth_place TEXT,
  height TEXT,
  bio TEXT,
  teams TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_master_players_cricbuzz_id ON master_players(cricbuzz_id);
CREATE INDEX idx_master_players_name ON master_players(name);
CREATE INDEX idx_master_players_role ON master_players(primary_role);

-- League player pool - junction table linking players to leagues
CREATE TABLE league_player_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES master_players(id) ON DELETE CASCADE,
  team_override TEXT,  -- League-specific team (e.g., IPL franchise vs national team)
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, player_id)
);

CREATE INDEX idx_league_player_pool_league_id ON league_player_pool(league_id);
CREATE INDEX idx_league_player_pool_player_id ON league_player_pool(player_id);

-- Temporary mapping table for ID translation
CREATE TABLE player_id_mapping (
  old_player_id UUID PRIMARY KEY,
  new_master_player_id UUID NOT NULL,
  league_id UUID,
  cricbuzz_id TEXT,
  player_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PHASE 2: Populate master_players (deduplicate by cricbuzz_id)
-- ============================================================================

-- Insert players that have extended_players records (with cricbuzz_id)
INSERT INTO master_players (
  cricbuzz_id, name, primary_role, is_international,
  image_id, batting_style, bowling_style, dob, birth_place, height, bio, teams
)
SELECT DISTINCT ON (ep.cricbuzz_id)
  ep.cricbuzz_id,
  p.name,
  p.role,
  p.is_international,
  ep.image_id,
  ep.batting_style,
  ep.bowling_style,
  ep.dob,
  ep.birth_place,
  ep.height,
  ep.bio,
  COALESCE(ep.teams, ARRAY[p.team])
FROM extended_players ep
JOIN players p ON ep.player_id = p.id
WHERE ep.cricbuzz_id IS NOT NULL AND ep.cricbuzz_id != ''
ORDER BY ep.cricbuzz_id, ep.updated_at DESC NULLS LAST;

-- Insert players without cricbuzz_id (deduplicate by name + role)
INSERT INTO master_players (name, primary_role, is_international, teams)
SELECT DISTINCT ON (LOWER(TRIM(p.name)), p.role)
  p.name,
  p.role,
  p.is_international,
  ARRAY[p.team]
FROM players p
LEFT JOIN extended_players ep ON p.id = ep.player_id
WHERE (ep.player_id IS NULL OR ep.cricbuzz_id IS NULL OR ep.cricbuzz_id = '')
  AND NOT EXISTS (
    SELECT 1 FROM master_players mp
    WHERE LOWER(TRIM(mp.name)) = LOWER(TRIM(p.name))
      AND mp.primary_role = p.role
  )
ORDER BY LOWER(TRIM(p.name)), p.role, p.created_at DESC;

-- ============================================================================
-- PHASE 3: Build ID mapping from old players to new master_players
-- ============================================================================

-- Map players with cricbuzz_id
INSERT INTO player_id_mapping (old_player_id, new_master_player_id, league_id, cricbuzz_id, player_name)
SELECT
  p.id,
  mp.id,
  p.league_id,
  ep.cricbuzz_id,
  p.name
FROM players p
JOIN extended_players ep ON p.id = ep.player_id
JOIN master_players mp ON ep.cricbuzz_id = mp.cricbuzz_id
WHERE ep.cricbuzz_id IS NOT NULL AND ep.cricbuzz_id != '';

-- Map players without cricbuzz_id (by name + role)
INSERT INTO player_id_mapping (old_player_id, new_master_player_id, league_id, cricbuzz_id, player_name)
SELECT
  p.id,
  mp.id,
  p.league_id,
  NULL,
  p.name
FROM players p
LEFT JOIN extended_players ep ON p.id = ep.player_id
JOIN master_players mp ON LOWER(TRIM(mp.name)) = LOWER(TRIM(p.name)) AND mp.primary_role = p.role
WHERE (ep.player_id IS NULL OR ep.cricbuzz_id IS NULL OR ep.cricbuzz_id = '')
  AND NOT EXISTS (SELECT 1 FROM player_id_mapping pim WHERE pim.old_player_id = p.id);

-- ============================================================================
-- PHASE 4: Populate league_player_pool
-- ============================================================================

INSERT INTO league_player_pool (league_id, player_id, team_override)
SELECT DISTINCT
  pim.league_id,
  pim.new_master_player_id,
  p.team
FROM player_id_mapping pim
JOIN players p ON pim.old_player_id = p.id
WHERE pim.league_id IS NOT NULL
ON CONFLICT (league_id, player_id) DO NOTHING;

-- ============================================================================
-- PHASE 5: Update draft_picks
-- ============================================================================

ALTER TABLE draft_picks ADD COLUMN new_player_id UUID;

UPDATE draft_picks dp
SET new_player_id = pim.new_master_player_id
FROM player_id_mapping pim
WHERE dp.player_id = pim.old_player_id;

-- Drop old FK and column, rename new column
ALTER TABLE draft_picks DROP CONSTRAINT IF EXISTS draft_picks_player_id_fkey;
ALTER TABLE draft_picks DROP COLUMN player_id;
ALTER TABLE draft_picks RENAME COLUMN new_player_id TO player_id;
ALTER TABLE draft_picks ADD CONSTRAINT draft_picks_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES master_players(id);

-- ============================================================================
-- PHASE 6: Update player_match_stats
-- ============================================================================

ALTER TABLE player_match_stats ADD COLUMN new_player_id UUID;

-- First, try to match via old player_id
UPDATE player_match_stats pms
SET new_player_id = pim.new_master_player_id
FROM player_id_mapping pim
WHERE pms.player_id = pim.old_player_id;

-- Fallback: match via cricbuzz_player_id
UPDATE player_match_stats pms
SET new_player_id = mp.id
FROM master_players mp
WHERE pms.cricbuzz_player_id = mp.cricbuzz_id
  AND pms.new_player_id IS NULL;

-- Drop old FK and column, rename new column
ALTER TABLE player_match_stats DROP CONSTRAINT IF EXISTS player_match_stats_player_id_fkey;
ALTER TABLE player_match_stats DROP COLUMN player_id;
ALTER TABLE player_match_stats RENAME COLUMN new_player_id TO player_id;
ALTER TABLE player_match_stats ADD CONSTRAINT player_match_stats_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES master_players(id);

-- ============================================================================
-- PHASE 7: Update managers.roster and managers.bench arrays
-- ============================================================================

CREATE OR REPLACE FUNCTION remap_player_uuid_array(old_ids UUID[])
RETURNS UUID[] AS $$
DECLARE
  new_ids UUID[] := '{}';
  old_id UUID;
  new_id UUID;
BEGIN
  IF old_ids IS NULL THEN
    RETURN '{}';
  END IF;

  FOREACH old_id IN ARRAY old_ids LOOP
    SELECT new_master_player_id INTO new_id
    FROM player_id_mapping
    WHERE old_player_id = old_id;

    IF new_id IS NOT NULL THEN
      new_ids := array_append(new_ids, new_id);
    END IF;
  END LOOP;

  RETURN new_ids;
END;
$$ LANGUAGE plpgsql;

UPDATE managers
SET
  roster = remap_player_uuid_array(roster),
  bench = remap_player_uuid_array(bench);

DROP FUNCTION remap_player_uuid_array(UUID[]);

-- ============================================================================
-- PHASE 8: Update trades.proposer_players and trades.target_players arrays
-- ============================================================================

CREATE OR REPLACE FUNCTION remap_player_text_array(old_ids TEXT[])
RETURNS TEXT[] AS $$
DECLARE
  new_ids TEXT[] := '{}';
  old_id TEXT;
  new_id UUID;
BEGIN
  IF old_ids IS NULL THEN
    RETURN '{}';
  END IF;

  FOREACH old_id IN ARRAY old_ids LOOP
    BEGIN
      SELECT new_master_player_id INTO new_id
      FROM player_id_mapping
      WHERE old_player_id = old_id::UUID;

      IF new_id IS NOT NULL THEN
        new_ids := array_append(new_ids, new_id::TEXT);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Skip invalid UUIDs
      NULL;
    END;
  END LOOP;

  RETURN new_ids;
END;
$$ LANGUAGE plpgsql;

UPDATE trades
SET
  proposer_players = remap_player_text_array(proposer_players),
  target_players = remap_player_text_array(target_players);

DROP FUNCTION remap_player_text_array(TEXT[]);

-- ============================================================================
-- PHASE 9: Create backward-compatible view
-- ============================================================================

CREATE OR REPLACE VIEW league_players AS
SELECT
  mp.id,
  mp.name,
  COALESCE(lpp.team_override, mp.teams[1], 'Unknown') as team,
  mp.primary_role as role,
  mp.is_international,
  mp.image_id,
  mp.cricbuzz_id,
  mp.batting_style,
  mp.bowling_style,
  mp.dob,
  mp.birth_place,
  mp.height,
  mp.bio,
  mp.teams,
  mp.created_at,
  mp.updated_at,
  lpp.league_id,
  lpp.is_available,
  lpp.team_override
FROM master_players mp
JOIN league_player_pool lpp ON mp.id = lpp.player_id;

-- Recreate fantasy_weekly_summary view (updated for new schema)
CREATE OR REPLACE VIEW fantasy_weekly_summary AS
SELECT
  pms.league_id,
  pms.week,
  pms.manager_id,
  m.name AS manager_name,
  m.team_name,
  count(DISTINCT pms.player_id) AS players_with_stats,
  sum(
    CASE
      WHEN pms.was_in_active_roster THEN pms.fantasy_points
      ELSE (0)::numeric
    END) AS active_points,
  sum(
    CASE
      WHEN (NOT pms.was_in_active_roster) THEN pms.fantasy_points
      ELSE (0)::numeric
    END) AS bench_points,
  sum(
    CASE
      WHEN pms.was_in_active_roster THEN pms.fantasy_points
      ELSE (0)::numeric
    END) AS total_points
FROM player_match_stats pms
JOIN managers m ON m.id = pms.manager_id
GROUP BY pms.league_id, pms.week, pms.manager_id, m.name, m.team_name;

-- Recreate player_fantasy_performance view (updated for new schema)
CREATE OR REPLACE VIEW player_fantasy_performance AS
SELECT
  pms.league_id,
  pms.player_id,
  mp.name AS player_name,
  mp.teams[1] AS ipl_team,
  mp.primary_role AS role,
  count(DISTINCT pms.match_id) AS matches_played,
  sum(pms.runs) AS total_runs,
  sum(pms.wickets) AS total_wickets,
  sum(((pms.catches + pms.stumpings) + pms.run_outs)) AS total_dismissals,
  sum(pms.fantasy_points) AS total_fantasy_points,
  avg(pms.fantasy_points) AS avg_fantasy_points
FROM player_match_stats pms
JOIN master_players mp ON mp.id = pms.player_id
GROUP BY pms.league_id, pms.player_id, mp.name, mp.teams[1], mp.primary_role;

-- ============================================================================
-- PHASE 10: Add RLS policies
-- ============================================================================

ALTER TABLE master_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_player_pool ENABLE ROW LEVEL SECURITY;

-- Master players: readable by all authenticated users
CREATE POLICY "Master players are viewable by authenticated users"
  ON master_players FOR SELECT
  TO authenticated
  USING (true);

-- Master players: insertable/updatable by authenticated users (for seeding)
CREATE POLICY "Master players can be inserted by authenticated users"
  ON master_players FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Master players can be updated by authenticated users"
  ON master_players FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- League player pool: viewable by league members
CREATE POLICY "League player pool viewable by league members"
  ON league_player_pool FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM managers m
      WHERE m.league_id = league_player_pool.league_id
        AND m.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM leagues l
      WHERE l.id = league_player_pool.league_id
        AND l.league_manager_id = auth.uid()
    )
  );

-- League player pool: insertable by league managers
CREATE POLICY "League player pool insertable by league managers"
  ON league_player_pool FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues l
      WHERE l.id = league_player_pool.league_id
        AND l.league_manager_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM managers m
      WHERE m.league_id = league_player_pool.league_id
        AND m.user_id = auth.uid()
    )
  );

-- League player pool: deletable by league managers
CREATE POLICY "League player pool deletable by league managers"
  ON league_player_pool FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues l
      WHERE l.id = league_player_pool.league_id
        AND l.league_manager_id = auth.uid()
    )
  );

-- ============================================================================
-- PHASE 11: Archive and drop old tables
-- ============================================================================

-- Create archive tables (for rollback if needed)
CREATE TABLE _archive_players AS SELECT * FROM players;
CREATE TABLE _archive_extended_players AS SELECT * FROM extended_players;

-- Drop old tables
DROP TABLE IF EXISTS extended_players;
DROP TABLE IF EXISTS players;

-- Keep mapping table for reference (can be dropped later)
-- DROP TABLE IF EXISTS player_id_mapping;

-- ============================================================================
-- PHASE 12: Add trigger for updated_at on master_players
-- ============================================================================

CREATE OR REPLACE FUNCTION update_master_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_master_players_updated_at
  BEFORE UPDATE ON master_players
  FOR EACH ROW
  EXECUTE FUNCTION update_master_players_updated_at();

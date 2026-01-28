-- Migration: Player Detail Tables
-- Description: Add tables for extended player info, cricket matches, and player match stats
-- Purpose: Support player detail view with match-by-match performance stats

-- ============================================
-- Extended Players Table
-- ============================================
-- Stores additional player info from Cricbuzz API that's not in the main players table
CREATE TABLE IF NOT EXISTS extended_players (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  cricbuzz_id TEXT NOT NULL,
  image_id INTEGER,
  batting_style TEXT,
  bowling_style TEXT,
  dob TEXT,
  birth_place TEXT,
  height TEXT,
  bio TEXT,
  teams TEXT[], -- Teams the player has played for
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for cricbuzz_id lookups
CREATE INDEX IF NOT EXISTS idx_extended_players_cricbuzz_id ON extended_players(cricbuzz_id);

-- ============================================
-- Cricket Matches Table
-- ============================================
-- Stores match metadata from Cricbuzz API for a tournament/series
CREATE TABLE IF NOT EXISTS cricket_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cricbuzz_match_id INTEGER UNIQUE NOT NULL,
  series_id INTEGER NOT NULL,
  match_description TEXT,
  match_format TEXT, -- T20, ODI, TEST
  match_date TIMESTAMP WITH TIME ZONE,
  team1_id INTEGER,
  team1_name TEXT,
  team1_short TEXT, -- Short name (e.g., "IND", "MI")
  team1_score TEXT, -- e.g., "185/6"
  team2_id INTEGER,
  team2_name TEXT,
  team2_short TEXT,
  team2_score TEXT,
  result TEXT, -- Match result text
  winner_team_id INTEGER,
  venue TEXT,
  city TEXT,
  state TEXT, -- Match state: Complete, Live, Upcoming
  league_id UUID REFERENCES leagues(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cricket_matches_series_id ON cricket_matches(series_id);
CREATE INDEX IF NOT EXISTS idx_cricket_matches_match_date ON cricket_matches(match_date);
CREATE INDEX IF NOT EXISTS idx_cricket_matches_league_id ON cricket_matches(league_id);

-- ============================================
-- Player Match Stats Table
-- ============================================
-- Stores per-match player performance (batting, bowling, fielding)
CREATE TABLE IF NOT EXISTS player_match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  match_id UUID REFERENCES cricket_matches(id) ON DELETE CASCADE,
  cricbuzz_player_id TEXT NOT NULL,
  -- Batting stats
  runs INTEGER DEFAULT 0,
  balls_faced INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  strike_rate DECIMAL(6,2),
  is_out BOOLEAN DEFAULT false,
  dismissal_type TEXT,
  batting_position INTEGER,
  -- Bowling stats
  overs DECIMAL(4,1) DEFAULT 0,
  maidens INTEGER DEFAULT 0,
  runs_conceded INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  economy DECIMAL(5,2),
  dots INTEGER DEFAULT 0,
  wides INTEGER DEFAULT 0,
  no_balls INTEGER DEFAULT 0,
  -- Fielding stats
  catches INTEGER DEFAULT 0,
  stumpings INTEGER DEFAULT 0,
  run_outs INTEGER DEFAULT 0,
  -- Fantasy scoring
  fantasy_points DECIMAL(6,2),
  league_id UUID REFERENCES leagues(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Prevent duplicate entries
  UNIQUE(player_id, match_id),
  UNIQUE(cricbuzz_player_id, match_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_player_match_stats_player_id ON player_match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_match_id ON player_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_cricbuzz_player_id ON player_match_stats(cricbuzz_player_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_league_id ON player_match_stats(league_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE extended_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE cricket_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "extended_players_read_policy" ON extended_players
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cricket_matches_read_policy" ON cricket_matches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "player_match_stats_read_policy" ON player_match_stats
  FOR SELECT TO authenticated USING (true);

-- Write access for authenticated users (for syncing data)
CREATE POLICY "extended_players_insert_policy" ON extended_players
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "extended_players_update_policy" ON extended_players
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "cricket_matches_insert_policy" ON cricket_matches
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "cricket_matches_update_policy" ON cricket_matches
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "player_match_stats_insert_policy" ON player_match_stats
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "player_match_stats_update_policy" ON player_match_stats
  FOR UPDATE TO authenticated USING (true);

-- ============================================
-- Update trigger for extended_players
-- ============================================
CREATE OR REPLACE FUNCTION update_extended_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_extended_players_updated_at
  BEFORE UPDATE ON extended_players
  FOR EACH ROW
  EXECUTE FUNCTION update_extended_players_updated_at();

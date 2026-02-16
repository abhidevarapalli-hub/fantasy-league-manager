-- Create tables that were originally created via Supabase dashboard
-- but never captured in migrations. Required for local dev from scratch.

-- ============================================
-- 0. match_player_stats (replacement for player_match_stats after dedup)
-- ============================================
CREATE TABLE IF NOT EXISTS match_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES cricket_matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES master_players(id) ON DELETE CASCADE,
  cricbuzz_player_id TEXT NOT NULL,
  -- Batting
  runs INTEGER DEFAULT 0,
  balls_faced INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  strike_rate DECIMAL(6,2),
  is_out BOOLEAN DEFAULT false,
  dismissal_type TEXT,
  batting_position INTEGER,
  -- Bowling
  overs DECIMAL(4,1) DEFAULT 0,
  maidens INTEGER DEFAULT 0,
  runs_conceded INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  economy DECIMAL(5,2),
  dots INTEGER DEFAULT 0,
  wides INTEGER DEFAULT 0,
  no_balls INTEGER DEFAULT 0,
  lbw_bowled_count INTEGER DEFAULT 0,
  -- Fielding
  catches INTEGER DEFAULT 0,
  stumpings INTEGER DEFAULT 0,
  run_outs INTEGER DEFAULT 0,
  -- Match context
  is_in_playing_11 BOOLEAN DEFAULT false,
  is_impact_player BOOLEAN DEFAULT false,
  is_man_of_match BOOLEAN DEFAULT false,
  team_won BOOLEAN,
  -- Live polling
  is_live BOOLEAN DEFAULT false,
  live_updated_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  source_poll_version INTEGER DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, cricbuzz_player_id)
);

CREATE INDEX IF NOT EXISTS idx_mps_match_id ON match_player_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_mps_player_id ON match_player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_mps_cricbuzz_player_id ON match_player_stats(cricbuzz_player_id);

ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read match stats"
  ON match_player_stats FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage match stats"
  ON match_player_stats FOR ALL TO service_role USING (true);

GRANT SELECT ON match_player_stats TO authenticated;
GRANT ALL ON match_player_stats TO service_role;

-- ============================================
-- 1. league_player_match_scores
-- ============================================
CREATE TABLE IF NOT EXISTS league_player_match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES cricket_matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES master_players(id) ON DELETE CASCADE,
  match_player_stats_id UUID NOT NULL REFERENCES match_player_stats(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES managers(id) ON DELETE SET NULL,
  total_points DECIMAL NOT NULL DEFAULT 0,
  batting_points DECIMAL NOT NULL DEFAULT 0,
  bowling_points DECIMAL NOT NULL DEFAULT 0,
  fielding_points DECIMAL NOT NULL DEFAULT 0,
  common_points DECIMAL NOT NULL DEFAULT 0,
  points_breakdown JSONB DEFAULT '{}'::jsonb,
  is_live BOOLEAN NOT NULL DEFAULT false,
  was_in_active_roster BOOLEAN NOT NULL DEFAULT false,
  week INTEGER,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lpms_league_id ON league_player_match_scores(league_id);
CREATE INDEX IF NOT EXISTS idx_lpms_match_id ON league_player_match_scores(match_id);
CREATE INDEX IF NOT EXISTS idx_lpms_player_id ON league_player_match_scores(player_id);
CREATE INDEX IF NOT EXISTS idx_lpms_manager_id ON league_player_match_scores(manager_id);

ALTER TABLE league_player_match_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read league scores"
  ON league_player_match_scores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage league scores"
  ON league_player_match_scores FOR ALL TO service_role USING (true);

GRANT SELECT ON league_player_match_scores TO authenticated;
GRANT ALL ON league_player_match_scores TO service_role;

-- ============================================
-- 2. league_schedules
-- ============================================
CREATE TABLE IF NOT EXISTS league_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  manager1_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  manager2_id UUID REFERENCES managers(id) ON DELETE CASCADE,
  manager1_score DECIMAL,
  manager2_score DECIMAL,
  winner_id UUID REFERENCES managers(id) ON DELETE SET NULL,
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_league_schedules_league_id ON league_schedules(league_id);

ALTER TABLE league_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read league schedules"
  ON league_schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "League managers can manage schedules"
  ON league_schedules FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = league_schedules.league_id
        AND leagues.league_manager_id = auth.uid()
    )
  );

GRANT SELECT ON league_schedules TO authenticated;
GRANT ALL ON league_schedules TO service_role;

-- ============================================
-- 3. lifecycle_audit_log
-- ============================================
CREATE TABLE IF NOT EXISTS lifecycle_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ DEFAULT NOW(),
  matches_checked INTEGER,
  matches_activated INTEGER,
  errors TEXT,
  duration_ms INTEGER
);

ALTER TABLE lifecycle_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage audit log"
  ON lifecycle_audit_log FOR ALL TO service_role USING (true);

GRANT ALL ON lifecycle_audit_log TO service_role;

-- ============================================
-- 4. trade_players
-- ============================================
CREATE TABLE IF NOT EXISTS trade_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES master_players(id) ON DELETE CASCADE,
  side TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_players_trade_id ON trade_players(trade_id);

ALTER TABLE trade_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read trade players"
  ON trade_players FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert trade players"
  ON trade_players FOR INSERT TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT ON trade_players TO authenticated;
GRANT ALL ON trade_players TO service_role;

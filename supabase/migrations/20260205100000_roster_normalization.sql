-- Migration: Normalize roster storage from arrays to junction table
-- This replaces managers.roster (UUID[]) and managers.bench (UUID[]) with a proper junction table

-- ============================================
-- Phase 1: Create manager_roster junction table
-- ============================================

CREATE TABLE IF NOT EXISTS manager_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES master_players(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('active', 'bench')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Player can only be on ONE team per league (prevents duplicates)
  UNIQUE(league_id, player_id)
);

-- ============================================
-- Phase 2: Add indexes for efficient queries
-- ============================================

-- Index for fetching a manager's roster
CREATE INDEX IF NOT EXISTS idx_manager_roster_manager_id ON manager_roster(manager_id);

-- Index for league-wide queries (e.g., finding free agents)
CREATE INDEX IF NOT EXISTS idx_manager_roster_league_id ON manager_roster(league_id);

-- Index for player lookups across leagues
CREATE INDEX IF NOT EXISTS idx_manager_roster_player_id ON manager_roster(player_id);

-- Composite index for common query pattern (manager + slot type)
CREATE INDEX IF NOT EXISTS idx_manager_roster_manager_slot ON manager_roster(manager_id, slot_type);

-- ============================================
-- Phase 3: Migrate existing data from arrays
-- ============================================

-- Migrate active roster players
INSERT INTO manager_roster (manager_id, player_id, league_id, slot_type, position)
SELECT
  m.id as manager_id,
  unnest(m.roster) as player_id,
  m.league_id,
  'active' as slot_type,
  row_number() OVER (PARTITION BY m.id ORDER BY (SELECT NULL)) - 1 as position
FROM managers m
WHERE m.roster IS NOT NULL
  AND array_length(m.roster, 1) > 0
  AND m.league_id IS NOT NULL
ON CONFLICT (league_id, player_id) DO NOTHING;

-- Migrate bench players
INSERT INTO manager_roster (manager_id, player_id, league_id, slot_type, position)
SELECT
  m.id as manager_id,
  unnest(m.bench) as player_id,
  m.league_id,
  'bench' as slot_type,
  row_number() OVER (PARTITION BY m.id ORDER BY (SELECT NULL)) - 1 as position
FROM managers m
WHERE m.bench IS NOT NULL
  AND array_length(m.bench, 1) > 0
  AND m.league_id IS NOT NULL
ON CONFLICT (league_id, player_id) DO NOTHING;

-- ============================================
-- Phase 4: Enable Row Level Security
-- ============================================

ALTER TABLE manager_roster ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read roster data (needed for viewing other teams)
CREATE POLICY "Anyone can view rosters"
  ON manager_roster FOR SELECT
  TO authenticated
  USING (true);

-- League members can modify rosters (through their manager)
CREATE POLICY "League members can modify rosters"
  ON manager_roster FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM managers m
      WHERE m.id = manager_roster.manager_id
        AND (m.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM leagues l
          WHERE l.id = manager_roster.league_id
            AND l.league_manager_id = auth.uid()
        ))
    )
  );

CREATE POLICY "League members can update rosters"
  ON manager_roster FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM managers m
      WHERE m.id = manager_roster.manager_id
        AND (m.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM leagues l
          WHERE l.id = manager_roster.league_id
            AND l.league_manager_id = auth.uid()
        ))
    )
  );

CREATE POLICY "League members can delete from rosters"
  ON manager_roster FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM managers m
      WHERE m.id = manager_roster.manager_id
        AND (m.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM leagues l
          WHERE l.id = manager_roster.league_id
            AND l.league_manager_id = auth.uid()
        ))
    )
  );

-- ============================================
-- Phase 5: Enable Realtime
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE manager_roster;

-- ============================================
-- Note: Arrays on managers table are KEPT for rollback safety
-- They will be removed in a future migration after verification
-- ============================================

-- Add week, is_captain, is_vice_captain columns to manager_roster
-- These are needed for per-week roster tracking and captain designation

ALTER TABLE manager_roster
  ADD COLUMN IF NOT EXISTS week integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_captain boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vice_captain boolean NOT NULL DEFAULT false;

-- Drop the old unique constraint on (league_id, player_id) and replace with (player_id, league_id, week)
ALTER TABLE manager_roster
  DROP CONSTRAINT IF EXISTS manager_roster_league_id_player_id_key;

ALTER TABLE manager_roster
  ADD CONSTRAINT manager_roster_player_league_week_key UNIQUE (player_id, league_id, week);

-- Create the sync_league_rosters RPC
-- This function creates manager_roster entries from draft_picks after draft completion
CREATE OR REPLACE FUNCTION sync_league_rosters(p_league_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert roster entries from draft picks that don't already exist
  INSERT INTO manager_roster (manager_id, player_id, league_id, slot_type, position, week)
  SELECT
    dp.manager_id,
    dp.player_id,
    dp.league_id,
    'bench' AS slot_type,
    dp.pick_position AS position,
    1 AS week
  FROM draft_picks dp
  WHERE dp.league_id = p_league_id
    AND dp.player_id IS NOT NULL
    AND dp.manager_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM manager_roster mr
      WHERE mr.manager_id = dp.manager_id
        AND mr.player_id = dp.player_id
        AND mr.league_id = dp.league_id
        AND mr.week = 1
    );

  -- Mark draft as completed
  UPDATE draft_state
  SET status = 'completed',
      finalized_at = now()
  WHERE league_id = p_league_id;
END;
$$;

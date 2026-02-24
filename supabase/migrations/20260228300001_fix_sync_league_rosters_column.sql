-- Migration: Fix sync_league_rosters column name
-- Description: Use pick_number instead of pick_position for draft_picks

CREATE OR REPLACE FUNCTION public.sync_league_rosters(p_league_id UUID)
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
    dp.pick_number AS position,
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

-- ============================================
-- Auto-Backfill Trigger: Safety Net for Missing League Scores
--
-- Problem: The live-stats-poller has multiple silent failure points
-- where league_player_match_scores rows can fail to be created.
-- When this happens, league dashboards show 0 points with no error.
--
-- Solution: A database trigger that fires when a match is marked
-- Complete. It checks if any league is missing score rows for that
-- match and auto-creates skeleton rows. The poller's own upsert
-- (ON CONFLICT ... UPDATE) will fill in actual points if it runs
-- after the trigger. If the poller already succeeded, the trigger
-- is a no-op due to ON CONFLICT DO NOTHING.
-- ============================================

CREATE OR REPLACE FUNCTION auto_backfill_league_scores_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when state transitions TO 'Complete'
  IF NEW.state = 'Complete' AND (OLD.state IS DISTINCT FROM 'Complete') THEN

    -- For each league that has this match, backfill missing score rows
    INSERT INTO league_player_match_scores (
      match_player_stats_id, league_id, match_id, player_id,
      manager_id, was_in_active_roster, week,
      points_breakdown, total_points, is_live, finalized_at
    )
    SELECT
      mps.id,
      lm.league_id,
      mps.match_id,
      mp.id,
      mr.manager_id,
      COALESCE(mr.slot_type = 'active', false),
      lm.week,
      '{}'::jsonb,
      0,
      false,
      NOW()
    FROM match_player_stats mps
    JOIN league_matches lm ON lm.match_id = mps.match_id
    JOIN master_players mp ON mp.cricbuzz_id = mps.cricbuzz_player_id
    JOIN league_player_pool lpp ON lpp.player_id = mp.id
                                AND lpp.league_id = lm.league_id
    LEFT JOIN manager_roster mr ON mr.player_id = mp.id
                                AND mr.league_id = lm.league_id
                                AND mr.week = lm.week
    WHERE mps.match_id = NEW.id
    ON CONFLICT (league_id, match_id, player_id) DO NOTHING;

    -- Also mark league_matches as stats_imported
    UPDATE league_matches
    SET stats_imported = true,
        stats_imported_at = COALESCE(stats_imported_at, NOW())
    WHERE match_id = NEW.id
      AND stats_imported = false;

  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to cricket_matches
DROP TRIGGER IF EXISTS trg_auto_backfill_on_match_complete ON cricket_matches;
CREATE TRIGGER trg_auto_backfill_on_match_complete
  AFTER UPDATE OF state ON cricket_matches
  FOR EACH ROW
  WHEN (NEW.state = 'Complete' AND OLD.state IS DISTINCT FROM 'Complete')
  EXECUTE FUNCTION auto_backfill_league_scores_on_complete();

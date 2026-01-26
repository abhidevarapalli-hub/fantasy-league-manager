-- Migration: Optimize standings calculation with Postgres function
-- This replaces client-side loops with a single server-side transaction

-- Create function to update league standings
CREATE OR REPLACE FUNCTION update_league_standings(league_uuid UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update all managers' standings in a single transaction
  -- Calculate wins, losses, and points from finalized schedule matches
  
  WITH match_results AS (
    -- Calculate home team results
    SELECT 
      home_manager_id as manager_id,
      COUNT(*) FILTER (WHERE home_score > away_score) as wins,
      COUNT(*) FILTER (WHERE home_score < away_score) as losses,
      COALESCE(SUM(home_score), 0) as points
    FROM schedule
    WHERE league_id = league_uuid
      AND is_finalized = true
      AND home_manager_id IS NOT NULL
    GROUP BY home_manager_id
    
    UNION ALL
    
    -- Calculate away team results
    SELECT 
      away_manager_id as manager_id,
      COUNT(*) FILTER (WHERE away_score > home_score) as wins,
      COUNT(*) FILTER (WHERE away_score < home_score) as losses,
      COALESCE(SUM(away_score), 0) as points
    FROM schedule
    WHERE league_id = league_uuid
      AND is_finalized = true
      AND away_manager_id IS NOT NULL
    GROUP BY away_manager_id
  ),
  aggregated_results AS (
    -- Combine home and away results for each manager
    SELECT 
      manager_id,
      SUM(wins) as total_wins,
      SUM(losses) as total_losses,
      SUM(points) as total_points
    FROM match_results
    GROUP BY manager_id
  )
  -- Update managers table with calculated standings
  UPDATE managers m
  SET 
    wins = COALESCE(ar.total_wins, 0),
    losses = COALESCE(ar.total_losses, 0),
    points = COALESCE(ar.total_points, 0)
  FROM aggregated_results ar
  WHERE m.id = ar.manager_id
    AND m.league_id = league_uuid;
    
  -- Reset standings for managers with no matches (shouldn't happen, but safety)
  UPDATE managers
  SET wins = 0, losses = 0, points = 0
  WHERE league_id = league_uuid
    AND id NOT IN (
      SELECT DISTINCT manager_id 
      FROM (
        SELECT home_manager_id as manager_id FROM schedule WHERE league_id = league_uuid AND is_finalized = true
        UNION
        SELECT away_manager_id as manager_id FROM schedule WHERE league_id = league_uuid AND is_finalized = true
      ) all_managers
      WHERE manager_id IS NOT NULL
    );
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION update_league_standings(UUID) IS 
'Recalculates and updates wins, losses, and points for all managers in a league based on finalized schedule matches. Runs in a single transaction for atomicity.';

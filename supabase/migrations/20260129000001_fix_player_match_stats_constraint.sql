-- Migration: Fix player_match_stats unique constraint
-- Description: Add correct unique constraint for upsert operations
-- Purpose: Enable stats import with league_id,cricbuzz_player_id,match_id conflict resolution

-- Drop the old constraint that doesn't include league_id
ALTER TABLE player_match_stats DROP CONSTRAINT IF EXISTS player_match_stats_cricbuzz_player_id_match_id_key;

-- Add the new constraint that includes league_id
-- This allows the same player stats for the same match to exist in different leagues
ALTER TABLE player_match_stats
  ADD CONSTRAINT player_match_stats_league_cricbuzz_match_unique
  UNIQUE (league_id, cricbuzz_player_id, match_id);

-- Rename league_schedules to league_matchups to match the application code and types.
-- PostgreSQL automatically updates indexes, FK constraints, and RLS policies.
ALTER TABLE IF EXISTS league_schedules RENAME TO league_matchups;

-- Rename the index to match
ALTER INDEX IF EXISTS idx_league_schedules_league_id RENAME TO idx_league_matchups_league_id;

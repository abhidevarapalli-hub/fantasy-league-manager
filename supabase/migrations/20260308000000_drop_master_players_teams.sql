-- Drop the deprecated teams array column from master_players.
-- Team affiliations now live in tournament_players junction table
-- (added in 20260307000000_tournament_players_junction.sql).
ALTER TABLE master_players DROP COLUMN IF EXISTS teams;

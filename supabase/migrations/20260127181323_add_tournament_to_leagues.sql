-- Add tournament columns to leagues table for T20 WC and IPL support
ALTER TABLE public.leagues 
  ADD COLUMN IF NOT EXISTS tournament_id INTEGER,
  ADD COLUMN IF NOT EXISTS tournament_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.leagues.tournament_id IS 'Cricbuzz series ID for the tournament (e.g., 11253 for T20 WC 2026, 9241 for IPL 2026)';
COMMENT ON COLUMN public.leagues.tournament_name IS 'Display name of the tournament';

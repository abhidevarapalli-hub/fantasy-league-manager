-- Migration: Add scoring_rules JSONB column to leagues table
-- This allows per-league customization of fantasy scoring rules

-- Add scoring_rules column with default values
ALTER TABLE public.leagues 
ADD COLUMN IF NOT EXISTS scoring_rules JSONB DEFAULT '{
  "batting": {
    "runs": 1
  },
  "bowling": {
    "wickets": 25
  },
  "fielding": {
    "catches": 8
  }
}'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN public.leagues.scoring_rules IS 
'JSONB column storing fantasy scoring rules for this league. Structure supports batting (runs, fours, sixes, milestones), bowling (wickets, maidens, economy), and fielding (catches, stumpings, run_outs) categories.';

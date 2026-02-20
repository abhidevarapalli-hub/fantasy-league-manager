-- Add granular roster constraints to the leagues table
ALTER TABLE leagues
ADD COLUMN IF NOT EXISTS max_bowlers INTEGER DEFAULT 6,
ADD COLUMN IF NOT EXISTS max_wks INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS max_all_rounders INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS max_from_team INTEGER DEFAULT 11;

-- Update existing leagues with sensible defaults if they are NULL
UPDATE leagues SET
  max_bowlers = COALESCE(max_bowlers, 6),
  max_wks = COALESCE(max_wks, 2),
  max_all_rounders = COALESCE(max_all_rounders, 4),
  max_from_team = COALESCE(max_from_team, 11);

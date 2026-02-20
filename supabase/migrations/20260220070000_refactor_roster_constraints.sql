-- Refactor leagues table for grouped roster constraints
-- 1. Add new columns for grouped Bat+WK
ALTER TABLE leagues 
ADD COLUMN IF NOT EXISTS min_bat_wk integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS max_bat_wk integer DEFAULT 6,
ADD COLUMN IF NOT EXISTS require_wk boolean DEFAULT true;

-- 2. Migrate existing data: min_bat_wk should be min_batsmen (since it already included WKs in logic)
UPDATE leagues SET 
  min_bat_wk = COALESCE(min_batsmen, 3),
  max_bat_wk = COALESCE(max_batsmen, 6),
  require_wk = true;

-- 3. Ensure other columns have defaults (just in case)
ALTER TABLE leagues 
ALTER COLUMN min_all_rounders SET DEFAULT 1,
ALTER COLUMN max_all_rounders SET DEFAULT 4,
ALTER COLUMN min_bowlers SET DEFAULT 3,
ALTER COLUMN max_bowlers SET DEFAULT 6;

-- Note: We keep min_batsmen and max_batsmen for now but will ignore them in code
-- to avoid breaking existing queries if they are used elsewhere.

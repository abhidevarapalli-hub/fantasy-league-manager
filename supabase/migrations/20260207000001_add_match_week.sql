-- Add match_week column to cricket_matches
ALTER TABLE cricket_matches ADD COLUMN IF NOT EXISTS match_week INTEGER;

-- Update Weeks based on user-defined intervals for T20 WC 2026 (series_id = 11253)

-- Interval 1: Feb 7 – Feb 9 (Matches 1 to 9)
UPDATE cricket_matches 
SET match_week = 1 
WHERE series_id = 11253 
AND match_date >= '2026-02-07 00:00:00+00' AND match_date < '2026-02-10 00:00:00+00';

-- Interval 2: Feb 10 – Feb 12 (Matches 10 to 18)
UPDATE cricket_matches 
SET match_week = 2 
WHERE series_id = 11253 
AND match_date >= '2026-02-10 00:00:00+00' AND match_date < '2026-02-13 00:00:00+00';

-- Interval 3: Feb 13 – Feb 15 (Matches 19 to 27)
UPDATE cricket_matches 
SET match_week = 3 
WHERE series_id = 11253 
AND match_date >= '2026-02-13 00:00:00+00' AND match_date < '2026-02-16 00:00:00+00';

-- Interval 4: Feb 16 – Feb 18 (Matches 28 to 36)
UPDATE cricket_matches 
SET match_week = 4 
WHERE series_id = 11253 
AND match_date >= '2026-02-16 00:00:00+00' AND match_date < '2026-02-19 00:00:00+00';

-- Interval 5: Feb 19 – Feb 20 (Matches 37 to 40)
UPDATE cricket_matches 
SET match_week = 5 
WHERE series_id = 11253 
AND match_date >= '2026-02-19 00:00:00+00' AND match_date < '2026-02-21 00:00:00+00';

-- Week 6: All other games (Matches 41+) - Super 8s, Semis, Finals
UPDATE cricket_matches 
SET match_week = 6 
WHERE series_id = 11253 
AND match_week IS NULL;

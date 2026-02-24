-- Fix TBC team names for Super 8 and knockout matches using verified Cricbuzz data
-- Also fix match state for all completed/abandoned matches

-- Match 41: 139362 - NZ vs PAK (Abandoned)
UPDATE cricket_matches
SET team1_id = 13, team1_name = 'New Zealand', team1_short = 'NZ',
    team2_id = 3,  team2_name = 'Pakistan',    team2_short = 'PAK'
WHERE cricbuzz_match_id = 139362;

-- Match 42: 139373 - ENG vs SL (Complete)
UPDATE cricket_matches
SET team1_id = 9,  team1_name = 'England',   team1_short = 'ENG',
    team2_id = 5,  team2_name = 'Sri Lanka', team2_short = 'SL'
WHERE cricbuzz_match_id = 139373;

-- Match 43: 139381 - IND vs RSA (Complete)
UPDATE cricket_matches
SET team1_id = 2,  team1_name = 'India',        team1_short = 'IND',
    team2_id = 11, team2_name = 'South Africa',  team2_short = 'RSA'
WHERE cricbuzz_match_id = 139381;

-- Match 44: 139382 - ZIM vs WI (Complete)
UPDATE cricket_matches
SET team1_id = 12, team1_name = 'Zimbabwe',     team1_short = 'ZIM',
    team2_id = 10, team2_name = 'West Indies',  team2_short = 'WI'
WHERE cricbuzz_match_id = 139382;

-- Match 45: 139393 - ENG vs PAK (Complete)
UPDATE cricket_matches
SET team1_id = 9,  team1_name = 'England',  team1_short = 'ENG',
    team2_id = 3,  team2_name = 'Pakistan', team2_short = 'PAK'
WHERE cricbuzz_match_id = 139393;

-- Match 46: 139404 - NZ vs SL (Preview)
UPDATE cricket_matches
SET team1_id = 13, team1_name = 'New Zealand', team1_short = 'NZ',
    team2_id = 5,  team2_name = 'Sri Lanka',   team2_short = 'SL'
WHERE cricbuzz_match_id = 139404;

-- Match 47: 139415 - WI vs RSA (Upcoming)
UPDATE cricket_matches
SET team1_id = 10, team1_name = 'West Indies',  team1_short = 'WI',
    team2_id = 11, team2_name = 'South Africa',  team2_short = 'RSA'
WHERE cricbuzz_match_id = 139415;

-- Match 48: 139426 - IND vs ZIM (Upcoming)
UPDATE cricket_matches
SET team1_id = 2,  team1_name = 'India',    team1_short = 'IND',
    team2_id = 12, team2_name = 'Zimbabwe', team2_short = 'ZIM'
WHERE cricbuzz_match_id = 139426;

-- Match 49: 139437 - ENG vs NZ (Upcoming)
UPDATE cricket_matches
SET team1_id = 9,  team1_name = 'England',     team1_short = 'ENG',
    team2_id = 13, team2_name = 'New Zealand',  team2_short = 'NZ'
WHERE cricbuzz_match_id = 139437;

-- Match 50: 139448 - PAK vs SL (Upcoming)
UPDATE cricket_matches
SET team1_id = 3,  team1_name = 'Pakistan',  team1_short = 'PAK',
    team2_id = 5,  team2_name = 'Sri Lanka', team2_short = 'SL'
WHERE cricbuzz_match_id = 139448;

-- Match 51: 139450 - TBC vs RSA (only team2 known)
UPDATE cricket_matches
SET team2_id = 11, team2_name = 'South Africa', team2_short = 'RSA'
WHERE cricbuzz_match_id = 139450;

-- Match 52: 139461 - IND vs WI (Upcoming)
UPDATE cricket_matches
SET team1_id = 2,  team1_name = 'India',       team1_short = 'IND',
    team2_id = 10, team2_name = 'West Indies',  team2_short = 'WI'
WHERE cricbuzz_match_id = 139461;

-- Matches 53-55 (Semi-Finals + Final) left as TBC — teams not yet determined

-- Fix state for all completed matches (result contains "won" or "Super Over")
UPDATE cricket_matches
SET state = 'Complete'
WHERE (result ILIKE '%won%' OR result ILIKE '%super over%')
  AND state IS DISTINCT FROM 'Complete';

-- Fix state for abandoned matches
UPDATE cricket_matches
SET state = 'Abandon'
WHERE result ILIKE '%abandon%'
  AND state IS DISTINCT FROM 'Abandon';

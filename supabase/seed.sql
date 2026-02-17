-- =============================================================
-- Seed data for local development
-- Runs automatically after all migrations during `supabase db reset`
-- =============================================================
-- Two leagues seeded:
--   1. T20 World Cup 2026 league (international, 8 national squads × 15 players)
--   2. IPL 2026 league (franchise, 10 teams × 15 players)
-- Each league has 4 test managers, draft order, and all matches linked.
-- Auth users/profiles are created dynamically on Google OAuth sign-in.

-- =============================================
-- 1. Test leagues
-- =============================================

-- T20 World Cup league
INSERT INTO leagues (
  id, name, league_manager_id, manager_count,
  active_size, bench_size,
  min_batsmen, max_batsmen, min_bowlers, min_all_rounders, min_wks, max_international,
  tournament_id, tournament_name
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Test Cricket League',
  NULL,
  4, 11, 3,
  3, 6, 3, 1, 1, 4,
  11253, 'T20 World Cup 2026'
);

-- IPL league
INSERT INTO leagues (
  id, name, league_manager_id, manager_count,
  active_size, bench_size,
  min_batsmen, max_batsmen, min_bowlers, min_all_rounders, min_wks, max_international,
  tournament_id, tournament_name
) VALUES (
  '10000000-0000-0000-0000-000000000002',
  'Test IPL Fantasy League',
  NULL,
  4, 11, 3,
  3, 6, 3, 1, 1, 4,
  9241, 'Indian Premier League 2026'
);

-- =============================================
-- 2. Scoring rules
-- =============================================

-- T20 WC scoring rules (ON CONFLICT handles the trigger-created empty row)
INSERT INTO scoring_rules (league_id, rules) VALUES (
  '10000000-0000-0000-0000-000000000001',
  '{
    "common": {
      "starting11": 5,
      "matchWinningTeam": 5,
      "impactPlayer": 5,
      "impactPlayerWinBonus": 5,
      "manOfTheMatch": 50
    },
    "batting": {
      "runs": 1,
      "four": 1,
      "six": 2,
      "milestones": [
        {"runs": 25, "points": 10},
        {"runs": 40, "points": 15},
        {"runs": 60, "points": 20},
        {"runs": 80, "points": 25},
        {"runs": 100, "points": 40},
        {"runs": 150, "points": 80}
      ],
      "duckDismissal": -10,
      "lowScoreDismissal": -5,
      "strikeRateBonuses": [
        {"minSR": 0, "maxSR": 99.99, "points": -30, "minBalls": 10},
        {"minSR": 200.01, "maxSR": 999.99, "points": 30, "minRuns": 10}
      ]
    },
    "bowling": {
      "wickets": 30,
      "milestones": [
        {"wickets": 2, "points": 10},
        {"wickets": 3, "points": 20},
        {"wickets": 4, "points": 30},
        {"wickets": 5, "points": 40},
        {"wickets": 6, "points": 60}
      ],
      "dotBall": 1,
      "lbwOrBowledBonus": 5,
      "widePenalty": -1,
      "noBallPenalty": -5,
      "maidenOver": 40,
      "economyRateBonuses": [
        {"minER": 0, "maxER": 3.99, "points": 40, "minOvers": 2},
        {"minER": 10.01, "maxER": 99.99, "points": -15, "minOvers": 2}
      ]
    },
    "fielding": {
      "catch": 10,
      "stumping": 20,
      "runOut": 10,
      "multiCatchBonus": {"count": 2, "points": 10}
    }
  }'::jsonb
) ON CONFLICT (league_id) DO UPDATE SET rules = EXCLUDED.rules;

-- IPL scoring rules (same structure, slightly different values for franchise cricket)
INSERT INTO scoring_rules (league_id, rules) VALUES (
  '10000000-0000-0000-0000-000000000002',
  '{
    "common": {
      "starting11": 5,
      "matchWinningTeam": 5,
      "impactPlayer": 5,
      "impactPlayerWinBonus": 5,
      "manOfTheMatch": 50
    },
    "batting": {
      "runs": 1,
      "four": 1,
      "six": 2,
      "milestones": [
        {"runs": 25, "points": 10},
        {"runs": 40, "points": 15},
        {"runs": 60, "points": 20},
        {"runs": 80, "points": 25},
        {"runs": 100, "points": 40},
        {"runs": 150, "points": 80}
      ],
      "duckDismissal": -10,
      "lowScoreDismissal": -5,
      "strikeRateBonuses": [
        {"minSR": 0, "maxSR": 99.99, "points": -30, "minBalls": 10},
        {"minSR": 200.01, "maxSR": 999.99, "points": 30, "minRuns": 10}
      ]
    },
    "bowling": {
      "wickets": 30,
      "milestones": [
        {"wickets": 2, "points": 10},
        {"wickets": 3, "points": 20},
        {"wickets": 4, "points": 30},
        {"wickets": 5, "points": 40},
        {"wickets": 6, "points": 60}
      ],
      "dotBall": 1,
      "lbwOrBowledBonus": 5,
      "widePenalty": -1,
      "noBallPenalty": -5,
      "maidenOver": 40,
      "economyRateBonuses": [
        {"minER": 0, "maxER": 3.99, "points": 40, "minOvers": 2},
        {"minER": 10.01, "maxER": 99.99, "points": -15, "minOvers": 2}
      ]
    },
    "fielding": {
      "catch": 10,
      "stumping": 20,
      "runOut": 10,
      "multiCatchBonus": {"count": 2, "points": 10}
    }
  }'::jsonb
) ON CONFLICT (league_id) DO UPDATE SET rules = EXCLUDED.rules;

-- =============================================
-- 3. Master players
-- =============================================
-- T20 WC: 8 national squads × 15 players = 120 players
-- IPL: 10 franchises × 15 players = 150 (shared international players reuse the same row)
-- Players who appear in both leagues share a single master_players row

-- -----------------------------------------------
-- INDIA (T20 WC) — 15 players
-- -----------------------------------------------
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Virat Kohli', 'Batsman', '1413', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000002', 'Rohit Sharma', 'Batsman', '576', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000003', 'Jasprit Bumrah', 'Bowler', '6906', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000004', 'Suryakumar Yadav', 'Batsman', '3993', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000005', 'Ravindra Jadeja', 'All Rounder', '2740', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000006', 'Rishabh Pant', 'Wicket Keeper', '8394', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000007', 'Hardik Pandya', 'All Rounder', '7400', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000008', 'Kuldeep Yadav', 'Bowler', '8292', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000009', 'Mohammed Siraj', 'Bowler', '10808', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000010', 'Shubman Gill', 'Batsman', '11808', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000011', 'Yashasvi Jaiswal', 'Batsman', '13498', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000012', 'Axar Patel', 'All Rounder', '6388', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000013', 'Arshdeep Singh', 'Bowler', '13476', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000014', 'Sanju Samson', 'Wicket Keeper', '5765', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000015', 'Yuzvendra Chahal', 'Bowler', '3667', ARRAY['India'], true);

-- -----------------------------------------------
-- AUSTRALIA (T20 WC) — 15 players
-- -----------------------------------------------
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000016', 'Pat Cummins', 'Bowler', '8658', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000017', 'Travis Head', 'Batsman', '8867', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000018', 'Mitchell Starc', 'Bowler', '4538', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000019', 'Steve Smith', 'Batsman', '4307', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000020', 'David Warner', 'Batsman', '2250', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000021', 'Glenn Maxwell', 'All Rounder', '4308', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000022', 'Josh Hazlewood', 'Bowler', '4316', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000023', 'Mitchell Marsh', 'All Rounder', '4309', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000024', 'Adam Zampa', 'Bowler', '8024', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000025', 'Marcus Stoinis', 'All Rounder', '7448', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000026', 'Alex Carey', 'Wicket Keeper', '8656', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000027', 'Cameron Green', 'All Rounder', '12471', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000028', 'Nathan Ellis', 'Bowler', '12920', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000029', 'Tim David', 'Batsman', '12651', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000030', 'Matt Short', 'All Rounder', '11267', ARRAY['Australia'], true);

-- -----------------------------------------------
-- PAKISTAN (T20 WC) — 15 players
-- -----------------------------------------------
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000031', 'Babar Azam', 'Batsman', '7691', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000032', 'Shaheen Afridi', 'Bowler', '11546', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000033', 'Mohammad Rizwan', 'Wicket Keeper', '6753', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000034', 'Fakhar Zaman', 'Batsman', '10733', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000035', 'Shadab Khan', 'All Rounder', '10736', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000036', 'Haris Rauf', 'Bowler', '13125', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000037', 'Naseem Shah', 'Bowler', '13127', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000038', 'Iftikhar Ahmed', 'All Rounder', '6769', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000039', 'Imad Wasim', 'All Rounder', '7891', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000040', 'Mohammad Nawaz', 'All Rounder', '10735', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000041', 'Saim Ayub', 'Batsman', '14266', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000042', 'Abrar Ahmed', 'Bowler', '14227', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000043', 'Mohammad Amir', 'Bowler', '2891', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000044', 'Azam Khan', 'Wicket Keeper', '13639', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000045', 'Usman Khan', 'Batsman', '19013', ARRAY['Pakistan'], true);

-- -----------------------------------------------
-- ENGLAND (T20 WC) — 15 players
-- -----------------------------------------------
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000046', 'Jos Buttler', 'Wicket Keeper', '4645', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000047', 'Joe Root', 'Batsman', '4244', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000048', 'Ben Stokes', 'All Rounder', '4694', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000049', 'Jofra Archer', 'Bowler', '12210', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000050', 'Mark Wood', 'Bowler', '7852', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000051', 'Adil Rashid', 'Bowler', '2893', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000052', 'Moeen Ali', 'All Rounder', '2724', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000053', 'Harry Brook', 'Batsman', '12727', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000054', 'Phil Salt', 'Batsman', '12205', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000055', 'Liam Livingstone', 'All Rounder', '9577', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000056', 'Sam Curran', 'All Rounder', '11262', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000057', 'Chris Jordan', 'Bowler', '4648', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000058', 'Reece Topley', 'Bowler', '6174', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000059', 'Jonny Bairstow', 'Wicket Keeper', '4246', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000060', 'Will Jacks', 'All Rounder', '12689', ARRAY['England'], true);

-- -----------------------------------------------
-- NEW ZEALAND (T20 WC) — 15 players
-- -----------------------------------------------
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000061', 'Kane Williamson', 'Batsman', '4543', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000062', 'Trent Boult', 'Bowler', '4548', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000063', 'Devon Conway', 'Batsman', '12916', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000064', 'Tim Southee', 'Bowler', '4540', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000065', 'Glenn Phillips', 'Batsman', '10745', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000066', 'Daryl Mitchell', 'All Rounder', '11266', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000067', 'Mitchell Santner', 'All Rounder', '8040', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000068', 'Lockie Ferguson', 'Bowler', '10744', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000069', 'Rachin Ravindra', 'All Rounder', '13411', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000070', 'Mark Chapman', 'Batsman', '10742', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000071', 'Tom Latham', 'Wicket Keeper', '5384', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000072', 'Matt Henry', 'Bowler', '5383', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000073', 'Ish Sodhi', 'Bowler', '6362', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000074', 'James Neesham', 'All Rounder', '5385', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000075', 'Finn Allen', 'Batsman', '13403', ARRAY['New Zealand'], true);

-- -----------------------------------------------
-- AFGHANISTAN (T20 WC) — 15 players
-- -----------------------------------------------
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000076', 'Rashid Khan', 'Bowler', '10738', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000077', 'Ibrahim Zadran', 'Batsman', '13154', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000078', 'Rahmanullah Gurbaz', 'Wicket Keeper', '13150', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000079', 'Fazalhaq Farooqi', 'Bowler', '13157', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000080', 'Naveen-ul-Haq', 'Bowler', '13152', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000081', 'Azmatullah Omarzai', 'All Rounder', '14263', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000082', 'Najibullah Zadran', 'Batsman', '9905', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000083', 'Mohammad Nabi', 'All Rounder', '2796', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000084', 'Mujeeb Ur Rahman', 'Bowler', '11544', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000085', 'Gulbadin Naib', 'All Rounder', '7543', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000086', 'Karim Janat', 'All Rounder', '11541', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000087', 'Noor Ahmad', 'Bowler', '14261', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000088', 'Hazratullah Zazai', 'Batsman', '11543', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000089', 'Sediqullah Atal', 'Batsman', '14204', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000090', 'Ikram Alikhil', 'Wicket Keeper', '13155', ARRAY['Afghanistan'], true);

-- -----------------------------------------------
-- SOUTH AFRICA (T20 WC) — 15 players
-- -----------------------------------------------
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000091', 'Quinton de Kock', 'Wicket Keeper', '5486', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000092', 'Kagiso Rabada', 'Bowler', '8343', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000093', 'Aiden Markram', 'Batsman', '10962', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000094', 'David Miller', 'Batsman', '4863', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000095', 'Anrich Nortje', 'Bowler', '12483', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000096', 'Marco Jansen', 'All Rounder', '13277', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000097', 'Heinrich Klaasen', 'Wicket Keeper', '10961', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000098', 'Keshav Maharaj', 'Bowler', '8974', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000099', 'Tristan Stubbs', 'Batsman', '14244', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000100', 'Reeza Hendricks', 'Batsman', '7285', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000101', 'Lungi Ngidi', 'Bowler', '10960', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000102', 'Tabraiz Shamsi', 'Bowler', '9018', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000103', 'Rassie van der Dussen', 'Batsman', '11557', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000104', 'Gerald Coetzee', 'Bowler', '14240', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000105', 'Ryan Rickelton', 'Batsman', '12487', ARRAY['South Africa'], true);

-- -----------------------------------------------
-- WEST INDIES (T20 WC) — 15 players
-- -----------------------------------------------
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000106', 'Nicholas Pooran', 'Wicket Keeper', '10803', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000107', 'Andre Russell', 'All Rounder', '2251', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000108', 'Shimron Hetmyer', 'Batsman', '10805', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000109', 'Shai Hope', 'Wicket Keeper', '8124', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000110', 'Alzarri Joseph', 'Bowler', '10807', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000111', 'Akeal Hosein', 'Bowler', '10818', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000112', 'Kyle Mayers', 'All Rounder', '12919', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000113', 'Rovman Powell', 'Batsman', '10804', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000114', 'Brandon King', 'Batsman', '13640', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000115', 'Gudakesh Motie', 'Bowler', '14221', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000116', 'Roston Chase', 'All Rounder', '8127', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000117', 'Obed McCoy', 'Bowler', '12918', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000118', 'Johnson Charles', 'Batsman', '4874', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000119', 'Romario Shepherd', 'All Rounder', '12917', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000120', 'Shamar Joseph', 'Bowler', '14222', ARRAY['West Indies'], true);

-- -----------------------------------------------
-- IPL FRANCHISE PLAYERS (150 players, 10 teams × 15)
-- Players who also play internationally share the same master_players row
-- via the T20 WC entries above. IPL-only players get new rows.
-- -----------------------------------------------

-- CSK — Chennai Super Kings (15 players)
-- Shared: Jadeja (005), Moeen Ali (052), Conway (063), Gurbaz (078), Rachin Ravindra (069), Noor Ahmad (087)
-- Deepak Chahar (126) moved to MI; Mukesh Choudhary (240) added as replacement
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000121', 'Ruturaj Gaikwad', 'Batsman', '12092', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000122', 'MS Dhoni', 'Wicket Keeper', '1627', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000123', 'Matheesha Pathirana', 'Bowler', '14253', ARRAY['Sri Lanka'], true),
  ('30000000-0000-0000-0000-000000000125', 'Shardul Thakur', 'All Rounder', '8099', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000126', 'Deepak Chahar', 'Bowler', '8510', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000127', 'Shivam Dube', 'All Rounder', '11809', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000128', 'Ravichandran Ashwin', 'Bowler', '2270', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000129', 'Ajinkya Rahane', 'Batsman', '2837', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000130', 'Tushar Deshpande', 'Bowler', '12093', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000240', 'Mukesh Choudhary', 'Bowler', '13184', ARRAY['India'], true);

-- MI — Mumbai Indians (15 players)
-- Shared: Rohit (002), Bumrah (003), Hardik (007), Tim David (029), Suryakumar (004),
--         Trent Boult (062), Will Jacks (060), Deepak Chahar (126)
-- Pooran moved to LSG; Sherfane Rutherford (241) added as replacement
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000132', 'Ishan Kishan', 'Wicket Keeper', '9560', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000133', 'Tilak Varma', 'Batsman', '14256', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000136', 'Dewald Brevis', 'Batsman', '14245', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000137', 'Piyush Chawla', 'Bowler', '2268', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000138', 'Nehal Wadhera', 'Batsman', '14260', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000139', 'Naman Dhir', 'All Rounder', '36139', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000241', 'Sherfane Rutherford', 'All Rounder', '13748', ARRAY['West Indies'], true);

-- RCB — Royal Challengers Bengaluru (15 players)
-- Shared: Kohli (001), Hazlewood (022), Glenn Maxwell (021), Mohammed Siraj (009),
--         Lockie Ferguson (068), Liam Livingstone (055)
-- Phil Salt moved to KKR; Mahipal Lomror (242) added as replacement
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000142', 'Faf du Plessis', 'Batsman', '2498', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000144', 'Dinesh Karthik', 'Wicket Keeper', '1559', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000146', 'Rajat Patidar', 'Batsman', '13098', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000147', 'Swapnil Singh', 'All Rounder', '10238', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000148', 'Yash Dayal', 'Bowler', '14258', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000149', 'Vyshak Vijaykumar', 'Bowler', '10486', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000150', 'Manoj Bhandage', 'All Rounder', '13962', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000151', 'Suyash Sharma', 'Bowler', '36487', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000242', 'Mahipal Lomror', 'All Rounder', '10954', ARRAY['India'], true);

-- KKR — Kolkata Knight Riders (15 players)
-- Shared: Russell (107), Phil Salt (054)
-- Starc moved to DC, SKY moved to MI; Manish Pandey (243) and Allah Ghazanfar (251) added
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000154', 'Shreyas Iyer', 'Batsman', '6439', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000155', 'Rinku Singh', 'Batsman', '11811', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000156', 'Sunil Narine', 'All Rounder', '2883', ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000157', 'Varun Chakravarthy', 'Bowler', '12694', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000158', 'Venkatesh Iyer', 'All Rounder', '13419', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000159', 'Nitish Rana', 'Batsman', '9568', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000160', 'Harshit Rana', 'Bowler', '14262', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000161', 'Ramandeep Singh', 'All Rounder', '13474', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000162', 'Anukul Roy', 'All Rounder', '11542', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000163', 'Vaibhav Arora', 'Bowler', '13454', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000165', 'Angkrish Raghuvanshi', 'Batsman', '22566', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000243', 'Manish Pandey', 'Batsman', '1836', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000251', 'Allah Ghazanfar', 'Bowler', '36501', ARRAY['Afghanistan'], true);

-- DC — Delhi Capitals (15 players)
-- Shared: Pant (006), Axar (012), Kuldeep (008), Mitchell Starc (018),
--         Tristan Stubbs (099), Harry Brook (053)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000166', 'Jake Fraser-McGurk', 'Batsman', '14249', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000168', 'Abishek Porel', 'Wicket Keeper', '14257', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000170', 'Ishant Sharma', 'Bowler', '2261', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000171', 'Khaleel Ahmed', 'Bowler', '11552', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000172', 'Mukesh Kumar', 'Bowler', '13417', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000173', 'Pravin Dubey', 'Bowler', '12084', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000174', 'Kumar Kushagra', 'Wicket Keeper', '15779', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000175', 'Ricky Bhui', 'Batsman', '9425', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000176', 'Sumit Kumar', 'Batsman', '10305', ARRAY['India'], true);

-- GT — Gujarat Titans (15 players)
-- Shared: Gill (010), Rashid Khan (076), Azmatullah Omarzai (081), Kane Williamson (061)
-- Noor Ahmad moved to CSK; Mohit Sharma (244) added as replacement
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000178', 'Sai Sudharsan', 'Batsman', '14259', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000179', 'Wriddhiman Saha', 'Wicket Keeper', '2836', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000180', 'Mohammed Shami', 'Bowler', '6738', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000182', 'Sai Kishore', 'Bowler', '12095', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000183', 'Vijay Shankar', 'All Rounder', '9571', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000184', 'Abhinav Manohar', 'Batsman', '10499', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000185', 'Darshan Nalkande', 'All Rounder', '13458', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000186', 'Spencer Johnson', 'Bowler', '13143', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000188', 'Matthew Wade', 'Wicket Keeper', '4537', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000190', 'Rahul Tewatia', 'All Rounder', '9564', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000244', 'Mohit Sharma', 'Bowler', '8181', ARRAY['India'], true);

-- LSG — Lucknow Super Giants (15 players)
-- Shared: Marcus Stoinis (025), Naveen-ul-Haq (080), Matt Henry (072),
--         Nicholas Pooran (106), Quinton de Kock (091)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000191', 'KL Rahul', 'Wicket Keeper', '7737', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000193', 'Ravi Bishnoi', 'Bowler', '13472', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000194', 'Krunal Pandya', 'All Rounder', '7399', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000195', 'Avesh Khan', 'Bowler', '10811', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000196', 'Devdutt Padikkal', 'Batsman', '12698', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000197', 'Ayush Badoni', 'Batsman', '14254', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000198', 'Deepak Hooda', 'All Rounder', '7395', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000203', 'Mohsin Khan', 'Bowler', '13483', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000245', 'Manan Vohra', 'Batsman', '8358', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000246', 'Prerak Mankad', 'All Rounder', '11054', ARRAY['India'], true);

-- PBKS — Punjab Kings (15 players)
-- Shared: Arshdeep (013), Bairstow (059), Sam Curran (056), Kagiso Rabada (092),
--         Nathan Ellis (028), Jaiswal (011)
-- Liam Livingstone moved to RCB; Josh Inglis (247) added as replacement
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000204', 'Shikhar Dhawan', 'Batsman', '2264', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000207', 'Jitesh Sharma', 'Wicket Keeper', '13475', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000209', 'Rahul Chahar', 'Bowler', '11806', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000210', 'Prabhsimran Singh', 'Batsman', '12085', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000211', 'Harpreet Brar', 'All Rounder', '11807', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000213', 'Atharva Taide', 'Batsman', '13914', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000214', 'Vishwanath Pratap Singh', 'Bowler', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000215', 'Rilee Rossouw', 'Batsman', '7282', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000247', 'Josh Inglis', 'Wicket Keeper', '10637', ARRAY['Australia'], true);

-- RR — Rajasthan Royals (15 players)
-- Shared: Buttler (046), Chahal (015), Samson (014), Shimron Hetmyer (108)
-- Trent Boult moved to MI, Ashwin stays in CSK, Avesh Khan stays in LSG
-- Replacements: Wanindu Hasaranga (248), Maheesh Theekshana (249), Prasidh Krishna (250)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000218', 'Riyan Parag', 'All Rounder', '13471', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000219', 'Dhruv Jurel', 'Wicket Keeper', '14255', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000221', 'Sandeep Sharma', 'Bowler', '6390', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000222', 'Navdeep Saini', 'Bowler', '10812', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000223', 'Nandre Burger', 'Bowler', '13630', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000224', 'Donovan Ferreira', 'All Rounder', '14798', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000225', 'Tom Kohler-Cadmore', 'Batsman', '10033', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000226', 'Kunal Rathore', 'Batsman', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000248', 'Wanindu Hasaranga', 'All Rounder', '10926', ARRAY['Sri Lanka'], true),
  ('30000000-0000-0000-0000-000000000249', 'Maheesh Theekshana', 'Bowler', '18504', ARRAY['Sri Lanka'], true),
  ('30000000-0000-0000-0000-000000000250', 'Prasidh Krishna', 'Bowler', '10551', ARRAY['India'], true);

-- SRH — Sunrisers Hyderabad (15 players)
-- Shared: Head (017), Klaasen (097), Cummins (016), Glenn Phillips (065), Marco Jansen (096)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000228', 'Abhishek Sharma', 'All Rounder', '13466', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000229', 'Bhuvneshwar Kumar', 'Bowler', '2839', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000230', 'Umran Malik', 'Bowler', '14252', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000231', 'Washington Sundar', 'All Rounder', '10809', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000232', 'Abdul Samad', 'Batsman', '13467', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000233', 'Rahul Tripathi', 'Batsman', '10813', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000235', 'Mayank Agarwal', 'Batsman', '6408', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000236', 'Jaydev Unadkat', 'Bowler', '6438', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000238', 'Anmolpreet Singh', 'Batsman', '12082', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000239', 'Nitish Reddy', 'All Rounder', '14264', ARRAY['India'], true);

-- =============================================
-- 4. League player pool — T20 WC league
-- =============================================
-- All 120 international players linked to the T20 WC league with team_override

INSERT INTO league_player_pool (league_id, player_id, is_available, team_override) VALUES
  -- India (15)
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000008', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000009', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000010', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000012', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000013', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000014', true, 'India'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000015', true, 'India'),
  -- Australia (15)
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000016', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000017', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000018', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000019', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000020', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000021', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000022', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000023', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000024', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000025', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000026', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000027', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000028', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000029', true, 'Australia'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000030', true, 'Australia'),
  -- Pakistan (15)
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000031', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000032', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000033', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000034', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000035', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000036', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000037', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000038', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000039', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000040', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000041', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000042', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000043', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000044', true, 'Pakistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000045', true, 'Pakistan'),
  -- England (15)
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000046', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000047', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000048', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000049', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000050', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000051', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000052', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000053', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000054', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000055', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000056', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000057', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000058', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000059', true, 'England'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000060', true, 'England'),
  -- New Zealand (15)
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000061', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000062', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000063', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000064', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000065', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000066', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000067', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000068', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000069', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000070', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000071', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000072', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000073', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000074', true, 'New Zealand'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000075', true, 'New Zealand'),
  -- Afghanistan (15)
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000076', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000077', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000078', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000079', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000080', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000081', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000082', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000083', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000084', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000085', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000086', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000087', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000088', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000089', true, 'Afghanistan'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000090', true, 'Afghanistan'),
  -- South Africa (15)
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000091', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000092', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000093', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000094', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000095', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000096', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000097', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000098', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000099', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000100', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000101', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000102', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000103', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000104', true, 'South Africa'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000105', true, 'South Africa'),
  -- West Indies (15)
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000106', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000107', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000108', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000109', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000110', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000111', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000112', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000113', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000114', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000115', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000116', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000117', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000118', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000119', true, 'West Indies'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000120', true, 'West Indies');

-- =============================================
-- 5. League player pool — IPL league
-- =============================================
-- Each franchise gets 15 players (mix of shared international + IPL-only)
-- Each player appears in exactly one IPL team (no duplicates)

INSERT INTO league_player_pool (league_id, player_id, is_available, team_override) VALUES
  -- CSK (15): Jadeja, Moeen, Conway, Gurbaz, Rachin Ravindra, Noor Ahmad + CSK-specific
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000052', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000063', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000078', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000069', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000087', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000121', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000122', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000123', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000125', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000127', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000128', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000129', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000130', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000240', true, 'Chennai Super Kings'),
  -- MI (15): Rohit, Bumrah, Hardik, Tim David, SKY, Boult, Jacks, Chahar + MI-specific
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000007', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000029', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000062', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000060', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000126', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000132', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000133', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000136', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000137', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000138', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000139', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000241', true, 'Mumbai Indians'),
  -- RCB (15): Kohli, Hazlewood, Maxwell, Siraj, Ferguson, Livingstone + RCB-specific
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000022', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000021', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000009', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000068', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000055', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000142', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000144', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000146', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000147', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000148', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000149', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000150', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000151', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000242', true, 'Royal Challengers Bengaluru'),
  -- KKR (15): Russell, Phil Salt + KKR-specific
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000107', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000054', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000154', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000155', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000156', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000157', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000158', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000159', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000160', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000161', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000162', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000163', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000165', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000243', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000251', true, 'Kolkata Knight Riders'),
  -- DC (15): Pant, Axar, Kuldeep, Starc, Stubbs, Brook + DC-specific
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000006', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000012', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000008', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000018', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000099', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000053', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000166', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000168', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000170', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000171', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000172', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000173', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000174', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000175', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000176', true, 'Delhi Capitals'),
  -- GT (15): Gill, Rashid Khan, Omarzai, Williamson + GT-specific
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000010', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000076', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000081', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000061', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000178', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000179', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000180', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000182', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000183', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000184', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000185', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000186', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000188', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000190', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000244', true, 'Gujarat Titans'),
  -- LSG (15): Stoinis, Naveen, Matt Henry, Pooran, de Kock + LSG-specific
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000025', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000080', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000072', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000106', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000091', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000191', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000193', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000194', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000195', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000196', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000197', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000198', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000203', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000245', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000246', true, 'Lucknow Super Giants'),
  -- PBKS (15): Arshdeep, Bairstow, Sam Curran, Rabada, Nathan Ellis, Jaiswal + PBKS-specific
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000013', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000059', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000056', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000092', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000028', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000011', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000204', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000207', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000209', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000210', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000211', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000213', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000214', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000215', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000247', true, 'Punjab Kings'),
  -- RR (15): Buttler, Chahal, Samson, Hetmyer + RR-specific
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000046', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000015', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000014', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000108', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000218', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000219', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000221', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000222', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000223', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000224', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000225', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000226', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000248', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000249', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000250', true, 'Rajasthan Royals'),
  -- SRH (15): Head, Klaasen, Cummins, Glenn Phillips, Marco Jansen + SRH-specific
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000017', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000097', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000016', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000065', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000096', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000228', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000229', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000230', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000231', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000232', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000233', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000235', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000236', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000238', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000239', true, 'Sunrisers Hyderabad');

-- =============================================
-- 6. Link T20 WC matches to the T20 WC league (all matches, no LIMIT)
-- =============================================
INSERT INTO league_matches (league_id, match_id, week)
SELECT
  '10000000-0000-0000-0000-000000000001',
  id,
  match_week
FROM cricket_matches
WHERE series_id = 11253;

-- =============================================
-- 7. Seed IPL 2026 matches into cricket_matches
-- =============================================
-- 20 league-stage matches (representative subset for dev/testing)
INSERT INTO cricket_matches (
  cricbuzz_match_id, series_id, match_description, match_format,
  match_date, state, result,
  team1_id, team1_name, team1_short,
  team2_id, team2_name, team2_short,
  venue, city, match_week
) VALUES
  (200001, 9241, '1st Match', 'T20', '2026-03-14T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 14, 14:00 GMT', 201, 'Chennai Super Kings', 'CSK', 202, 'Mumbai Indians', 'MI', 'MA Chidambaram Stadium', 'Chennai', 1),
  (200002, 9241, '2nd Match', 'T20', '2026-03-15T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 15, 14:00 GMT', 203, 'Royal Challengers Bengaluru', 'RCB', 204, 'Kolkata Knight Riders', 'KKR', 'M.Chinnaswamy Stadium', 'Bengaluru', 1),
  (200003, 9241, '3rd Match', 'T20', '2026-03-16T10:00:00.000Z', 'Upcoming', 'Match starts at Mar 16, 10:00 GMT', 205, 'Delhi Capitals', 'DC', 206, 'Gujarat Titans', 'GT', 'Arun Jaitley Stadium', 'Delhi', 1),
  (200004, 9241, '4th Match', 'T20', '2026-03-16T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 16, 14:00 GMT', 207, 'Lucknow Super Giants', 'LSG', 208, 'Punjab Kings', 'PBKS', 'BRSABV Ekana Cricket Stadium', 'Lucknow', 1),
  (200005, 9241, '5th Match', 'T20', '2026-03-17T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 17, 14:00 GMT', 209, 'Rajasthan Royals', 'RR', 210, 'Sunrisers Hyderabad', 'SRH', 'Sawai Mansingh Stadium', 'Jaipur', 1),
  (200006, 9241, '6th Match', 'T20', '2026-03-18T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 18, 14:00 GMT', 202, 'Mumbai Indians', 'MI', 203, 'Royal Challengers Bengaluru', 'RCB', 'Wankhede Stadium', 'Mumbai', 2),
  (200007, 9241, '7th Match', 'T20', '2026-03-19T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 19, 14:00 GMT', 204, 'Kolkata Knight Riders', 'KKR', 205, 'Delhi Capitals', 'DC', 'Eden Gardens', 'Kolkata', 2),
  (200008, 9241, '8th Match', 'T20', '2026-03-20T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 20, 14:00 GMT', 206, 'Gujarat Titans', 'GT', 207, 'Lucknow Super Giants', 'LSG', 'Narendra Modi Stadium', 'Ahmedabad', 2),
  (200009, 9241, '9th Match', 'T20', '2026-03-21T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 21, 14:00 GMT', 208, 'Punjab Kings', 'PBKS', 209, 'Rajasthan Royals', 'RR', 'IS Bindra Stadium', 'Mohali', 2),
  (200010, 9241, '10th Match', 'T20', '2026-03-22T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 22, 14:00 GMT', 210, 'Sunrisers Hyderabad', 'SRH', 201, 'Chennai Super Kings', 'CSK', 'Rajiv Gandhi Intl Cricket Stadium', 'Hyderabad', 2),
  (200011, 9241, '11th Match', 'T20', '2026-03-23T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 23, 14:00 GMT', 201, 'Chennai Super Kings', 'CSK', 204, 'Kolkata Knight Riders', 'KKR', 'MA Chidambaram Stadium', 'Chennai', 3),
  (200012, 9241, '12th Match', 'T20', '2026-03-24T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 24, 14:00 GMT', 202, 'Mumbai Indians', 'MI', 206, 'Gujarat Titans', 'GT', 'Wankhede Stadium', 'Mumbai', 3),
  (200013, 9241, '13th Match', 'T20', '2026-03-25T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 25, 14:00 GMT', 203, 'Royal Challengers Bengaluru', 'RCB', 208, 'Punjab Kings', 'PBKS', 'M.Chinnaswamy Stadium', 'Bengaluru', 3),
  (200014, 9241, '14th Match', 'T20', '2026-03-26T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 26, 14:00 GMT', 205, 'Delhi Capitals', 'DC', 210, 'Sunrisers Hyderabad', 'SRH', 'Arun Jaitley Stadium', 'Delhi', 3),
  (200015, 9241, '15th Match', 'T20', '2026-03-27T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 27, 14:00 GMT', 207, 'Lucknow Super Giants', 'LSG', 209, 'Rajasthan Royals', 'RR', 'BRSABV Ekana Cricket Stadium', 'Lucknow', 3),
  (200016, 9241, '16th Match', 'T20', '2026-03-28T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 28, 14:00 GMT', 204, 'Kolkata Knight Riders', 'KKR', 202, 'Mumbai Indians', 'MI', 'Eden Gardens', 'Kolkata', 4),
  (200017, 9241, '17th Match', 'T20', '2026-03-29T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 29, 14:00 GMT', 206, 'Gujarat Titans', 'GT', 203, 'Royal Challengers Bengaluru', 'RCB', 'Narendra Modi Stadium', 'Ahmedabad', 4),
  (200018, 9241, '18th Match', 'T20', '2026-03-30T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 30, 14:00 GMT', 210, 'Sunrisers Hyderabad', 'SRH', 207, 'Lucknow Super Giants', 'LSG', 'Rajiv Gandhi Intl Cricket Stadium', 'Hyderabad', 4),
  (200019, 9241, '19th Match', 'T20', '2026-03-31T14:00:00.000Z', 'Upcoming', 'Match starts at Mar 31, 14:00 GMT', 209, 'Rajasthan Royals', 'RR', 205, 'Delhi Capitals', 'DC', 'Sawai Mansingh Stadium', 'Jaipur', 4),
  (200020, 9241, '20th Match', 'T20', '2026-04-01T14:00:00.000Z', 'Upcoming', 'Match starts at Apr 01, 14:00 GMT', 208, 'Punjab Kings', 'PBKS', 201, 'Chennai Super Kings', 'CSK', 'IS Bindra Stadium', 'Mohali', 4);

-- Link IPL matches to IPL league
INSERT INTO league_matches (league_id, match_id, week)
SELECT
  '10000000-0000-0000-0000-000000000002',
  id,
  match_week
FROM cricket_matches
WHERE series_id = 9241;

-- =============================================
-- 8. Managers — 4 per league
-- =============================================

-- T20 WC managers
INSERT INTO managers (id, name, team_name, league_id, user_id) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Test Manager 1', 'Chennai Chargers', '10000000-0000-0000-0000-000000000001', NULL),
  ('20000000-0000-0000-0000-000000000002', 'Test Manager 2', 'Mumbai Mavericks', '10000000-0000-0000-0000-000000000001', NULL),
  ('20000000-0000-0000-0000-000000000003', 'Test Manager 3', 'Delhi Dragons', '10000000-0000-0000-0000-000000000001', NULL),
  ('20000000-0000-0000-0000-000000000004', 'Test Manager 4', 'Bangalore Blazers', '10000000-0000-0000-0000-000000000001', NULL);

-- IPL managers
INSERT INTO managers (id, name, team_name, league_id, user_id) VALUES
  ('20000000-0000-0000-0000-000000000005', 'IPL Manager 1', 'Fantasy Flames', '10000000-0000-0000-0000-000000000002', NULL),
  ('20000000-0000-0000-0000-000000000006', 'IPL Manager 2', 'Turbo Titans', '10000000-0000-0000-0000-000000000002', NULL),
  ('20000000-0000-0000-0000-000000000007', 'IPL Manager 3', 'Royal Strikers', '10000000-0000-0000-0000-000000000002', NULL),
  ('20000000-0000-0000-0000-000000000008', 'IPL Manager 4', 'Knight Warriors', '10000000-0000-0000-0000-000000000002', NULL);

-- =============================================
-- 9. Draft state and draft order
-- =============================================

-- T20 WC league draft
INSERT INTO draft_state (league_id, is_finalized) VALUES
  ('10000000-0000-0000-0000-000000000001', false);

INSERT INTO draft_order (league_id, position, manager_id) VALUES
  ('10000000-0000-0000-0000-000000000001', 1, '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000001', 2, '20000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000001', 3, '20000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000001', 4, '20000000-0000-0000-0000-000000000004');

-- IPL league draft (finalized — post-draft state)
INSERT INTO draft_state (league_id, is_finalized, finalized_at) VALUES
  ('10000000-0000-0000-0000-000000000002', true, '2026-03-13T12:00:00.000Z');

INSERT INTO draft_order (league_id, position, manager_id) VALUES
  ('10000000-0000-0000-0000-000000000002', 1, '20000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000002', 2, '20000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000002', 3, '20000000-0000-0000-0000-000000000007'),
  ('10000000-0000-0000-0000-000000000002', 4, '20000000-0000-0000-0000-000000000008');

-- =============================================
-- 10. IPL draft picks (56 rows: 14 rounds × 4 managers, snake draft)
-- =============================================
-- Odd rounds: Mgr5→Mgr6→Mgr7→Mgr8 (positions 1-4)
-- Even rounds: Mgr8→Mgr7→Mgr6→Mgr5 (positions 1-4)
--
-- Manager 5 (Fantasy Flames): Kohli, Bumrah, Gaikwad, Jadeja, Pant, S.Iyer, Chakravarthy, Shami, Cummins, Narine, Abhishek S., Bishnoi, Head, Ashwin
-- Manager 6 (Turbo Titans):   SKY, Gill, Hardik, Kishan, Kuldeep, Arshdeep, Bhuvi, Parag, Klaasen, Rashid Khan, Faf, Tilak, Krunal, Buttler
-- Manager 7 (Royal Strikers):  Jaiswal, Rinku, Sudharsan, Axar, Samson, Siraj, Chahal, Avesh, Hazlewood, Russell, Starc, Patidar, V.Iyer, Pooran
-- Manager 8 (Knight Warriors): Dhawan, Padikkal, KL Rahul, W.Sundar, Dube, R.Chahar, Umran, Khaleel, Stoinis, Salt, Rabada, Fraser-McGurk, Badoni, Ishant

INSERT INTO draft_picks (league_id, round, pick_position, manager_id, player_id) VALUES
  -- Round 1 (odd): Mgr5, Mgr6, Mgr7, Mgr8
  ('10000000-0000-0000-0000-000000000002', 1, 1, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001'),  -- Kohli
  ('10000000-0000-0000-0000-000000000002', 1, 2, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000004'),  -- SKY
  ('10000000-0000-0000-0000-000000000002', 1, 3, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000011'),  -- Jaiswal
  ('10000000-0000-0000-0000-000000000002', 1, 4, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000204'),  -- Dhawan
  -- Round 2 (even): Mgr8, Mgr7, Mgr6, Mgr5
  ('10000000-0000-0000-0000-000000000002', 2, 1, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000196'),  -- Padikkal
  ('10000000-0000-0000-0000-000000000002', 2, 2, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000155'),  -- Rinku
  ('10000000-0000-0000-0000-000000000002', 2, 3, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000010'),  -- Gill
  ('10000000-0000-0000-0000-000000000002', 2, 4, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003'),  -- Bumrah
  -- Round 3 (odd)
  ('10000000-0000-0000-0000-000000000002', 3, 1, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000121'),  -- Gaikwad
  ('10000000-0000-0000-0000-000000000002', 3, 2, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000007'),  -- Hardik
  ('10000000-0000-0000-0000-000000000002', 3, 3, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000178'),  -- Sudharsan
  ('10000000-0000-0000-0000-000000000002', 3, 4, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000191'),  -- KL Rahul
  -- Round 4 (even)
  ('10000000-0000-0000-0000-000000000002', 4, 1, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000231'),  -- W.Sundar
  ('10000000-0000-0000-0000-000000000002', 4, 2, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000012'),  -- Axar
  ('10000000-0000-0000-0000-000000000002', 4, 3, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000132'),  -- Kishan
  ('10000000-0000-0000-0000-000000000002', 4, 4, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005'),  -- Jadeja
  -- Round 5 (odd)
  ('10000000-0000-0000-0000-000000000002', 5, 1, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000006'),  -- Pant
  ('10000000-0000-0000-0000-000000000002', 5, 2, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000008'),  -- Kuldeep
  ('10000000-0000-0000-0000-000000000002', 5, 3, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000014'),  -- Samson
  ('10000000-0000-0000-0000-000000000002', 5, 4, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000127'),  -- Dube
  -- Round 6 (even)
  ('10000000-0000-0000-0000-000000000002', 6, 1, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000209'),  -- R.Chahar
  ('10000000-0000-0000-0000-000000000002', 6, 2, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000009'),  -- Siraj
  ('10000000-0000-0000-0000-000000000002', 6, 3, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000013'),  -- Arshdeep
  ('10000000-0000-0000-0000-000000000002', 6, 4, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000154'),  -- S.Iyer
  -- Round 7 (odd)
  ('10000000-0000-0000-0000-000000000002', 7, 1, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000157'),  -- Chakravarthy
  ('10000000-0000-0000-0000-000000000002', 7, 2, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000229'),  -- Bhuvi
  ('10000000-0000-0000-0000-000000000002', 7, 3, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000015'),  -- Chahal
  ('10000000-0000-0000-0000-000000000002', 7, 4, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000230'),  -- Umran
  -- Round 8 (even)
  ('10000000-0000-0000-0000-000000000002', 8, 1, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000171'),  -- Khaleel
  ('10000000-0000-0000-0000-000000000002', 8, 2, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000195'),  -- Avesh
  ('10000000-0000-0000-0000-000000000002', 8, 3, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000218'),  -- Parag
  ('10000000-0000-0000-0000-000000000002', 8, 4, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000180'),  -- Shami
  -- Round 9 (odd)
  ('10000000-0000-0000-0000-000000000002', 9, 1, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000016'),  -- Cummins
  ('10000000-0000-0000-0000-000000000002', 9, 2, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000097'),  -- Klaasen
  ('10000000-0000-0000-0000-000000000002', 9, 3, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000022'),  -- Hazlewood
  ('10000000-0000-0000-0000-000000000002', 9, 4, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000025'),  -- Stoinis
  -- Round 10 (even)
  ('10000000-0000-0000-0000-000000000002', 10, 1, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000054'),  -- Salt
  ('10000000-0000-0000-0000-000000000002', 10, 2, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000107'),  -- Russell
  ('10000000-0000-0000-0000-000000000002', 10, 3, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000076'),  -- Rashid Khan
  ('10000000-0000-0000-0000-000000000002', 10, 4, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000156'),  -- Narine
  -- Round 11 (odd)
  ('10000000-0000-0000-0000-000000000002', 11, 1, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000228'),  -- Abhishek S.
  ('10000000-0000-0000-0000-000000000002', 11, 2, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000142'),  -- Faf
  ('10000000-0000-0000-0000-000000000002', 11, 3, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000018'),  -- Starc
  ('10000000-0000-0000-0000-000000000002', 11, 4, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000092'),  -- Rabada
  -- Round 12 (even)
  ('10000000-0000-0000-0000-000000000002', 12, 1, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000166'),  -- Fraser-McGurk
  ('10000000-0000-0000-0000-000000000002', 12, 2, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000146'),  -- Patidar
  ('10000000-0000-0000-0000-000000000002', 12, 3, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000133'),  -- Tilak
  ('10000000-0000-0000-0000-000000000002', 12, 4, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000193'),  -- Bishnoi
  -- Round 13 (odd)
  ('10000000-0000-0000-0000-000000000002', 13, 1, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000017'),  -- Head
  ('10000000-0000-0000-0000-000000000002', 13, 2, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000194'),  -- Krunal
  ('10000000-0000-0000-0000-000000000002', 13, 3, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000158'),  -- V.Iyer
  ('10000000-0000-0000-0000-000000000002', 13, 4, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000197'),  -- Badoni
  -- Round 14 (even)
  ('10000000-0000-0000-0000-000000000002', 14, 1, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000170'),  -- Ishant
  ('10000000-0000-0000-0000-000000000002', 14, 2, '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000106'),  -- Pooran
  ('10000000-0000-0000-0000-000000000002', 14, 3, '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000046'),  -- Buttler
  ('10000000-0000-0000-0000-000000000002', 14, 4, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000128');  -- Ashwin

-- =============================================
-- 11. IPL manager rosters (56 rows: 4 managers × 14 players)
-- =============================================
-- Each manager: 11 active + 3 bench

INSERT INTO manager_roster (manager_id, player_id, league_id, slot_type, position) VALUES
  -- Manager 5 (Fantasy Flames) — Active 11
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'active', 1),   -- Kohli (Bat)
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000121', '10000000-0000-0000-0000-000000000002', 'active', 2),   -- Gaikwad (Bat)
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000154', '10000000-0000-0000-0000-000000000002', 'active', 3),   -- S.Iyer (Bat)
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'active', 4),   -- Jadeja (AR)
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000156', '10000000-0000-0000-0000-000000000002', 'active', 5),   -- Narine (AR)
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000228', '10000000-0000-0000-0000-000000000002', 'active', 6),   -- Abhishek S. (AR)
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'active', 7),   -- Pant (WK)
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'active', 8),   -- Bumrah (Bowl)
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000157', '10000000-0000-0000-0000-000000000002', 'active', 9),   -- Chakravarthy (Bowl)
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000180', '10000000-0000-0000-0000-000000000002', 'active', 10),  -- Shami (Bowl)
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000002', 'active', 11),  -- Cummins (Bowl)
  -- Manager 5 — Bench 3
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000193', '10000000-0000-0000-0000-000000000002', 'bench', 1),    -- Bishnoi (Bowl)
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000002', 'bench', 2),    -- Head (Bat)
  ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000128', '10000000-0000-0000-0000-000000000002', 'bench', 3),    -- Ashwin (Bowl)

  -- Manager 6 (Turbo Titans) — Active 11
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'active', 1),   -- SKY (Bat)
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000002', 'active', 2),   -- Gill (Bat)
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000142', '10000000-0000-0000-0000-000000000002', 'active', 3),   -- Faf (Bat)
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'active', 4),   -- Hardik (AR)
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000218', '10000000-0000-0000-0000-000000000002', 'active', 5),   -- Parag (AR)
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000132', '10000000-0000-0000-0000-000000000002', 'active', 6),   -- Kishan (WK)
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000097', '10000000-0000-0000-0000-000000000002', 'active', 7),   -- Klaasen (WK)
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', 'active', 8),   -- Kuldeep (Bowl)
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000002', 'active', 9),   -- Arshdeep (Bowl)
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000229', '10000000-0000-0000-0000-000000000002', 'active', 10),  -- Bhuvi (Bowl)
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000076', '10000000-0000-0000-0000-000000000002', 'active', 11),  -- Rashid Khan (Bowl)
  -- Manager 6 — Bench 3
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000133', '10000000-0000-0000-0000-000000000002', 'bench', 1),    -- Tilak (Bat)
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000194', '10000000-0000-0000-0000-000000000002', 'bench', 2),    -- Krunal (AR)
  ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000046', '10000000-0000-0000-0000-000000000002', 'bench', 3),    -- Buttler (WK)

  -- Manager 7 (Royal Strikers) — Active 11
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000002', 'active', 1),   -- Jaiswal (Bat)
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000155', '10000000-0000-0000-0000-000000000002', 'active', 2),   -- Rinku (Bat)
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000178', '10000000-0000-0000-0000-000000000002', 'active', 3),   -- Sudharsan (Bat)
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000002', 'active', 4),   -- Axar (AR)
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000107', '10000000-0000-0000-0000-000000000002', 'active', 5),   -- Russell (AR)
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000002', 'active', 6),   -- Samson (WK)
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', 'active', 7),   -- Siraj (Bowl)
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000002', 'active', 8),   -- Chahal (Bowl)
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000195', '10000000-0000-0000-0000-000000000002', 'active', 9),   -- Avesh (Bowl)
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000002', 'active', 10),  -- Hazlewood (Bowl)
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000002', 'active', 11),  -- Starc (Bowl)
  -- Manager 7 — Bench 3
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000146', '10000000-0000-0000-0000-000000000002', 'bench', 1),    -- Patidar (Bat)
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000158', '10000000-0000-0000-0000-000000000002', 'bench', 2),    -- V.Iyer (AR)
  ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000106', '10000000-0000-0000-0000-000000000002', 'bench', 3),    -- Pooran (WK)

  -- Manager 8 (Knight Warriors) — Active 11
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000204', '10000000-0000-0000-0000-000000000002', 'active', 1),   -- Dhawan (Bat)
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000196', '10000000-0000-0000-0000-000000000002', 'active', 2),   -- Padikkal (Bat)
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000054', '10000000-0000-0000-0000-000000000002', 'active', 3),   -- Salt (Bat)
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000231', '10000000-0000-0000-0000-000000000002', 'active', 4),   -- W.Sundar (AR)
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000127', '10000000-0000-0000-0000-000000000002', 'active', 5),   -- Dube (AR)
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000025', '10000000-0000-0000-0000-000000000002', 'active', 6),   -- Stoinis (AR)
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000191', '10000000-0000-0000-0000-000000000002', 'active', 7),   -- KL Rahul (WK)
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000209', '10000000-0000-0000-0000-000000000002', 'active', 8),   -- R.Chahar (Bowl)
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000230', '10000000-0000-0000-0000-000000000002', 'active', 9),   -- Umran (Bowl)
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000171', '10000000-0000-0000-0000-000000000002', 'active', 10),  -- Khaleel (Bowl)
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000092', '10000000-0000-0000-0000-000000000002', 'active', 11),  -- Rabada (Bowl)
  -- Manager 8 — Bench 3
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000166', '10000000-0000-0000-0000-000000000002', 'bench', 1),    -- Fraser-McGurk (Bat)
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000197', '10000000-0000-0000-0000-000000000002', 'bench', 2),    -- Badoni (Bat)
  ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000170', '10000000-0000-0000-0000-000000000002', 'bench', 3);    -- Ishant (Bowl)

-- =============================================
-- 12. Mark drafted IPL players as unavailable
-- =============================================
UPDATE league_player_pool
SET is_available = false
WHERE league_id = '10000000-0000-0000-0000-000000000002'
  AND player_id IN (
    -- Manager 5
    '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000121', '30000000-0000-0000-0000-000000000005',
    '30000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000154',
    '30000000-0000-0000-0000-000000000157', '30000000-0000-0000-0000-000000000180',
    '30000000-0000-0000-0000-000000000016', '30000000-0000-0000-0000-000000000156',
    '30000000-0000-0000-0000-000000000228', '30000000-0000-0000-0000-000000000193',
    '30000000-0000-0000-0000-000000000017', '30000000-0000-0000-0000-000000000128',
    -- Manager 6
    '30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000010',
    '30000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000132',
    '30000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000013',
    '30000000-0000-0000-0000-000000000229', '30000000-0000-0000-0000-000000000218',
    '30000000-0000-0000-0000-000000000097', '30000000-0000-0000-0000-000000000076',
    '30000000-0000-0000-0000-000000000142', '30000000-0000-0000-0000-000000000133',
    '30000000-0000-0000-0000-000000000194', '30000000-0000-0000-0000-000000000046',
    -- Manager 7
    '30000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000155',
    '30000000-0000-0000-0000-000000000178', '30000000-0000-0000-0000-000000000012',
    '30000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000009',
    '30000000-0000-0000-0000-000000000015', '30000000-0000-0000-0000-000000000195',
    '30000000-0000-0000-0000-000000000022', '30000000-0000-0000-0000-000000000107',
    '30000000-0000-0000-0000-000000000018', '30000000-0000-0000-0000-000000000146',
    '30000000-0000-0000-0000-000000000158', '30000000-0000-0000-0000-000000000106',
    -- Manager 8
    '30000000-0000-0000-0000-000000000204', '30000000-0000-0000-0000-000000000196',
    '30000000-0000-0000-0000-000000000191', '30000000-0000-0000-0000-000000000231',
    '30000000-0000-0000-0000-000000000127', '30000000-0000-0000-0000-000000000209',
    '30000000-0000-0000-0000-000000000230', '30000000-0000-0000-0000-000000000171',
    '30000000-0000-0000-0000-000000000025', '30000000-0000-0000-0000-000000000054',
    '30000000-0000-0000-0000-000000000092', '30000000-0000-0000-0000-000000000166',
    '30000000-0000-0000-0000-000000000197', '30000000-0000-0000-0000-000000000170'
  );

-- =============================================
-- 13. IPL league schedules (round-robin: 4 managers = 6 matchups over 3 weeks)
-- =============================================
-- Week 1 is finalized with scores; weeks 2-3 are pending (future)
-- Weeks correspond to actual IPL match weeks

INSERT INTO league_schedules (league_id, week, manager1_id, manager2_id, manager1_score, manager2_score, winner_id, is_finalized) VALUES
  -- Week 1 (completed)
  ('10000000-0000-0000-0000-000000000002', 1, '20000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000006', 485.5, 412.0, '20000000-0000-0000-0000-000000000005', true),
  ('10000000-0000-0000-0000-000000000002', 1, '20000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000008', 398.0, 356.5, '20000000-0000-0000-0000-000000000007', true),
  -- Week 2 (pending)
  ('10000000-0000-0000-0000-000000000002', 2, '20000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000007', NULL, NULL, NULL, false),
  ('10000000-0000-0000-0000-000000000002', 2, '20000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000008', NULL, NULL, NULL, false),
  -- Week 3 (pending)
  ('10000000-0000-0000-0000-000000000002', 3, '20000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000008', NULL, NULL, NULL, false),
  ('10000000-0000-0000-0000-000000000002', 3, '20000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000007', NULL, NULL, NULL, false);

-- =============================================
-- 14. Update week 1 IPL matches to Complete
-- =============================================
-- Matches 200001-200005 are week 1; mark them as completed with realistic scores

UPDATE cricket_matches SET
  state = 'Complete', match_state = 'Complete',
  team1_score = '185/4', team2_score = '179/8',
  winner_team_id = 201, result = 'Chennai Super Kings won by 6 runs'
WHERE cricbuzz_match_id = 200001;

UPDATE cricket_matches SET
  state = 'Complete', match_state = 'Complete',
  team1_score = '201/6', team2_score = '195/7',
  winner_team_id = 203, result = 'Royal Challengers Bengaluru won by 6 runs'
WHERE cricbuzz_match_id = 200002;

UPDATE cricket_matches SET
  state = 'Complete', match_state = 'Complete',
  team1_score = '168/9', team2_score = '172/4',
  winner_team_id = 206, result = 'Gujarat Titans won by 6 wickets'
WHERE cricbuzz_match_id = 200003;

UPDATE cricket_matches SET
  state = 'Complete', match_state = 'Complete',
  team1_score = '155/8', team2_score = '158/3',
  winner_team_id = 208, result = 'Punjab Kings won by 7 wickets'
WHERE cricbuzz_match_id = 200004;

UPDATE cricket_matches SET
  state = 'Complete', match_state = 'Complete',
  team1_score = '192/5', team2_score = '188/7',
  winner_team_id = 209, result = 'Rajasthan Royals won by 4 runs'
WHERE cricbuzz_match_id = 200005;

-- Mark league_matches stats as imported for week 1
UPDATE league_matches
SET stats_imported = true, stats_imported_at = '2026-03-18T00:00:00.000Z'
WHERE league_id = '10000000-0000-0000-0000-000000000002'
  AND match_id IN (
    SELECT id FROM cricket_matches WHERE cricbuzz_match_id IN (200001, 200002, 200003, 200004, 200005)
  );

-- =============================================
-- 15. Match player stats for completed week 1 matches
-- =============================================
-- Only fantasy-relevant players (those drafted by managers) included.
-- Uses deterministic IDs: 40000000-0000-0000-0000-00000XXYYZZ
-- XX = match (01-05), YY = team (01=team1, 02=team2), ZZ = player seq

-- ----- Match 200001: CSK 185/4 beat MI 179/8 -----
-- CSK players (team1)
INSERT INTO match_player_stats (id, match_id, player_id, cricbuzz_player_id, runs, balls_faced, fours, sixes, strike_rate, is_out, batting_position, overs, maidens, runs_conceded, wickets, economy, dots, wides, no_balls, lbw_bowled_count, catches, stumpings, run_outs, is_in_playing_11, team_won, finalized_at) VALUES
  ('40000000-0000-0000-0000-000000010101', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000121', '12092', 72, 48, 8, 3, 150.00, false, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, true, true, '2026-03-14T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000010102', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000005', '2740', 38, 25, 2, 2, 152.00, false, 5, 4.0, 0, 32, 2, 8.00, 8, 1, 0, 1, 0, 0, 0, true, true, '2026-03-14T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000010103', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000127', '11809', 28, 18, 3, 1, 155.56, true, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, true, '2026-03-14T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000010104', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000128', '2270', 5, 8, 0, 0, 62.50, true, 7, 4.0, 1, 22, 1, 5.50, 12, 0, 0, 0, 0, 0, 0, true, true, '2026-03-14T18:00:00.000Z');

-- MI players (team2)
INSERT INTO match_player_stats (id, match_id, player_id, cricbuzz_player_id, runs, balls_faced, fours, sixes, strike_rate, is_out, batting_position, overs, maidens, runs_conceded, wickets, economy, dots, wides, no_balls, lbw_bowled_count, catches, stumpings, run_outs, is_in_playing_11, team_won, finalized_at) VALUES
  ('40000000-0000-0000-0000-000000010201', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000004', 'sky_mi', 45, 30, 4, 2, 150.00, true, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, false, '2026-03-14T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000010202', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000007', '7400', 35, 22, 2, 3, 159.09, true, 5, 3.0, 0, 28, 1, 9.33, 5, 0, 0, 0, 1, 0, 0, true, false, '2026-03-14T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000010203', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000003', '6906', 2, 4, 0, 0, 50.00, false, 10, 4.0, 0, 30, 3, 7.50, 10, 0, 0, 2, 0, 0, 0, true, false, '2026-03-14T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000010204', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000132', '9560', 22, 18, 2, 1, 122.22, true, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, true, false, '2026-03-14T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000010205', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000133', '14256', 18, 14, 1, 1, 128.57, true, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, false, '2026-03-14T18:00:00.000Z');

-- ----- Match 200002: RCB 201/6 beat KKR 195/7 -----
-- RCB players
INSERT INTO match_player_stats (id, match_id, player_id, cricbuzz_player_id, runs, balls_faced, fours, sixes, strike_rate, is_out, batting_position, overs, maidens, runs_conceded, wickets, economy, dots, wides, no_balls, lbw_bowled_count, catches, stumpings, run_outs, is_in_playing_11, team_won, finalized_at) VALUES
  ('40000000-0000-0000-0000-000000020101', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000001', '1413', 82, 50, 9, 4, 164.00, false, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, true, true, '2026-03-15T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000020102', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000142', '2498', 48, 32, 5, 2, 150.00, true, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, true, '2026-03-15T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000020103', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000054', '12205', 32, 20, 4, 1, 160.00, true, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, true, '2026-03-15T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000020104', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000022', '4316', 0, 0, 0, 0, 0, false, 0, 4.0, 0, 35, 2, 8.75, 9, 1, 0, 1, 1, 0, 0, true, true, '2026-03-15T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000020105', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000009', 'siraj_rcb', 0, 0, 0, 0, 0, false, 0, 4.0, 0, 42, 1, 10.50, 7, 2, 0, 0, 0, 0, 0, true, true, '2026-03-15T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000020106', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000146', '13098', 15, 12, 2, 0, 125.00, true, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, true, '2026-03-15T18:00:00.000Z');

-- KKR players
INSERT INTO match_player_stats (id, match_id, player_id, cricbuzz_player_id, runs, balls_faced, fours, sixes, strike_rate, is_out, batting_position, overs, maidens, runs_conceded, wickets, economy, dots, wides, no_balls, lbw_bowled_count, catches, stumpings, run_outs, is_in_playing_11, team_won, finalized_at) VALUES
  ('40000000-0000-0000-0000-000000020201', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000154', '6439', 55, 38, 5, 2, 144.74, true, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, false, '2026-03-15T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000020202', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000155', '11811', 42, 28, 3, 3, 150.00, true, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, true, false, '2026-03-15T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000020203', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000156', '2883', 28, 20, 1, 2, 140.00, true, 4, 4.0, 0, 38, 2, 9.50, 8, 0, 0, 0, 0, 0, 0, true, false, '2026-03-15T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000020204', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000157', '12694', 5, 6, 0, 0, 83.33, true, 8, 4.0, 0, 30, 3, 7.50, 11, 0, 0, 2, 0, 0, 0, true, false, '2026-03-15T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000020205', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000018', '4538', 0, 0, 0, 0, 0, false, 0, 4.0, 0, 45, 1, 11.25, 6, 1, 0, 1, 0, 0, 0, true, false, '2026-03-15T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000020206', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000107', '2251', 30, 15, 2, 3, 200.00, true, 6, 2.0, 0, 22, 0, 11.00, 3, 0, 0, 0, 1, 0, 0, true, false, '2026-03-15T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000020207', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000158', '13419', 12, 10, 1, 0, 120.00, true, 7, 2.0, 0, 20, 0, 10.00, 4, 1, 0, 0, 0, 0, 0, true, false, '2026-03-15T18:00:00.000Z');

-- ----- Match 200003: DC 168/9 lost to GT 172/4 -----
-- DC players
INSERT INTO match_player_stats (id, match_id, player_id, cricbuzz_player_id, runs, balls_faced, fours, sixes, strike_rate, is_out, batting_position, overs, maidens, runs_conceded, wickets, economy, dots, wides, no_balls, lbw_bowled_count, catches, stumpings, run_outs, is_in_playing_11, team_won, finalized_at) VALUES
  ('40000000-0000-0000-0000-000000030101', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000006', '8394', 41, 28, 4, 2, 146.43, true, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, true, false, '2026-03-16T14:00:00.000Z'),
  ('40000000-0000-0000-0000-000000030102', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000012', '6388', 22, 18, 2, 0, 122.22, true, 5, 4.0, 0, 28, 1, 7.00, 10, 0, 0, 0, 1, 0, 0, true, false, '2026-03-16T14:00:00.000Z'),
  ('40000000-0000-0000-0000-000000030103', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000008', '8292', 8, 10, 1, 0, 80.00, true, 7, 4.0, 0, 34, 2, 8.50, 9, 0, 0, 1, 0, 0, 0, true, false, '2026-03-16T14:00:00.000Z'),
  ('40000000-0000-0000-0000-000000030104', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000171', '11552', 0, 0, 0, 0, 0, false, 0, 4.0, 0, 38, 1, 9.50, 8, 1, 0, 0, 0, 0, 0, true, false, '2026-03-16T14:00:00.000Z'),
  ('40000000-0000-0000-0000-000000030105', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000166', '14249', 35, 22, 4, 2, 159.09, true, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, false, '2026-03-16T14:00:00.000Z');

-- GT players
INSERT INTO match_player_stats (id, match_id, player_id, cricbuzz_player_id, runs, balls_faced, fours, sixes, strike_rate, is_out, batting_position, overs, maidens, runs_conceded, wickets, economy, dots, wides, no_balls, lbw_bowled_count, catches, stumpings, run_outs, is_in_playing_11, team_won, finalized_at) VALUES
  ('40000000-0000-0000-0000-000000030201', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000010', '11808', 65, 42, 6, 3, 154.76, false, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, true, '2026-03-16T14:00:00.000Z'),
  ('40000000-0000-0000-0000-000000030202', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000178', '14259', 48, 35, 5, 1, 137.14, false, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, true, true, '2026-03-16T14:00:00.000Z'),
  ('40000000-0000-0000-0000-000000030203', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000076', '10738', 12, 8, 1, 0, 150.00, false, 6, 4.0, 0, 25, 3, 6.25, 12, 0, 0, 2, 1, 0, 0, true, true, '2026-03-16T14:00:00.000Z'),
  ('40000000-0000-0000-0000-000000030204', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000180', '6738', 0, 0, 0, 0, 0, false, 0, 4.0, 0, 30, 2, 7.50, 10, 0, 0, 1, 0, 0, 0, true, true, '2026-03-16T14:00:00.000Z');

-- ----- Match 200004: LSG 155/8 lost to PBKS 158/3 -----
-- LSG players
INSERT INTO match_player_stats (id, match_id, player_id, cricbuzz_player_id, runs, balls_faced, fours, sixes, strike_rate, is_out, batting_position, overs, maidens, runs_conceded, wickets, economy, dots, wides, no_balls, lbw_bowled_count, catches, stumpings, run_outs, is_in_playing_11, team_won, finalized_at) VALUES
  ('40000000-0000-0000-0000-000000040101', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000191', '7737', 38, 30, 3, 1, 126.67, true, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, true, false, '2026-03-16T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000040102', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000025', '7448', 28, 20, 2, 1, 140.00, true, 4, 2.0, 0, 18, 1, 9.00, 4, 0, 0, 0, 0, 0, 0, true, false, '2026-03-16T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000040103', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000196', '12698', 18, 15, 2, 0, 120.00, true, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, false, '2026-03-16T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000040104', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000195', '10811', 0, 0, 0, 0, 0, false, 0, 4.0, 0, 35, 1, 8.75, 9, 0, 0, 0, 0, 0, 0, true, false, '2026-03-16T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000040105', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000193', '13472', 0, 0, 0, 0, 0, false, 0, 4.0, 0, 28, 2, 7.00, 11, 0, 0, 1, 0, 0, 0, true, false, '2026-03-16T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000040106', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000194', '7399', 15, 12, 1, 0, 125.00, true, 5, 3.0, 0, 25, 0, 8.33, 7, 0, 0, 0, 0, 0, 0, true, false, '2026-03-16T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000040107', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000197', '14254', 20, 16, 2, 0, 125.00, true, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, false, '2026-03-16T18:00:00.000Z');

-- PBKS players
INSERT INTO match_player_stats (id, match_id, player_id, cricbuzz_player_id, runs, balls_faced, fours, sixes, strike_rate, is_out, batting_position, overs, maidens, runs_conceded, wickets, economy, dots, wides, no_balls, lbw_bowled_count, catches, stumpings, run_outs, is_in_playing_11, team_won, finalized_at) VALUES
  ('40000000-0000-0000-0000-000000040201', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000204', '2264', 55, 40, 6, 2, 137.50, false, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, true, '2026-03-16T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000040202', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000013', '13476', 0, 0, 0, 0, 0, false, 0, 4.0, 0, 28, 3, 7.00, 12, 0, 0, 2, 0, 0, 0, true, true, '2026-03-16T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000040203', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000209', '11806', 0, 0, 0, 0, 0, false, 0, 4.0, 0, 32, 2, 8.00, 9, 1, 0, 0, 1, 0, 0, true, true, '2026-03-16T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000040204', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000011', '13498', 42, 28, 5, 1, 150.00, false, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, true, true, '2026-03-16T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000040205', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000092', 'rabada_pbks', 0, 0, 0, 0, 0, false, 0, 3.0, 0, 22, 2, 7.33, 8, 0, 0, 1, 0, 0, 0, true, true, '2026-03-16T18:00:00.000Z');

-- ----- Match 200005: RR 192/5 beat SRH 188/7 -----
-- RR players
INSERT INTO match_player_stats (id, match_id, player_id, cricbuzz_player_id, runs, balls_faced, fours, sixes, strike_rate, is_out, batting_position, overs, maidens, runs_conceded, wickets, economy, dots, wides, no_balls, lbw_bowled_count, catches, stumpings, run_outs, is_in_playing_11, team_won, finalized_at) VALUES
  ('40000000-0000-0000-0000-000000050101', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000046', '4645', 68, 42, 7, 3, 161.90, false, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, true, true, '2026-03-17T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000050102', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000014', '5765', 45, 30, 3, 3, 150.00, true, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, true, true, '2026-03-17T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000050103', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000218', '13471', 32, 22, 2, 2, 145.45, true, 4, 2.0, 0, 20, 1, 10.00, 3, 0, 0, 0, 0, 0, 0, true, true, '2026-03-17T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000050104', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000015', '3667', 0, 0, 0, 0, 0, false, 0, 4.0, 0, 32, 2, 8.00, 10, 0, 0, 1, 0, 0, 0, true, true, '2026-03-17T18:00:00.000Z');

-- SRH players
INSERT INTO match_player_stats (id, match_id, player_id, cricbuzz_player_id, runs, balls_faced, fours, sixes, strike_rate, is_out, batting_position, overs, maidens, runs_conceded, wickets, economy, dots, wides, no_balls, lbw_bowled_count, catches, stumpings, run_outs, is_in_playing_11, team_won, finalized_at) VALUES
  ('40000000-0000-0000-0000-000000050201', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000017', '8867', 75, 45, 8, 4, 166.67, true, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, false, '2026-03-17T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000050202', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000097', '10961', 42, 25, 3, 3, 168.00, true, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, true, false, '2026-03-17T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000050203', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000228', '13466', 30, 22, 2, 1, 136.36, true, 1, 2.0, 0, 18, 0, 9.00, 4, 0, 0, 0, 0, 0, 0, true, false, '2026-03-17T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000050204', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000016', '8658', 5, 6, 0, 0, 83.33, false, 9, 4.0, 0, 38, 2, 9.50, 9, 0, 0, 1, 0, 0, 0, true, false, '2026-03-17T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000050205', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000229', '2839', 0, 0, 0, 0, 0, false, 0, 4.0, 0, 42, 1, 10.50, 7, 2, 0, 0, 0, 0, 0, true, false, '2026-03-17T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000050206', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000231', '10809', 15, 12, 1, 0, 125.00, true, 5, 4.0, 0, 35, 1, 8.75, 8, 0, 0, 0, 1, 0, 0, true, false, '2026-03-17T18:00:00.000Z'),
  ('40000000-0000-0000-0000-000000050207', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000230', '14252', 0, 0, 0, 0, 0, false, 0, 3.0, 0, 30, 1, 10.00, 5, 1, 0, 0, 0, 0, 0, true, false, '2026-03-17T18:00:00.000Z');

-- =============================================
-- 16. League player match scores (fantasy points for drafted players who played)
-- =============================================
-- Points are realistic estimates based on scoring rules:
-- Bat: runs×1 + fours×1 + sixes×2 + milestones + SR bonus
-- Bowl: wickets×30 + dots×1 + lbw/bowled×5 + economy bonus + maiden×40
-- Field: catch×10 + stumping×20 + runout×10
-- Common: starting11=5, winning team=5

INSERT INTO league_player_match_scores (league_id, match_id, player_id, match_player_stats_id, manager_id, total_points, batting_points, bowling_points, fielding_points, common_points, was_in_active_roster, week, finalized_at) VALUES
  -- Match 200001: CSK vs MI
  -- Gaikwad (Mgr5 active): 72r+8f+3×2s+25m(10)+40m(15)+60m(20)+SR150(30) = 72+8+6+10+15+20+30=161 bat, 10 field(catch), 10 common(5+5win) = 181
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000121', '40000000-0000-0000-0000-000000010101', '20000000-0000-0000-0000-000000000005', 181.0, 161.0, 0, 10.0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Jadeja (Mgr5 active): 38r+2f+2×2s+25m(10) = 38+2+4+10=54 bat, 2w×30+8d+1lbw×5=73 bowl, 10 common = 137
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000010102', '20000000-0000-0000-0000-000000000005', 137.0, 54.0, 73.0, 0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Dube (Mgr8 active): 28r+3f+1×2s+25m(10) = 28+3+2+10=43 bat, 10 common(5+5win) = 53
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000127', '40000000-0000-0000-0000-000000010103', '20000000-0000-0000-0000-000000000008', 53.0, 43.0, 0, 0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Ashwin (Mgr5 bench): 5r+0f = 5 bat, 1w×30+12d+1m×40=82 bowl, 10 common(5+5win) = 97
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000128', '40000000-0000-0000-0000-000000010104', '20000000-0000-0000-0000-000000000005', 97.0, 5.0, 82.0, 0, 10.0, false, 1, '2026-03-18T00:00:00.000Z'),
  -- SKY (Mgr6 active): 45r+4f+2×2s+25m(10)+40m(15)+SR150(30) = 45+4+4+10+15+30=108 bat, 5 common(5+0loss) = 113
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000010201', '20000000-0000-0000-0000-000000000006', 113.0, 108.0, 0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Hardik (Mgr6 active): 35r+2f+3×2s+25m(10)+SR159(30) = 35+2+6+10+30=83 bat, 1w×30+5d=35 bowl, 10 field(catch), 5 common = 133
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000010202', '20000000-0000-0000-0000-000000000006', 133.0, 83.0, 35.0, 10.0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Bumrah (Mgr5 active): 2r = 2 bat, 3w×30+10d+2lbw×5+2w_milestone(10)+3w_milestone(20)=130 bowl, 5 common = 137
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000010203', '20000000-0000-0000-0000-000000000005', 137.0, 2.0, 130.0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Kishan (Mgr6 active): 22r+2f+1×2s = 22+2+2=26 bat, 10 field(catch), 5 common = 41
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000132', '40000000-0000-0000-0000-000000010204', '20000000-0000-0000-0000-000000000006', 41.0, 26.0, 0, 10.0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Tilak (Mgr6 bench): 18r+1f+1×2s = 18+1+2=21 bat, 5 common = 26
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200001), '30000000-0000-0000-0000-000000000133', '40000000-0000-0000-0000-000000010205', '20000000-0000-0000-0000-000000000006', 26.0, 21.0, 0, 0, 5.0, false, 1, '2026-03-18T00:00:00.000Z'),

  -- Match 200002: RCB vs KKR
  -- Kohli (Mgr5 active): 82r+9f+4×2s+25m(10)+40m(15)+60m(20)+80m(25)+SR164(30) = 82+9+8+10+15+20+25+30=199 bat, 10 field, 10 common = 219
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000020101', '20000000-0000-0000-0000-000000000005', 219.0, 199.0, 0, 10.0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Faf (Mgr6 active): 48r+5f+2×2s+25m(10)+40m(15)+SR150(30) = 48+5+4+10+15+30=112 bat, 10 common = 122
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000142', '40000000-0000-0000-0000-000000020102', '20000000-0000-0000-0000-000000000006', 122.0, 112.0, 0, 0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Salt (Mgr8 active): 32r+4f+1×2s+25m(10)+SR160(30) = 32+4+2+10+30=78 bat, 10 common = 88
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000054', '40000000-0000-0000-0000-000000020103', '20000000-0000-0000-0000-000000000008', 88.0, 78.0, 0, 0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Hazlewood (Mgr7 active): 2w×30+9d+1lbw×5+2w_milestone(10)=84 bowl, 10 field(catch), 10 common = 104
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000022', '40000000-0000-0000-0000-000000020104', '20000000-0000-0000-0000-000000000007', 104.0, 0, 84.0, 10.0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Siraj (Mgr7 active): 1w×30+7d-15(econ10.5)=22 bowl, 10 common = 32
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000020105', '20000000-0000-0000-0000-000000000007', 32.0, 0, 22.0, 0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Patidar (Mgr7 bench): 15r+2f = 15+2=17 bat, 10 common = 27
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000146', '40000000-0000-0000-0000-000000020106', '20000000-0000-0000-0000-000000000007', 27.0, 17.0, 0, 0, 10.0, false, 1, '2026-03-18T00:00:00.000Z'),
  -- S.Iyer (Mgr5 active): 55r+5f+2×2s+25m(10)+40m(15)+SR145(30) = 55+5+4+10+15+30=119 bat, 5 common = 124
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000154', '40000000-0000-0000-0000-000000020201', '20000000-0000-0000-0000-000000000005', 124.0, 119.0, 0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Rinku (Mgr7 active): 42r+3f+3×2s+25m(10)+40m(15)+SR150(30) = 42+3+6+10+15+30=106 bat, 10 field, 5 common = 121
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000155', '40000000-0000-0000-0000-000000020202', '20000000-0000-0000-0000-000000000007', 121.0, 106.0, 0, 10.0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Narine (Mgr5 active): 28r+1f+2×2s = 28+1+4=33 bat, 2w×30+8d+2w_milestone(10)=78 bowl, 5 common = 116
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000156', '40000000-0000-0000-0000-000000020203', '20000000-0000-0000-0000-000000000005', 116.0, 33.0, 78.0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Chakravarthy (Mgr5 active): 3w×30+11d+2lbw×5+2w(10)+3w(20)=131 bowl, 5 common = 136
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000157', '40000000-0000-0000-0000-000000020204', '20000000-0000-0000-0000-000000000005', 141.0, 5.0, 131.0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Starc (Mgr7 active): 1w×30+6d-15(econ11.25)+1lbw×5=26 bowl, 5 common = 31
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000018', '40000000-0000-0000-0000-000000020205', '20000000-0000-0000-0000-000000000007', 31.0, 0, 26.0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Russell (Mgr7 active): 30r+2f+3×2s+25m(10)+SR200(30) = 30+2+6+10+30=78 bat, -15(econ11) bowl, 10 field(catch), 5 common = 78
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000107', '40000000-0000-0000-0000-000000020206', '20000000-0000-0000-0000-000000000007', 78.0, 78.0, -15.0, 10.0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- V.Iyer (Mgr7 bench): 12r+1f = 12+1=13 bat, -15(econ10) bowl, 5 common = 3 (min 0 let's say 3)
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200002), '30000000-0000-0000-0000-000000000158', '40000000-0000-0000-0000-000000020207', '20000000-0000-0000-0000-000000000007', 8.0, 13.0, -15.0, 0, 5.0, false, 1, '2026-03-18T00:00:00.000Z'),

  -- Match 200003: DC vs GT
  -- Pant (Mgr5 active): 41r+4f+2×2s+25m(10)+40m(15)+SR146(30) = 41+4+4+10+15+30=104 bat, 20 field(2catches), 5 common = 129
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000030101', '20000000-0000-0000-0000-000000000005', 129.0, 104.0, 0, 20.0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Axar (Mgr7 active): 22r+2f = 22+2=24 bat, 1w×30+10d=40 bowl, 10 field(catch), 5 common = 79
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000030102', '20000000-0000-0000-0000-000000000007', 79.0, 24.0, 40.0, 10.0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Kuldeep (Mgr6 active): 8r+1f = 9 bat, 2w×30+9d+1lbw×5+2w(10)=84 bowl, 5 common = 98
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000030103', '20000000-0000-0000-0000-000000000006', 98.0, 9.0, 84.0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Khaleel (Mgr8 active): 1w×30+8d-1(wide)=37 bowl, 5 common = 42
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000171', '40000000-0000-0000-0000-000000030104', '20000000-0000-0000-0000-000000000008', 42.0, 0, 37.0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Fraser-McGurk (Mgr8 bench): 35r+4f+2×2s+25m(10)+SR159(30) = 35+4+4+10+30=83 bat, 5 common = 88
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000166', '40000000-0000-0000-0000-000000030105', '20000000-0000-0000-0000-000000000008', 88.0, 83.0, 0, 0, 5.0, false, 1, '2026-03-18T00:00:00.000Z'),
  -- Gill (Mgr6 active): 65r+6f+3×2s+25m(10)+40m(15)+60m(20)+SR155(30) = 65+6+6+10+15+20+30=152 bat, 10 common = 162
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000030201', '20000000-0000-0000-0000-000000000006', 162.0, 152.0, 0, 0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Sudharsan (Mgr7 active): 48r+5f+1×2s+25m(10)+40m(15) = 48+5+2+10+15=80 bat, 10 field, 10 common = 100
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000178', '40000000-0000-0000-0000-000000030202', '20000000-0000-0000-0000-000000000007', 100.0, 80.0, 0, 10.0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Rashid Khan (Mgr6 active): 12r+1f = 13 bat, 3w×30+12d+2lbw×5+2w(10)+3w(20)+econ6.25(40)=172 bowl, 10 field(catch), 10 common = 205
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000076', '40000000-0000-0000-0000-000000030203', '20000000-0000-0000-0000-000000000006', 205.0, 13.0, 172.0, 10.0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Shami (Mgr5 active): 2w×30+10d+1lbw×5+2w(10)=85 bowl, 10 common = 95
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200003), '30000000-0000-0000-0000-000000000180', '40000000-0000-0000-0000-000000030204', '20000000-0000-0000-0000-000000000005', 95.0, 0, 85.0, 0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),

  -- Match 200004: LSG vs PBKS
  -- KL Rahul (Mgr8 active): 38r+3f+1×2s+25m(10) = 38+3+2+10=53 bat, 10 field(catch), 5 common = 68
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000191', '40000000-0000-0000-0000-000000040101', '20000000-0000-0000-0000-000000000008', 68.0, 53.0, 0, 10.0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Stoinis (Mgr8 active): 28r+2f+1×2s+25m(10) = 28+2+2+10=42 bat, 1w×30+4d=34 bowl, 5 common = 81
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000025', '40000000-0000-0000-0000-000000040102', '20000000-0000-0000-0000-000000000008', 81.0, 42.0, 34.0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Padikkal (Mgr8 active): 18r+2f = 18+2=20 bat, 5 common = 25
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000196', '40000000-0000-0000-0000-000000040103', '20000000-0000-0000-0000-000000000008', 25.0, 20.0, 0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Avesh (Mgr7 active): 1w×30+9d=39 bowl, 5 common = 44
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000195', '40000000-0000-0000-0000-000000040104', '20000000-0000-0000-0000-000000000007', 44.0, 0, 39.0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Bishnoi (Mgr5 bench): 2w×30+11d+1lbw×5+2w(10)=86 bowl, 5 common = 91
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000193', '40000000-0000-0000-0000-000000040105', '20000000-0000-0000-0000-000000000005', 91.0, 0, 86.0, 0, 5.0, false, 1, '2026-03-18T00:00:00.000Z'),
  -- Krunal (Mgr6 bench): 15r+1f = 15+1=16 bat, 7d=7 bowl, 5 common = 28
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000194', '40000000-0000-0000-0000-000000040106', '20000000-0000-0000-0000-000000000006', 28.0, 16.0, 7.0, 0, 5.0, false, 1, '2026-03-18T00:00:00.000Z'),
  -- Badoni (Mgr8 bench): 20r+2f = 20+2=22 bat, 5 common = 27
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000197', '40000000-0000-0000-0000-000000040107', '20000000-0000-0000-0000-000000000008', 27.0, 22.0, 0, 0, 5.0, false, 1, '2026-03-18T00:00:00.000Z'),
  -- Dhawan (Mgr8 active): 55r+6f+2×2s+25m(10)+40m(15) = 55+6+4+10+15=90 bat, 10 common(5+5win) = 100
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000204', '40000000-0000-0000-0000-000000040201', '20000000-0000-0000-0000-000000000008', 100.0, 90.0, 0, 0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Arshdeep (Mgr6 active): 3w×30+12d+2lbw×5+2w(10)+3w(20)=142 bowl, 10 common = 152
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000013', '40000000-0000-0000-0000-000000040202', '20000000-0000-0000-0000-000000000006', 152.0, 0, 142.0, 0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- R.Chahar (Mgr8 active): 2w×30+9d-1(wide)+2w(10)=78 bowl, 10 field(catch), 10 common = 98
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000209', '40000000-0000-0000-0000-000000040203', '20000000-0000-0000-0000-000000000008', 98.0, 0, 78.0, 10.0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Jaiswal (Mgr7 active): 42r+5f+1×2s+25m(10)+40m(15)+SR150(30) = 42+5+2+10+15+30=104 bat, 10 field(catch), 10 common = 124
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000040204', '20000000-0000-0000-0000-000000000007', 124.0, 104.0, 0, 10.0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Rabada (Mgr8 active): 2w×30+8d+1lbw×5+2w(10)=83 bowl, 10 common = 93
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200004), '30000000-0000-0000-0000-000000000092', '40000000-0000-0000-0000-000000040205', '20000000-0000-0000-0000-000000000008', 93.0, 0, 83.0, 0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),

  -- Match 200005: RR vs SRH
  -- Buttler (Mgr6 bench): 68r+7f+3×2s+25m(10)+40m(15)+60m(20)+SR162(30) = 68+7+6+10+15+20+30=156 bat, 20 field(2catch), 10 common = 186
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000046', '40000000-0000-0000-0000-000000050101', '20000000-0000-0000-0000-000000000006', 186.0, 156.0, 0, 20.0, 10.0, false, 1, '2026-03-18T00:00:00.000Z'),
  -- Samson (Mgr7 active): 45r+3f+3×2s+25m(10)+40m(15)+SR150(30) = 45+3+6+10+15+30=109 bat, 10 field(stumping), 10 common = 129
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000014', '40000000-0000-0000-0000-000000050102', '20000000-0000-0000-0000-000000000007', 139.0, 109.0, 0, 20.0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Parag (Mgr6 active): 32r+2f+2×2s+25m(10)+SR145(30) = 32+2+4+10+30=78 bat, 1w×30+3d=33 bowl, 10 common = 121
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000218', '40000000-0000-0000-0000-000000050103', '20000000-0000-0000-0000-000000000006', 121.0, 78.0, 33.0, 0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Chahal (Mgr7 active): 2w×30+10d+1lbw×5+2w(10)=85 bowl, 10 common = 95
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000015', '40000000-0000-0000-0000-000000050104', '20000000-0000-0000-0000-000000000007', 95.0, 0, 85.0, 0, 10.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Head (Mgr5 bench): 75r+8f+4×2s+25m(10)+40m(15)+60m(20)+SR167(30) = 75+8+8+10+15+20+30=166 bat, 5 common = 171
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000017', '40000000-0000-0000-0000-000000050201', '20000000-0000-0000-0000-000000000005', 171.0, 166.0, 0, 0, 5.0, false, 1, '2026-03-18T00:00:00.000Z'),
  -- Klaasen (Mgr6 active): 42r+3f+3×2s+25m(10)+40m(15)+SR168(30) = 42+3+6+10+15+30=106 bat, 10 field(catch), 5 common = 121
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000097', '40000000-0000-0000-0000-000000050202', '20000000-0000-0000-0000-000000000006', 121.0, 106.0, 0, 10.0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Abhishek S. (Mgr5 active): 30r+2f+1×2s+25m(10) = 30+2+2+10=44 bat, 4d=4 bowl, 5 common = 53
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000228', '40000000-0000-0000-0000-000000050203', '20000000-0000-0000-0000-000000000005', 53.0, 44.0, 4.0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Cummins (Mgr5 active): 5r = 5 bat, 2w×30+9d+1lbw×5+2w(10)=84 bowl, 5 common = 94
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000016', '40000000-0000-0000-0000-000000050204', '20000000-0000-0000-0000-000000000005', 94.0, 5.0, 84.0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Bhuvi (Mgr6 active): 1w×30+7d-2(wides)-15(econ10.5)=20 bowl, 5 common = 25
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000229', '40000000-0000-0000-0000-000000050205', '20000000-0000-0000-0000-000000000006', 25.0, 0, 20.0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- W.Sundar (Mgr8 active): 15r+1f = 15+1=16 bat, 1w×30+8d=38 bowl, 10 field(catch), 5 common = 69
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000231', '40000000-0000-0000-0000-000000050206', '20000000-0000-0000-0000-000000000008', 69.0, 16.0, 38.0, 10.0, 5.0, true, 1, '2026-03-18T00:00:00.000Z'),
  -- Umran (Mgr8 active): 1w×30+5d-1(wide)=34 bowl, 5 common = 39
  ('10000000-0000-0000-0000-000000000002', (SELECT id FROM cricket_matches WHERE cricbuzz_match_id = 200005), '30000000-0000-0000-0000-000000000230', '40000000-0000-0000-0000-000000050207', '20000000-0000-0000-0000-000000000008', 39.0, 0, 34.0, 0, 5.0, true, 1, '2026-03-18T00:00:00.000Z');

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

-- T20 WC scoring rules
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
);

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
);

-- =============================================
-- 3. Master players
-- =============================================
-- T20 WC: 8 national squads × 15 players = 120 players
-- IPL: 10 franchises × 15 players = 150 players
-- Some players appear in both (shared master_players rows)

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
  ('30000000-0000-0000-0000-000000000045', 'Usman Khan', 'Batsman', NULL, ARRAY['Pakistan'], true);

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
  ('30000000-0000-0000-0000-000000000089', 'Sediqullah Atal', 'Batsman', NULL, ARRAY['Afghanistan'], true),
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
-- Shared: Jadeja (005), Moeen Ali (052), Conway (063), Gurbaz (078)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000121', 'Ruturaj Gaikwad', 'Batsman', '12092', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000122', 'MS Dhoni', 'Wicket Keeper', '1627', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000123', 'Matheesha Pathirana', 'Bowler', '14253', ARRAY['Sri Lanka'], true),
  ('30000000-0000-0000-0000-000000000124', 'Rachin Ravindra CSK', 'All Rounder', NULL, ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000125', 'Shardul Thakur', 'All Rounder', '8099', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000126', 'Deepak Chahar', 'Bowler', '8510', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000127', 'Shivam Dube', 'All Rounder', '11809', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000128', 'Ravichandran Ashwin', 'Bowler', '2270', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000129', 'Ajinkya Rahane', 'Batsman', '2837', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000130', 'Tushar Deshpande', 'Bowler', '12093', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000131', 'Noor Ahmad CSK', 'Bowler', NULL, ARRAY['Afghanistan'], true);

-- MI — Mumbai Indians (15 players)
-- Shared: Rohit (002), Bumrah (003), Hardik (007), Tim David (029), Pooran (106)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000132', 'Ishan Kishan', 'Wicket Keeper', '9560', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000133', 'Tilak Varma', 'Batsman', '14256', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000134', 'Trent Boult MI', 'Bowler', NULL, ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000135', 'Suryakumar Yadav MI', 'Batsman', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000136', 'Dewald Brevis', 'Batsman', '14245', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000137', 'Piyush Chawla', 'Bowler', '2268', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000138', 'Nehal Wadhera', 'Batsman', '14260', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000139', 'Naman Dhir', 'All Rounder', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000140', 'Deepak Chahar MI', 'Bowler', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000141', 'Will Jacks MI', 'All Rounder', NULL, ARRAY['England'], true);

-- RCB — Royal Challengers Bengaluru (15 players)
-- Shared: Kohli (001), Phil Salt (054), Hazlewood (022)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000142', 'Faf du Plessis', 'Batsman', '2498', ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000143', 'Glenn Maxwell RCB', 'All Rounder', NULL, ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000144', 'Dinesh Karthik', 'Wicket Keeper', '1559', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000145', 'Mohammed Siraj RCB', 'Bowler', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000146', 'Rajat Patidar', 'Batsman', '13098', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000147', 'Swapnil Singh', 'All Rounder', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000148', 'Yash Dayal', 'Bowler', '14258', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000149', 'Vyshak Vijaykumar', 'Bowler', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000150', 'Manoj Bhandage', 'All Rounder', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000151', 'Suyash Sharma', 'Bowler', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000152', 'Lockie Ferguson RCB', 'Bowler', NULL, ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000153', 'Liam Livingstone RCB', 'All Rounder', NULL, ARRAY['England'], true);

-- KKR — Kolkata Knight Riders (15 players)
-- Shared: Russell (107), Starc (018), Salt (054 already in RCB — use separate for KKR)
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
  ('30000000-0000-0000-0000-000000000164', 'Phil Salt KKR', 'Batsman', NULL, ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000165', 'Angkrish Raghuvanshi', 'Batsman', NULL, ARRAY['India'], true);

-- DC — Delhi Capitals (15 players)
-- Shared: Pant (006), Axar (012), Kuldeep (008)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000166', 'Jake Fraser-McGurk', 'Batsman', '14249', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000167', 'Tristan Stubbs DC', 'Batsman', NULL, ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000168', 'Abishek Porel', 'Wicket Keeper', '14257', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000169', 'Mitchell Starc DC', 'Bowler', NULL, ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000170', 'Ishant Sharma', 'Bowler', '2261', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000171', 'Khaleel Ahmed', 'Bowler', '11552', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000172', 'Mukesh Kumar', 'Bowler', '13417', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000173', 'Pravin Dubey', 'Bowler', '12084', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000174', 'Kumar Kushagra', 'Wicket Keeper', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000175', 'Ricky Bhui', 'Batsman', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000176', 'Sumit Kumar', 'Batsman', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000177', 'Harry Brook DC', 'Batsman', NULL, ARRAY['England'], true);

-- GT — Gujarat Titans (15 players)
-- Shared: Gill (010), Rashid Khan (076)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000178', 'Sai Sudharsan', 'Batsman', '14259', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000179', 'Wriddhiman Saha', 'Wicket Keeper', '2836', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000180', 'Mohammed Shami', 'Bowler', '6738', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000181', 'Noor Ahmad GT', 'Bowler', NULL, ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000182', 'Sai Kishore', 'Bowler', '12095', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000183', 'Vijay Shankar', 'All Rounder', '9571', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000184', 'Abhinav Manohar', 'Batsman', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000185', 'Darshan Nalkande', 'All Rounder', '13458', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000186', 'Spencer Johnson', 'Bowler', NULL, ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000187', 'Azmatullah Omarzai GT', 'All Rounder', NULL, ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000188', 'Matthew Wade', 'Wicket Keeper', '4537', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000189', 'Kane Williamson GT', 'Batsman', NULL, ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000190', 'Rahul Tewatia', 'All Rounder', '9564', ARRAY['India'], true);

-- LSG — Lucknow Super Giants (15 players)
-- Shared: KL Rahul (not in WC list, new), Stoinis (025), Bishnoi (new)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000191', 'KL Rahul', 'Wicket Keeper', '7737', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000192', 'Quinton de Kock LSG', 'Wicket Keeper', NULL, ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000193', 'Ravi Bishnoi', 'Bowler', '13472', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000194', 'Krunal Pandya', 'All Rounder', '7399', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000195', 'Avesh Khan', 'Bowler', '10811', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000196', 'Devdutt Padikkal', 'Batsman', '12698', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000197', 'Ayush Badoni', 'Batsman', '14254', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000198', 'Deepak Hooda', 'All Rounder', '7395', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000199', 'Naveen-ul-Haq LSG', 'Bowler', NULL, ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000200', 'Matt Henry LSG', 'Bowler', NULL, ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000201', 'Nicholas Pooran LSG', 'Wicket Keeper', NULL, ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000202', 'Marcus Stoinis LSG', 'All Rounder', NULL, ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000203', 'Mohsin Khan', 'Bowler', '13483', ARRAY['India'], true);

-- PBKS — Punjab Kings (15 players)
-- Shared: Arshdeep (013), Bairstow (059)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000204', 'Shikhar Dhawan', 'Batsman', '2264', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000205', 'Sam Curran PBKS', 'All Rounder', NULL, ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000206', 'Liam Livingstone PBKS', 'All Rounder', NULL, ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000207', 'Jitesh Sharma', 'Wicket Keeper', '13475', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000208', 'Kagiso Rabada PBKS', 'Bowler', NULL, ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000209', 'Rahul Chahar', 'Bowler', '11806', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000210', 'Prabhsimran Singh', 'Batsman', '12085', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000211', 'Harpreet Brar', 'All Rounder', '11807', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000212', 'Nathan Ellis PBKS', 'Bowler', NULL, ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000213', 'Atharva Taide', 'Batsman', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000214', 'Vishwanath Pratap Singh', 'Bowler', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000215', 'Rilee Rossouw', 'Batsman', '7282', ARRAY['South Africa'], true);

-- RR — Rajasthan Royals (15 players)
-- Shared: Buttler (046), Chahal (015), Samson (014)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000216', 'Shimron Hetmyer RR', 'Batsman', NULL, ARRAY['West Indies'], true),
  ('30000000-0000-0000-0000-000000000217', 'Trent Boult RR', 'Bowler', NULL, ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000218', 'Riyan Parag', 'All Rounder', '13471', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000219', 'Dhruv Jurel', 'Wicket Keeper', '14255', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000220', 'Ravichandran Ashwin RR', 'Bowler', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000221', 'Sandeep Sharma', 'Bowler', '6390', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000222', 'Navdeep Saini', 'Bowler', '10812', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000223', 'Nandre Burger', 'Bowler', NULL, ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000224', 'Donovan Ferreira', 'All Rounder', NULL, ARRAY['South Africa'], true),
  ('30000000-0000-0000-0000-000000000225', 'Tom Kohler-Cadmore', 'Batsman', NULL, ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000226', 'Kunal Rathore', 'Batsman', NULL, ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000227', 'Avesh Khan RR', 'Bowler', NULL, ARRAY['India'], true);

-- SRH — Sunrisers Hyderabad (15 players)
-- Shared: Head (017), Klaasen (097), Cummins (016)
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000228', 'Abhishek Sharma', 'All Rounder', '13466', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000229', 'Bhuvneshwar Kumar', 'Bowler', '2839', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000230', 'Umran Malik', 'Bowler', '14252', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000231', 'Washington Sundar', 'All Rounder', '10809', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000232', 'Abdul Samad', 'Batsman', '13467', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000233', 'Rahul Tripathi', 'Batsman', '10813', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000234', 'Glenn Phillips SRH', 'Batsman', NULL, ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000235', 'Mayank Agarwal', 'Batsman', '6408', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000236', 'Jaydev Unadkat', 'Bowler', '6438', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000237', 'Marco Jansen SRH', 'All Rounder', NULL, ARRAY['South Africa'], true),
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

INSERT INTO league_player_pool (league_id, player_id, is_available, team_override) VALUES
  -- CSK (15): shared nationals + CSK-specific
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000052', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000063', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000078', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000121', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000122', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000123', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000124', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000125', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000126', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000127', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000128', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000129', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000130', true, 'Chennai Super Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000131', true, 'Chennai Super Kings'),
  -- MI (15)
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000007', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000029', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000106', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000132', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000133', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000134', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000135', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000136', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000137', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000138', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000139', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000140', true, 'Mumbai Indians'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000141', true, 'Mumbai Indians'),
  -- RCB (15)
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000054', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000022', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000142', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000143', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000144', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000145', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000146', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000147', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000148', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000149', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000150', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000151', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000152', true, 'Royal Challengers Bengaluru'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000153', true, 'Royal Challengers Bengaluru'),
  -- KKR (15)
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000107', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000018', true, 'Kolkata Knight Riders'),
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
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000164', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000165', true, 'Kolkata Knight Riders'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', true, 'Kolkata Knight Riders'),
  -- DC (15)
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000006', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000012', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000008', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000166', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000167', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000168', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000169', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000170', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000171', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000172', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000173', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000174', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000175', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000176', true, 'Delhi Capitals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000177', true, 'Delhi Capitals'),
  -- GT (15)
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000010', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000076', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000178', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000179', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000180', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000181', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000182', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000183', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000184', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000185', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000186', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000187', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000188', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000189', true, 'Gujarat Titans'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000190', true, 'Gujarat Titans'),
  -- LSG (15)
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000025', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000191', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000192', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000193', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000194', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000195', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000196', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000197', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000198', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000199', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000200', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000201', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000202', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000203', true, 'Lucknow Super Giants'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000080', true, 'Lucknow Super Giants'),
  -- PBKS (15)
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000013', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000059', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000204', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000205', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000206', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000207', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000208', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000209', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000210', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000211', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000212', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000213', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000214', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000215', true, 'Punjab Kings'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000011', true, 'Punjab Kings'),
  -- RR (15)
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000046', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000015', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000014', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000216', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000217', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000218', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000219', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000220', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000221', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000222', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000223', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000224', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000225', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000226', true, 'Rajasthan Royals'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000227', true, 'Rajasthan Royals'),
  -- SRH (15)
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000017', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000097', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000016', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000228', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000229', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000230', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000231', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000232', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000233', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000234', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000235', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000236', true, 'Sunrisers Hyderabad'),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000237', true, 'Sunrisers Hyderabad'),
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

-- IPL league draft
INSERT INTO draft_state (league_id, is_finalized) VALUES
  ('10000000-0000-0000-0000-000000000002', false);

INSERT INTO draft_order (league_id, position, manager_id) VALUES
  ('10000000-0000-0000-0000-000000000002', 1, '20000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000002', 2, '20000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000002', 3, '20000000-0000-0000-0000-000000000007'),
  ('10000000-0000-0000-0000-000000000002', 4, '20000000-0000-0000-0000-000000000008');

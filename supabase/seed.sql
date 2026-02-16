-- =============================================================
-- Seed data for local development
-- Runs automatically after all migrations during `supabase db reset`
-- =============================================================

-- =============================================
-- 1. Test auth users
-- =============================================
-- GoTrue (Supabase Auth) scans all varchar columns and cannot handle NULLs,
-- so we must explicitly set every nullable string column to '' (empty string).
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token,
  reauthentication_token, aud, role, is_sso_user, is_anonymous
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@test.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Test Admin"}',
    NOW(), NOW(),
    '', '', '', '', '', '', '', '',
    'authenticated', 'authenticated', false, false
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'player1@test.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Player One"}',
    NOW(), NOW(),
    '', '', '', '', '', '', '', '',
    'authenticated', 'authenticated', false, false
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'player2@test.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Player Two"}',
    NOW(), NOW(),
    '', '', '', '', '', '', '', '',
    'authenticated', 'authenticated', false, false
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'player3@test.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Player Three"}',
    NOW(), NOW(),
    '', '', '', '', '', '', '', '',
    'authenticated', 'authenticated', false, false
  );

-- Auth identities (required for email/password login)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   '{"sub":"00000000-0000-0000-0000-000000000001","email":"admin@test.com"}',
   'email', '00000000-0000-0000-0000-000000000001', NOW(), NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
   '{"sub":"00000000-0000-0000-0000-000000000002","email":"player1@test.com"}',
   'email', '00000000-0000-0000-0000-000000000002', NOW(), NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003',
   '{"sub":"00000000-0000-0000-0000-000000000003","email":"player2@test.com"}',
   'email', '00000000-0000-0000-0000-000000000003', NOW(), NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004',
   '{"sub":"00000000-0000-0000-0000-000000000004","email":"player3@test.com"}',
   'email', '00000000-0000-0000-0000-000000000004', NOW(), NOW(), NOW());

-- =============================================
-- 2. User profiles
-- =============================================
INSERT INTO profiles (id, username, full_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Test Admin'),
  ('00000000-0000-0000-0000-000000000002', 'player1', 'Player One'),
  ('00000000-0000-0000-0000-000000000003', 'player2', 'Player Two'),
  ('00000000-0000-0000-0000-000000000004', 'player3', 'Player Three')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, full_name = EXCLUDED.full_name;

-- =============================================
-- 3. Test league
-- =============================================
INSERT INTO leagues (
  id, name, league_manager_id, manager_count,
  active_size, bench_size,
  min_batsmen, max_batsmen, min_bowlers, min_all_rounders, min_wks, max_international,
  tournament_id, tournament_name
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Test Cricket League',
  '00000000-0000-0000-0000-000000000001',
  8, 11, 3,
  3, 6, 3, 1, 1, 4,
  11253, 'T20 World Cup 2026'
);

-- =============================================
-- 4. Managers (teams in the league)
-- =============================================
INSERT INTO managers (id, name, team_name, user_id, league_id, is_league_manager) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Test Admin', 'Thunder XI',
   '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', true),
  ('20000000-0000-0000-0000-000000000002', 'Player One', 'Fire Kings',
   '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', false),
  ('20000000-0000-0000-0000-000000000003', 'Player Two', 'Ice Warriors',
   '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', false),
  ('20000000-0000-0000-0000-000000000004', 'Player Three', 'Storm Riders',
   '00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', false);

-- =============================================
-- 5. Scoring rules (uses the default rules structure)
-- =============================================
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

-- =============================================
-- 6. Master players (cricket players)
-- =============================================
INSERT INTO master_players (id, name, primary_role, cricbuzz_id, teams, is_international) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Virat Kohli', 'Batsman', '1413', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000002', 'Rohit Sharma', 'Batsman', '576', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000003', 'Jasprit Bumrah', 'Bowler', '6906', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000004', 'Suryakumar Yadav', 'Batsman', '3993', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000005', 'Ravindra Jadeja', 'All Rounder', '2740', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000006', 'Pat Cummins', 'Bowler', '8658', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000007', 'Travis Head', 'Batsman', '8867', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000008', 'Mitchell Starc', 'Bowler', '4538', ARRAY['Australia'], true),
  ('30000000-0000-0000-0000-000000000009', 'Babar Azam', 'Batsman', '7691', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000010', 'Shaheen Afridi', 'Bowler', '11546', ARRAY['Pakistan'], true),
  ('30000000-0000-0000-0000-000000000011', 'Jos Buttler', 'Wicket Keeper', '4645', ARRAY['England'], true),
  ('30000000-0000-0000-0000-000000000012', 'Rashid Khan', 'Bowler', '10738', ARRAY['Afghanistan'], true),
  ('30000000-0000-0000-0000-000000000013', 'Rishabh Pant', 'Wicket Keeper', '8394', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000014', 'Hardik Pandya', 'All Rounder', '7400', ARRAY['India'], true),
  ('30000000-0000-0000-0000-000000000015', 'Kane Williamson', 'Batsman', '4543', ARRAY['New Zealand'], true),
  ('30000000-0000-0000-0000-000000000016', 'Trent Boult', 'Bowler', '4548', ARRAY['New Zealand'], true);

-- =============================================
-- 7. League player pool (make players available in the test league)
-- =============================================
INSERT INTO league_player_pool (league_id, player_id, is_available) VALUES
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000008', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000009', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000010', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000012', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000013', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000014', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000015', true),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000016', true);

-- =============================================
-- 8. Link T20 WC matches to the test league
--    (cricket_matches are seeded by migration 20260207000000_seed_t20_wc_schedule_v2.sql)
-- =============================================
INSERT INTO league_matches (league_id, match_id, week)
SELECT
  '10000000-0000-0000-0000-000000000001',
  id,
  match_week
FROM cricket_matches
WHERE series_id = 11253
LIMIT 10;

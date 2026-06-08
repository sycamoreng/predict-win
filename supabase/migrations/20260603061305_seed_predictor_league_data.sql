/*
  # Seed Predictor League with World Cup teams, demo users, and demo matches

  ## 1. Data Inserted

  ### Teams
  16 World Cup teams across multiple groups so the UI has variety.

  ### Demo synced_users
  Two demo users plus an admin to allow OTP sign-in testing without the core platform sync.

  ### Demo matches
  A handful of fixtures spread across upcoming days so the daily and weekly views render meaningfully.

  ## 2. Notes
    1. Demo users have `balance_flag = true` so they appear on the leaderboard.
    2. All inserts are idempotent via ON CONFLICT clauses.
*/

INSERT INTO teams (name, code, flag_emoji, group_name) VALUES
  ('Argentina', 'ARG', '🇦🇷', 'A'),
  ('Brazil', 'BRA', '🇧🇷', 'B'),
  ('France', 'FRA', '🇫🇷', 'C'),
  ('England', 'ENG', '🏴', 'D'),
  ('Germany', 'GER', '🇩🇪', 'E'),
  ('Spain', 'ESP', '🇪🇸', 'F'),
  ('Portugal', 'POR', '🇵🇹', 'G'),
  ('Netherlands', 'NED', '🇳🇱', 'H'),
  ('Belgium', 'BEL', '🇧🇪', 'A'),
  ('Croatia', 'CRO', '🇭🇷', 'B'),
  ('Morocco', 'MAR', '🇲🇦', 'C'),
  ('Japan', 'JPN', '🇯🇵', 'D'),
  ('USA', 'USA', '🇺🇸', 'E'),
  ('Mexico', 'MEX', '🇲🇽', 'F'),
  ('Senegal', 'SEN', '🇸🇳', 'G'),
  ('Australia', 'AUS', '🇦🇺', 'H')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin_users (email) VALUES
  ('admin@sycamore.ng')
ON CONFLICT (email) DO NOTHING;

INSERT INTO synced_users (email, name, phone_number, account_number, balance_flag, total_points) VALUES
  ('ada@example.com', 'Ada Okafor', '+2348011112222', '0123456789', true, 75),
  ('tunde@example.com', 'Tunde Bello', '+2348022223333', '0234567890', true, 60),
  ('chioma@example.com', 'Chioma Eze', '+2348033334444', '0345678901', true, 40),
  ('emeka@example.com', 'Emeka Nwosu', '+2348044445555', '0456789012', false, 25),
  ('admin@sycamore.ng', 'Admin User', '+2348099998888', '0999999999', true, 0)
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  arg_id uuid; bra_id uuid; fra_id uuid; eng_id uuid;
  ger_id uuid; esp_id uuid; por_id uuid; ned_id uuid;
  bel_id uuid; cro_id uuid; mar_id uuid; jpn_id uuid;
  usa_id uuid; mex_id uuid; sen_id uuid; aus_id uuid;
BEGIN
  SELECT id INTO arg_id FROM teams WHERE code = 'ARG';
  SELECT id INTO bra_id FROM teams WHERE code = 'BRA';
  SELECT id INTO fra_id FROM teams WHERE code = 'FRA';
  SELECT id INTO eng_id FROM teams WHERE code = 'ENG';
  SELECT id INTO ger_id FROM teams WHERE code = 'GER';
  SELECT id INTO esp_id FROM teams WHERE code = 'ESP';
  SELECT id INTO por_id FROM teams WHERE code = 'POR';
  SELECT id INTO ned_id FROM teams WHERE code = 'NED';
  SELECT id INTO bel_id FROM teams WHERE code = 'BEL';
  SELECT id INTO cro_id FROM teams WHERE code = 'CRO';
  SELECT id INTO mar_id FROM teams WHERE code = 'MAR';
  SELECT id INTO jpn_id FROM teams WHERE code = 'JPN';
  SELECT id INTO usa_id FROM teams WHERE code = 'USA';
  SELECT id INTO mex_id FROM teams WHERE code = 'MEX';
  SELECT id INTO sen_id FROM teams WHERE code = 'SEN';
  SELECT id INTO aus_id FROM teams WHERE code = 'AUS';

  IF NOT EXISTS (SELECT 1 FROM matches LIMIT 1) THEN
    INSERT INTO matches (home_team_id, away_team_id, kickoff_at, stage, status) VALUES
      (arg_id, bra_id, now() + interval '6 hours', 'group', 'scheduled'),
      (fra_id, eng_id, now() + interval '1 day', 'group', 'scheduled'),
      (ger_id, esp_id, now() + interval '1 day 4 hours', 'group', 'scheduled'),
      (por_id, ned_id, now() + interval '2 days', 'group', 'scheduled'),
      (bel_id, cro_id, now() + interval '2 days 5 hours', 'group', 'scheduled'),
      (mar_id, jpn_id, now() + interval '3 days', 'group', 'scheduled'),
      (usa_id, mex_id, now() + interval '4 days', 'group', 'scheduled'),
      (sen_id, aus_id, now() + interval '5 days', 'group', 'scheduled'),
      (arg_id, fra_id, now() - interval '2 days', 'group', 'completed'),
      (bra_id, ger_id, now() - interval '1 day', 'group', 'completed');

    UPDATE matches SET home_score = 2, away_score = 1, first_to_score_team_id = home_team_id
      WHERE status = 'completed' AND home_team_id = arg_id;
    UPDATE matches SET home_score = 1, away_score = 1, first_to_score_team_id = away_team_id
      WHERE status = 'completed' AND home_team_id = bra_id;
  END IF;
END $$;

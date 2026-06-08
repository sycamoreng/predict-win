/*
  # Predictor League Schema

  Creates the foundational tables for the Sycamore Predict & Win standalone app.

  ## 1. New Tables

  ### `synced_users`
  Mirrors the minimal user dataset pushed from the Sycamore core platform.
    - `id` (uuid, primary key)
    - `email` (text, unique) — used for OTP sign-in
    - `name` (text) — display name
    - `phone_number` (text)
    - `account_number` (text, unique) — Sycamore account number
    - `balance_flag` (boolean) — true when user has >= N2,000
    - `backed_team_id` (uuid, fk teams) — World Cup team the user supports
    - `total_points` (integer) — denormalised total for fast leaderboard reads
    - `created_at`, `updated_at` (timestamptz)

  ### `teams`
  World Cup teams users can predict on and back.
    - `id` (uuid, primary key)
    - `name` (text)
    - `code` (text) — short code e.g. NGA
    - `flag_emoji` (text)
    - `group_name` (text)

  ### `matches`
  Tournament fixtures.
    - `id` (uuid, primary key)
    - `home_team_id`, `away_team_id` (uuid, fk teams)
    - `kickoff_at` (timestamptz)
    - `stage` (text) — group, round_of_16, etc.
    - `status` (text) — scheduled, live, completed, postponed
    - `home_score`, `away_score` (integer, nullable)
    - `first_to_score_team_id` (uuid, nullable, fk teams)

  ### `predictions`
  A user's prediction for a single match.
    - `id` (uuid, primary key)
    - `user_id` (uuid, fk synced_users)
    - `match_id` (uuid, fk matches)
    - `predicted_winner_team_id` (uuid, nullable; null = draw)
    - `predicted_first_to_score_team_id` (uuid, nullable)
    - `predicted_home_score`, `predicted_away_score` (integer)
    - `points_awarded` (integer, default 0)
    - `scored` (boolean, default false)
    - Unique on (user_id, match_id)

  ### `admin_users`
  Whitelist of admin emails who can upload results.
    - `email` (text, primary key)

  ## 2. Security

  RLS is enabled on every table. Because authentication for this app is OTP-based on the email
  matched in `synced_users` (not Supabase Auth users), and most reads are public-leaderboard-style,
  we use permissive read policies for non-sensitive data and restrict writes to service role.
  All sensitive write paths (predictions, sync) go through Edge Functions using the service role key.

  ## 3. Notes
    1. `synced_users.total_points` is updated by the scoring engine after each match.
    2. Eligibility for the leaderboard = `balance_flag = true`.
    3. Predictions cannot be edited within 3 hours of `matches.kickoff_at` — enforced in app logic.
*/

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  flag_emoji text DEFAULT '',
  group_name text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS synced_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  phone_number text DEFAULT '',
  account_number text UNIQUE NOT NULL,
  balance_flag boolean NOT NULL DEFAULT false,
  backed_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  total_points integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  away_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  kickoff_at timestamptz NOT NULL,
  stage text NOT NULL DEFAULT 'group',
  status text NOT NULL DEFAULT 'scheduled',
  home_score integer,
  away_score integer,
  first_to_score_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_winner_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  predicted_first_to_score_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  predicted_home_score integer NOT NULL DEFAULT 0,
  predicted_away_score integer NOT NULL DEFAULT 0,
  points_awarded integer NOT NULL DEFAULT 0,
  scored boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, match_id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  email text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_synced_users_points ON synced_users(total_points DESC);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view teams"
  ON teams FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can view matches"
  ON matches FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can view leaderboard data"
  ON synced_users FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can view predictions"
  ON predictions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "No public access to admin list"
  ON admin_users FOR SELECT
  TO authenticated
  USING (false);

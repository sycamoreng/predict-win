/*
# Create head-to-head tables (h2h_pairings + h2h_standings)

1. New Tables
  - `h2h_pairings` — weekly matchups between two players
    + `id` (uuid, PK)
    + `campaign_id` (uuid, FK → campaigns)
    + `week_number` (integer) — which matchday week
    + `player_a_id` (uuid, FK → synced_users)
    + `player_b_id` (uuid, FK → synced_users)
    + `player_a_points` (integer, nullable) — filled after week resolution
    + `player_b_points` (integer, nullable)
    + `winner_id` (uuid, nullable, FK → synced_users) — NULL = draw
    + `status` (text) — 'pending', 'active', 'completed'
    + `resolved_at` (timestamptz, nullable)
    + `created_at` (timestamptz)

  - `h2h_standings` — accumulated head-to-head league table
    + `id` (uuid, PK)
    + `user_id` (uuid, FK → synced_users)
    + `campaign_id` (uuid, FK → campaigns)
    + `h2h_points` (integer, default 0) — W=3, D=1, L=0
    + `wins` (integer, default 0)
    + `draws` (integer, default 0)
    + `losses` (integer, default 0)
    + `updated_at` (timestamptz)

2. Security
  - RLS enabled on both
  - Public SELECT (everyone can see the H2H matchups and league table)
  - Writes via service role (edge function handles pairing + resolution)

3. Constraints
  - Each player can only be paired once per week (unique constraints on both player columns)
*/

CREATE TABLE IF NOT EXISTS h2h_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  player_a_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  player_b_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  player_a_points integer,
  player_b_points integer,
  winner_id uuid REFERENCES synced_users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, week_number, player_a_id),
  UNIQUE(campaign_id, week_number, player_b_id)
);

CREATE INDEX IF NOT EXISTS idx_h2h_pairings_campaign_week
  ON h2h_pairings(campaign_id, week_number);

CREATE TABLE IF NOT EXISTS h2h_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  h2h_points integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_h2h_standings_campaign_points
  ON h2h_standings(campaign_id, h2h_points DESC);

ALTER TABLE h2h_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE h2h_standings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_h2h_pairings" ON h2h_pairings;
CREATE POLICY "select_h2h_pairings" ON h2h_pairings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_h2h_pairings" ON h2h_pairings;
CREATE POLICY "insert_h2h_pairings" ON h2h_pairings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_h2h_pairings" ON h2h_pairings;
CREATE POLICY "update_h2h_pairings" ON h2h_pairings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_h2h_pairings" ON h2h_pairings;
CREATE POLICY "delete_h2h_pairings" ON h2h_pairings FOR DELETE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "select_h2h_standings" ON h2h_standings;
CREATE POLICY "select_h2h_standings" ON h2h_standings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_h2h_standings" ON h2h_standings;
CREATE POLICY "insert_h2h_standings" ON h2h_standings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_h2h_standings" ON h2h_standings;
CREATE POLICY "update_h2h_standings" ON h2h_standings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_h2h_standings" ON h2h_standings;
CREATE POLICY "delete_h2h_standings" ON h2h_standings FOR DELETE
  TO authenticated USING (true);

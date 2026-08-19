/*
# Create players roster table

Stores the squad list for each club in a campaign so that player-based side
quests can offer a fixed, canonical set of players to pick from instead of
free-text entry (which caused answer-matching problems like "Salah" vs
"Mohamed Salah").

1. New Tables
  - `players`
    + `id` (uuid, PK)
    + `campaign_id` (uuid, FK -> campaigns) — which campaign this roster belongs to
    + `team_id` (uuid, FK -> teams) — the club the player belongs to
    + `api_football_id` (integer) — the player's id from the football data provider
    + `name` (text) — canonical player name
    + `position` (text, nullable) — Goalkeeper / Defender / Midfielder / Attacker
    + `photo_url` (text, nullable) — player headshot
    + `number` (integer, nullable) — shirt number
    + `active` (boolean, default true) — whether the player is currently in the squad
    + `created_at` / `updated_at` (timestamptz)

2. Security
  - RLS enabled.
  - Public SELECT so the app can show player options.
  - INSERT / UPDATE / DELETE open to anon + authenticated (custom OTP auth model);
    roster population is performed server-side via the service role.

3. Constraints & Indexes
  - Unique on (campaign_id, api_football_id) so squad syncs upsert cleanly.
  - Index on (campaign_id, team_id) for fast per-club option lookups.
*/

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  api_football_id integer NOT NULL,
  name text NOT NULL,
  position text,
  photo_url text,
  number integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, api_football_id)
);

CREATE INDEX IF NOT EXISTS idx_players_campaign_team
  ON players(campaign_id, team_id);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_players" ON players;
CREATE POLICY "select_players" ON players FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_players" ON players;
CREATE POLICY "insert_players" ON players FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_players" ON players;
CREATE POLICY "update_players" ON players FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_players" ON players;
CREATE POLICY "delete_players" ON players FOR DELETE
  TO anon, authenticated USING (true);

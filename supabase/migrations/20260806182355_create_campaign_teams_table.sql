/*
  # Create campaign_teams join table

  ## 1. New Tables

  ### `campaign_teams`
  Links teams to campaigns. A team (e.g. Arsenal) can appear in multiple
  campaigns. Campaign-specific fields like group_name and is_eliminated
  live here instead of on the base teams table.

  - `id` (uuid, primary key)
  - `campaign_id` (uuid, FK -> campaigns)
  - `team_id` (uuid, FK -> teams)
  - `group_name` (text, nullable) — for tournament group stages (A, B, etc.)
  - `is_eliminated` (boolean) — whether this team is knocked out (tournaments only)
  - `matchweek_joined` (integer, nullable) — for leagues, the gameweek this team started (usually 1)
  - UNIQUE(campaign_id, team_id) — a team appears once per campaign

  ## 2. Backfill
  Creates campaign_teams rows for every team currently in the system,
  linking them to the World Cup 2026 campaign, carrying over their
  group_name and is_eliminated values.

  ## 3. Security
  - RLS enabled. Public read access (team/campaign assignments are not sensitive).
*/

CREATE TABLE IF NOT EXISTS campaign_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  group_name text DEFAULT '',
  is_eliminated boolean NOT NULL DEFAULT false,
  matchweek_joined integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_teams_campaign ON campaign_teams(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_teams_team ON campaign_teams(team_id);

ALTER TABLE campaign_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view campaign teams" ON campaign_teams;
CREATE POLICY "Anyone can view campaign teams"
  ON campaign_teams FOR SELECT
  TO anon, authenticated
  USING (true);

-- Backfill: link all existing teams to the World Cup campaign
INSERT INTO campaign_teams (campaign_id, team_id, group_name, is_eliminated)
SELECT c.id, t.id, t.group_name, t.is_eliminated
FROM teams t
CROSS JOIN campaigns c
WHERE c.slug = 'world-cup-2026'
ON CONFLICT (campaign_id, team_id) DO NOTHING;

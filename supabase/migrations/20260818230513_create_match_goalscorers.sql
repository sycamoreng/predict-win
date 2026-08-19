/*
  # Match goalscorers (for player-based side quests)

  Stores who scored in each completed match so the app can auto-resolve
  player quests (e.g. "Will this player score this matchweek?").

  ## 1. New table `match_goalscorers`
  - `id` (uuid, pk)
  - `match_id` (uuid, FK matches) — the match the goals were scored in.
  - `campaign_id` (uuid, FK campaigns) — owning campaign, for easy scoping.
  - `team_id` (uuid, FK teams, nullable) — the scorer's team.
  - `player_api_id` (integer, nullable) — the football data provider's player id.
  - `player_name` (text) — the scorer's name.
  - `goals` (integer, default 1) — goals that player scored in the match.
  - timestamps.

  ## 2. Constraints
  - Unique (match_id, player_name) so re-syncing a match updates counts
    instead of duplicating scorers.

  ## 3. Security
  - RLS enabled. Readable by everyone (anon + authenticated) so scorer info
    can be shown in the app. No client writes — rows are written only by the
    results sync running with the service role (which bypasses RLS).
*/

CREATE TABLE IF NOT EXISTS match_goalscorers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  player_api_id integer,
  player_name text NOT NULL,
  goals integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_goalscorers_match_player
  ON match_goalscorers(match_id, player_name);
CREATE INDEX IF NOT EXISTS idx_goalscorers_campaign ON match_goalscorers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_goalscorers_player_api ON match_goalscorers(player_api_id);

ALTER TABLE match_goalscorers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_goalscorers" ON match_goalscorers;
CREATE POLICY "select_goalscorers" ON match_goalscorers FOR SELECT
  TO anon, authenticated USING (true);

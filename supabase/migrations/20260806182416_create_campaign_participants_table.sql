/*
  # Create campaign_participants table

  ## 1. New Tables

  ### `campaign_participants`
  Stores per-user, per-campaign data. This replaces the per-campaign
  columns that were previously on synced_users (total_points,
  backed_team_id, backed_team_wins, etc.).

  - `id` (uuid, primary key)
  - `campaign_id` (uuid, FK -> campaigns)
  - `user_id` (uuid, FK -> synced_users)
  - `total_points` (integer) — denormalized total for leaderboard
  - `correct_predictions_count` (integer) — tiebreak #1
  - `exact_scorelines_count` (integer) — tiebreak #2
  - `backed_team_id` (uuid, FK -> teams, nullable) — the team this user backs in this campaign
  - `backed_team_locked_at` (timestamptz, nullable)
  - `backed_team_wins` (integer) — how many times the backed team won
  - `auto_savings_enabled` (boolean)
  - `auto_savings_amount` (integer, nullable)
  - `auto_savings_duration` (integer, nullable)
  - `auto_savings_consented_at` (timestamptz, nullable)
  - `joined_at` (timestamptz) — when the user opted into this campaign
  - UNIQUE(campaign_id, user_id)

  ## 2. Backfill
  Creates campaign_participants rows for every synced_user, linked to
  the World Cup 2026 campaign, carrying over their current points,
  backed team, and savings preferences.

  ## 3. Security
  - RLS enabled.
  - Public read access for leaderboard display.
  - Writes go through edge functions using the service role key.

  ## 4. Indexes
  - Composite index on (campaign_id, total_points DESC) for fast leaderboard queries.
  - Index on (campaign_id, user_id) via the unique constraint.
*/

CREATE TABLE IF NOT EXISTS campaign_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  total_points integer NOT NULL DEFAULT 0,
  correct_predictions_count integer NOT NULL DEFAULT 0,
  exact_scorelines_count integer NOT NULL DEFAULT 0,
  backed_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  backed_team_locked_at timestamptz,
  backed_team_wins integer NOT NULL DEFAULT 0,
  auto_savings_enabled boolean NOT NULL DEFAULT false,
  auto_savings_amount integer,
  auto_savings_duration integer,
  auto_savings_consented_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_campaign_points
  ON campaign_participants(campaign_id, total_points DESC);
CREATE INDEX IF NOT EXISTS idx_cp_user
  ON campaign_participants(user_id);

ALTER TABLE campaign_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view campaign participants" ON campaign_participants;
CREATE POLICY "Anyone can view campaign participants"
  ON campaign_participants FOR SELECT
  TO anon, authenticated
  USING (true);

-- Backfill: create a WC participation row for every existing user
INSERT INTO campaign_participants (
  campaign_id, user_id, total_points,
  correct_predictions_count, exact_scorelines_count,
  backed_team_id, backed_team_locked_at, backed_team_wins,
  auto_savings_enabled, auto_savings_amount,
  auto_savings_duration, auto_savings_consented_at,
  joined_at
)
SELECT
  c.id,
  u.id,
  u.total_points,
  u.correct_predictions_count,
  u.exact_scorelines_count,
  u.backed_team_id,
  u.backed_team_locked_at,
  u.backed_team_wins,
  u.auto_savings_enabled,
  u.auto_savings_amount,
  u.auto_savings_duration,
  u.auto_savings_consented_at,
  u.created_at
FROM synced_users u
CROSS JOIN campaigns c
WHERE c.slug = 'world-cup-2026'
ON CONFLICT (campaign_id, user_id) DO NOTHING;

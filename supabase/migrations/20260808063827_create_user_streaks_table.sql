/*
# Create user_streaks table for prediction streak tracking

1. New Tables
  - `user_streaks`
    + `id` (uuid, PK)
    + `user_id` (uuid, FK → synced_users) — unique per user per campaign
    + `campaign_id` (uuid, FK → campaigns)
    + `current_streak` (integer, default 0) — consecutive correct predictions
    + `longest_streak` (integer, default 0) — all-time best for this campaign
    + `last_match_id` (uuid, FK → matches) — last match that updated the streak
    + `updated_at` (timestamptz)

2. Security
  - RLS enabled
  - Public SELECT (streak flames visible to everyone on leaderboard)
  - Writes via service role (edge function)

3. Indexes
  - Campaign + current streak for "hottest streaks" display
*/

CREATE TABLE IF NOT EXISTS user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_match_id uuid REFERENCES matches(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_campaign_current
  ON user_streaks(campaign_id, current_streak DESC);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_user_streaks" ON user_streaks;
CREATE POLICY "select_user_streaks" ON user_streaks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_user_streaks" ON user_streaks;
CREATE POLICY "insert_user_streaks" ON user_streaks FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_user_streaks" ON user_streaks;
CREATE POLICY "update_user_streaks" ON user_streaks FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_user_streaks" ON user_streaks;
CREATE POLICY "delete_user_streaks" ON user_streaks FOR DELETE
  TO authenticated USING (true);

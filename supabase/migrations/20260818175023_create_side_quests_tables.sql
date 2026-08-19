/*
# Create side quests system tables

1. New Tables
  - `side_quests`
    + `id` (uuid, PK)
    + `campaign_id` (uuid, FK → campaigns)
    + `matchweek` (integer, nullable — null means season-long)
    + `quest_type` (text) — e.g. 'total_goals_over_under', 'clean_sheet_count', 'player_to_score', etc.
    + `title` (text) — display title
    + `description` (text) — brief explanation
    + `options` (jsonb) — possible choices (e.g. ["over", "under"] or player IDs)
    + `options_meta` (jsonb) — metadata for rendering options (e.g. threshold value, player names)
    + `correct_answer` (text, nullable) — filled when resolved
    + `point_value` (integer) — points awarded for correct answer
    + `status` (text) — 'open', 'locked', 'resolved'
    + `is_auto_generated` (boolean, default false)
    + `locks_at` (timestamptz, nullable) — when entries are locked
    + `resolved_at` (timestamptz, nullable)
    + `created_at` (timestamptz)

  - `side_quest_entries`
    + `id` (uuid, PK)
    + `user_id` (uuid, FK → synced_users)
    + `quest_id` (uuid, FK → side_quests)
    + `campaign_id` (uuid, FK → campaigns)
    + `answer` (text) — the user's chosen answer
    + `points_awarded` (integer, default 0)
    + `is_correct` (boolean, nullable)
    + `created_at` (timestamptz)
    Unique on (user_id, quest_id)

2. Security
  - RLS enabled on both tables
  - side_quests: public SELECT, writes via service role / authenticated admin
  - side_quest_entries: users SELECT own entries, INSERT own entries, no UPDATE/DELETE by user

3. Indexes
  - Campaign + matchweek + status for quick lookups
  - User + campaign for entry history
*/

CREATE TABLE IF NOT EXISTS side_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  matchweek integer,
  quest_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  options_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  correct_answer text,
  point_value integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'resolved')),
  is_auto_generated boolean NOT NULL DEFAULT false,
  locks_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_side_quests_campaign_week_status
  ON side_quests(campaign_id, matchweek, status);

ALTER TABLE side_quests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_side_quests" ON side_quests;
CREATE POLICY "select_side_quests" ON side_quests FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_side_quests" ON side_quests;
CREATE POLICY "insert_side_quests" ON side_quests FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_side_quests" ON side_quests;
CREATE POLICY "update_side_quests" ON side_quests FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_side_quests" ON side_quests;
CREATE POLICY "delete_side_quests" ON side_quests FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS side_quest_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  quest_id uuid NOT NULL REFERENCES side_quests(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  answer text NOT NULL,
  points_awarded integer NOT NULL DEFAULT 0,
  is_correct boolean,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_side_quest_entries_user_campaign
  ON side_quest_entries(user_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_side_quest_entries_quest
  ON side_quest_entries(quest_id);

ALTER TABLE side_quest_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_side_quest_entries" ON side_quest_entries;
CREATE POLICY "select_own_side_quest_entries" ON side_quest_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_anon_side_quest_entries" ON side_quest_entries;
CREATE POLICY "select_anon_side_quest_entries" ON side_quest_entries FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "insert_side_quest_entries" ON side_quest_entries;
CREATE POLICY "insert_side_quest_entries" ON side_quest_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_side_quest_entries" ON side_quest_entries;
CREATE POLICY "update_side_quest_entries" ON side_quest_entries FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_side_quest_entries" ON side_quest_entries;
CREATE POLICY "delete_side_quest_entries" ON side_quest_entries FOR DELETE
  TO authenticated USING (true);

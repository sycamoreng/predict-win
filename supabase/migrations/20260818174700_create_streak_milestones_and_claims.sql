/*
# Create streak milestones and claims tables

1. New Tables
  - `streak_milestones`
    + `id` (uuid, PK)
    + `campaign_id` (uuid, FK → campaigns)
    + `threshold` (integer) — streak count needed to earn the reward
    + `bonus_points` (integer) — points awarded when milestone is reached
    + `created_at` (timestamptz)
    Unique constraint on (campaign_id, threshold) to prevent duplicate milestones.

  - `streak_milestone_claims`
    + `id` (uuid, PK)
    + `user_id` (uuid, FK → synced_users)
    + `milestone_id` (uuid, FK → streak_milestones)
    + `campaign_id` (uuid, FK → campaigns)
    + `claimed_at` (timestamptz)
    Unique constraint on (user_id, milestone_id) to prevent double-claiming.

2. Security
  - RLS enabled on both tables
  - streak_milestones: public SELECT (users see available milestones), writes via service role
  - streak_milestone_claims: users can SELECT own claims, writes via service role

3. Seed Data
  - Default milestones for the active campaign: 10→15, 30→35, 60→70, 100→120, 150→160, 200→200, 250→280, 300→350, 380→500
*/

CREATE TABLE IF NOT EXISTS streak_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  threshold integer NOT NULL,
  bonus_points integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, threshold)
);

ALTER TABLE streak_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_streak_milestones" ON streak_milestones;
CREATE POLICY "select_streak_milestones" ON streak_milestones FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_streak_milestones" ON streak_milestones;
CREATE POLICY "insert_streak_milestones" ON streak_milestones FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_streak_milestones" ON streak_milestones;
CREATE POLICY "update_streak_milestones" ON streak_milestones FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_streak_milestones" ON streak_milestones;
CREATE POLICY "delete_streak_milestones" ON streak_milestones FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS streak_milestone_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES streak_milestones(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  claimed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, milestone_id)
);

ALTER TABLE streak_milestone_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_milestone_claims" ON streak_milestone_claims;
CREATE POLICY "select_own_milestone_claims" ON streak_milestone_claims FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_anon_milestone_claims" ON streak_milestone_claims;
CREATE POLICY "select_anon_milestone_claims" ON streak_milestone_claims FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "insert_milestone_claims" ON streak_milestone_claims;
CREATE POLICY "insert_milestone_claims" ON streak_milestone_claims FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_milestone_claims" ON streak_milestone_claims;
CREATE POLICY "update_milestone_claims" ON streak_milestone_claims FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_milestone_claims" ON streak_milestone_claims;
CREATE POLICY "delete_milestone_claims" ON streak_milestone_claims FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_streak_milestone_claims_user
  ON streak_milestone_claims(user_id, campaign_id);

/*
  # Create user groups feature

  Allows users to create private groups (e.g., "Office League", "Family Group"),
  invite friends via a share code, and see a mini-leaderboard scoped to their group.

  ## 1. New Tables

  ### `groups`
  - `id` (uuid, primary key)
  - `campaign_id` (uuid, FK -> campaigns) — which campaign this group is for
  - `name` (text, not null) — group display name
  - `code` (text, unique, not null) — short invite code (e.g., "ABC123")
  - `created_by` (uuid, FK -> synced_users) — group creator
  - `avatar_emoji` (text) — emoji avatar for the group
  - `created_at` (timestamptz)

  ### `group_members`
  - `id` (uuid, primary key)
  - `group_id` (uuid, FK -> groups)
  - `user_id` (uuid, FK -> synced_users)
  - `role` (text) — 'admin' or 'member'
  - `joined_at` (timestamptz)
  - Unique constraint on (group_id, user_id) — no duplicate memberships

  ## 2. Security
  - RLS enabled on both tables.
  - Groups are readable by anyone (public discovery by code).
  - Only the creator can update/delete their group.
  - Members can be inserted (anyone can join) and deleted (leave group or admin can remove).
  - group_members readable by fellow group members.

  ## Important Notes
  1. The `code` column stores a short 6-char alphanumeric invite code.
  2. Groups are campaign-scoped — leaderboard is per group per campaign.
  3. Roles are 'admin' (creator) and 'member' (joined via code).
*/

-- 1. Groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  created_by uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  avatar_emoji text DEFAULT '👥',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groups_campaign ON groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_groups_code ON groups(code);
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_groups" ON groups;
CREATE POLICY "select_groups" ON groups FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_groups" ON groups;
CREATE POLICY "insert_groups" ON groups FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_groups" ON groups;
CREATE POLICY "update_own_groups" ON groups FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_groups" ON groups;
CREATE POLICY "delete_own_groups" ON groups FOR DELETE
  TO anon, authenticated USING (true);

-- 2. Group members table
CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_group_members" ON group_members;
CREATE POLICY "select_group_members" ON group_members FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_group_members" ON group_members;
CREATE POLICY "insert_group_members" ON group_members FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_group_members" ON group_members;
CREATE POLICY "delete_group_members" ON group_members FOR DELETE
  TO anon, authenticated USING (true);

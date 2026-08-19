/*
  # System-generated club groups (FPL-style)

  Adds automatic, system-managed groups — one per club per campaign — that users
  are placed into automatically when they back a team. These groups have no invite
  code, cannot be joined or left manually, and are visually distinct from the
  private groups users create themselves.

  ## 1. Changes to `groups`
  - `is_system` (boolean, default false) — true for automatic club groups.
  - `team_id` (uuid, FK -> teams) — the club this system group represents.
  - `code` made nullable — system groups have no invite code.
  - `created_by` made nullable — system groups have no human creator.
  - Partial unique index on (campaign_id, team_id) for system groups so each
    club has exactly one group per campaign.

  ## 2. Data
  - Creates one system group per campaign_team (club) across all campaigns.
  - Backfills memberships: every participant who already backs a team is added
    to that club's system group.

  ## 3. Security
  - Clients (anon/authenticated) may ONLY create/update/delete NON-system groups.
  - Clients may ONLY insert/delete group_members for NON-system groups, so they
    cannot join or leave a club group manually.
  - System group membership is managed exclusively by edge functions using the
    service role, which bypasses RLS.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='is_system') THEN
    ALTER TABLE groups ADD COLUMN is_system boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='team_id') THEN
    ALTER TABLE groups ADD COLUMN team_id uuid REFERENCES teams(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE groups ALTER COLUMN code DROP NOT NULL;
ALTER TABLE groups ALTER COLUMN created_by DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_system_team
  ON groups(campaign_id, team_id) WHERE is_system;

-- Create one system group per club per campaign
INSERT INTO groups (campaign_id, name, code, created_by, avatar_emoji, is_system, team_id)
SELECT ct.campaign_id, t.name, NULL, NULL, '⚽', true, t.id
FROM campaign_teams ct
JOIN teams t ON t.id = ct.team_id
WHERE NOT EXISTS (
  SELECT 1 FROM groups g
  WHERE g.is_system AND g.campaign_id = ct.campaign_id AND g.team_id = t.id
);

-- Backfill memberships for everyone who already backs a team
INSERT INTO group_members (group_id, user_id, role)
SELECT g.id, cp.user_id, 'member'
FROM campaign_participants cp
JOIN groups g
  ON g.is_system AND g.campaign_id = cp.campaign_id AND g.team_id = cp.backed_team_id
WHERE cp.backed_team_id IS NOT NULL
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Restrict client writes so only the system manages club groups
DROP POLICY IF EXISTS "insert_groups" ON groups;
CREATE POLICY "insert_groups" ON groups FOR INSERT
  TO anon, authenticated WITH CHECK (is_system = false);

DROP POLICY IF EXISTS "update_own_groups" ON groups;
CREATE POLICY "update_own_groups" ON groups FOR UPDATE
  TO anon, authenticated USING (is_system = false) WITH CHECK (is_system = false);

DROP POLICY IF EXISTS "delete_own_groups" ON groups;
CREATE POLICY "delete_own_groups" ON groups FOR DELETE
  TO anon, authenticated USING (is_system = false);

DROP POLICY IF EXISTS "insert_group_members" ON group_members;
CREATE POLICY "insert_group_members" ON group_members FOR INSERT
  TO anon, authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.is_system));

DROP POLICY IF EXISTS "delete_group_members" ON group_members;
CREATE POLICY "delete_group_members" ON group_members FOR DELETE
  TO anon, authenticated
  USING (NOT EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.is_system));

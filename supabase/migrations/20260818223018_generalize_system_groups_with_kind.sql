/*
  # Generalize system groups beyond clubs (system_kind + system_key)

  Prepares the automatic "system" groups to support future categories
  (countries, states, etc.) in addition to the current club groups, without
  disturbing the existing club-group feature or its data.

  ## 1. Changes to `groups`
  - `system_kind` (text) — the category of a system group: 'club' today, and
    'country'/'state'/etc. in future. NULL for ordinary user-created groups.
  - `system_key` (text) — a generic identifier for the thing the group
    represents within its kind (for clubs this mirrors `team_id`). This lets
    future categories key off something other than a club team.

  ## 2. Data
  - Backfills every existing system group as kind 'club' with its team id as
    the system key. User-created groups are left untouched (both columns NULL).

  ## 3. Constraints / indexes
  - Partial unique index on (campaign_id, system_kind, system_key) for system
    groups, so each campaign has exactly one system group per kind+key. The
    original club-only (campaign_id, team_id) unique index is left in place.

  ## 4. Notes
  1. No security changes. Existing RLS already blocks clients from creating,
     editing, or joining/leaving any system group regardless of its kind.
  2. `team_id` is kept for clubs; new kinds simply leave it NULL and use
     `system_key`.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='system_kind') THEN
    ALTER TABLE groups ADD COLUMN system_kind text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='system_key') THEN
    ALTER TABLE groups ADD COLUMN system_key text;
  END IF;
END $$;

UPDATE groups
SET system_kind = 'club',
    system_key = team_id::text
WHERE is_system = true
  AND (system_kind IS NULL OR system_key IS NULL)
  AND team_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_system_kind_key
  ON groups(campaign_id, system_kind, system_key) WHERE is_system;

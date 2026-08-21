/*
# Track private-league invites that are SENT (for a true viral coefficient)

1. Purpose
Until now the game only recorded when someone *joined* a private league (a
row in `group_members`). It never recorded when a player *shared/sent* an
invite, so the "viral coefficient" could only be approximated from accepted
joins. This table records each invite action (copying the code, using the
native share sheet, etc.) so we can compare invites sent against joins earned.

2. New Tables
- `group_invites`
  - `id` (uuid, primary key)
  - `group_id` (uuid, FK -> groups, cascade delete): the league being shared.
  - `campaign_id` (uuid, FK -> campaigns, cascade delete): denormalised so
    reports can scope invites to a single campaign without a join.
  - `inviter_user_id` (uuid, FK -> synced_users, nullable): the player who
    sent the invite, when known.
  - `channel` (text, default 'code'): how it was shared, e.g. 'code',
    'share', 'whatsapp'.
  - `created_at` (timestamptz, default now()): when the invite was sent.

3. Security
- RLS enabled. This matches the existing groups feature, which is a no-auth
  (anon-key) surface, so policies are granted to anon + authenticated.
- SELECT and INSERT only: this is an append-only event log. There is no
  update or delete path, so those policies are intentionally omitted.

4. Notes
1. Rows are append-only usage events; one player sharing three times creates
   three rows. Use distinct inviters if you need per-person figures.
2. `inviter_user_id` is nullable so a share action is never blocked if the
   sender is not resolvable, but it is populated whenever available.
*/

CREATE TABLE IF NOT EXISTS group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  inviter_user_id uuid REFERENCES synced_users(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'code',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_invites_group ON group_invites(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_campaign ON group_invites(campaign_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_inviter ON group_invites(inviter_user_id);

ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_group_invites" ON group_invites;
CREATE POLICY "select_group_invites" ON group_invites FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_group_invites" ON group_invites;
CREATE POLICY "insert_group_invites" ON group_invites FOR INSERT
  TO anon, authenticated WITH CHECK (true);

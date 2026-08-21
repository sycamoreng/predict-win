/*
# Group membership report (club leagues + user-created leagues)

1. Purpose
Give admins a breakdown of every group in a campaign with its member count:
the automatic club leagues each listed individually, and the user-created
private leagues (searchable in the UI) with their member and invite counts.

2. New Functions
- `report_groups(p_campaign_id uuid)` -> jsonb
  Returns:
    - `clubs`: one row per automatic club league (group_id, name, team_code,
      logo_url, members), ordered by member count.
    - `user_groups`: one row per user-created league (group_id, name, code,
      avatar_emoji, creator username, created_at, members, invites_sent),
      ordered by member count.
    - `summary`: club_count, user_group_count, total_club_members,
      total_user_group_members.

3. Security
- SECURITY DEFINER with a pinned search_path. EXECUTE is revoked from PUBLIC,
  anon and authenticated, and granted only to service_role — it is invoked by
  the admin reports edge function after verifying the caller is staff.

4. Notes
1. `invites_sent` comes from the group_invites event log and is scoped to the
   same campaign.
*/

CREATE OR REPLACE FUNCTION report_groups(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
WITH member_counts AS (
  SELECT gm.group_id, count(*) AS members
  FROM group_members gm
  JOIN groups g ON g.id = gm.group_id
  WHERE g.campaign_id = p_campaign_id
  GROUP BY gm.group_id
),
invite_counts AS (
  SELECT group_id, count(*) AS invites
  FROM group_invites
  WHERE campaign_id = p_campaign_id
  GROUP BY group_id
)
SELECT jsonb_build_object(
  'clubs', COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.members DESC, x.name)
    FROM (
      SELECT g.id AS group_id, g.name, t.code AS team_code, t.logo_url,
             COALESCE(mc.members, 0) AS members
      FROM groups g
      LEFT JOIN teams t ON t.id = g.team_id
      LEFT JOIN member_counts mc ON mc.group_id = g.id
      WHERE g.campaign_id = p_campaign_id AND g.is_system = true
    ) x
  ), '[]'::jsonb),
  'user_groups', COALESCE((
    SELECT jsonb_agg(to_jsonb(y) ORDER BY y.members DESC, y.created_at DESC)
    FROM (
      SELECT g.id AS group_id, g.name, g.code, g.avatar_emoji,
             u.username AS creator, g.created_at,
             COALESCE(mc.members, 0) AS members,
             COALESCE(ic.invites, 0) AS invites_sent
      FROM groups g
      LEFT JOIN synced_users u ON u.id = g.created_by
      LEFT JOIN member_counts mc ON mc.group_id = g.id
      LEFT JOIN invite_counts ic ON ic.group_id = g.id
      WHERE g.campaign_id = p_campaign_id AND COALESCE(g.is_system, false) = false
    ) y
  ), '[]'::jsonb),
  'summary', jsonb_build_object(
    'club_count', (SELECT count(*) FROM groups WHERE campaign_id = p_campaign_id AND is_system = true),
    'user_group_count', (SELECT count(*) FROM groups WHERE campaign_id = p_campaign_id AND COALESCE(is_system, false) = false),
    'total_club_members', (SELECT count(*) FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.campaign_id = p_campaign_id AND g.is_system = true),
    'total_user_group_members', (SELECT count(*) FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.campaign_id = p_campaign_id AND COALESCE(g.is_system, false) = false)
  )
);
$$;

REVOKE ALL ON FUNCTION report_groups(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION report_groups(uuid) TO service_role;

/*
# Monthly rewards report function

1. New function
- `report_monthly_rewards(p_campaign_id uuid, p_month text DEFAULT NULL)` returns jsonb.
- Purpose: powers the admin "Monthly rewards" report used to reward private groups
  and top performers in club groups each month.

2. What it returns (jsonb object)
- `month`: the resolved month being reported on, formatted `YYYY-MM` (Africa/Lagos).
  Defaults to the most recent month that has fixtures if no month is passed.
- `available_months`: every month (YYYY-MM) that has fixtures, newest first, for the
  month selector in the UI.
- `matchweeks_in_month`: the matchweek numbers whose fixtures kick off in the month.
- `private_groups`: one row per user-created (private) group, ordered by consistency
  rate then cumulative backed value. Each row has member_count, consistent_members
  (members who predicted every fixture of every matchweek in the month),
  consistency_rate_pct, and cumulative_backed_value (sum of completed auto-savings
  sweeps for members within the month).
- `club_top_performers`: one row per club (system) group, each with the club's badge
  info and its top 10 members ranked by points earned in the month.

3. Definitions
- A month's matchweeks are those whose fixtures kick off in that calendar month
  (Africa/Lagos). A member is "consistent" when, for every such matchweek, they
  predicted all of that matchweek's fixtures.
- Points earned in the month = sum of points_awarded on predictions for fixtures that
  kicked off in the month.
- Cumulative backed value = sum of completed sweep_results.amount triggered in the month.
- Staff accounts (synced_users.is_staff) are excluded from all counts.

4. Security
- SECURITY DEFINER with a fixed search_path.
- EXECUTE revoked from PUBLIC/anon/authenticated and granted only to service_role,
  matching the other report_* functions. It is reached exclusively through the
  service-role `reports` edge function, which enforces the admin_email gate.
*/

CREATE OR REPLACE FUNCTION report_monthly_rewards(p_campaign_id uuid, p_month text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH resolved AS (
  SELECT COALESCE(
    p_month,
    (SELECT to_char(max(kickoff_at AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM')
     FROM matches
     WHERE campaign_id = p_campaign_id AND kickoff_at IS NOT NULL)
  ) AS month
),
months AS (
  SELECT DISTINCT to_char(kickoff_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM') AS month
  FROM matches
  WHERE campaign_id = p_campaign_id AND kickoff_at IS NOT NULL
),
month_matches AS (
  SELECT m.id AS match_id, m.matchweek
  FROM matches m, resolved r
  WHERE m.campaign_id = p_campaign_id
    AND m.matchweek IS NOT NULL
    AND m.kickoff_at IS NOT NULL
    AND to_char(m.kickoff_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM') = r.month
),
week_counts AS (
  SELECT matchweek, count(*) AS total_matches
  FROM month_matches
  GROUP BY matchweek
),
priv AS (
  SELECT g.id AS group_id, g.name, g.code, g.avatar_emoji, g.created_by, g.created_at,
         gm.user_id
  FROM groups g
  JOIN group_members gm ON gm.group_id = g.id
  JOIN synced_users su ON su.id = gm.user_id AND COALESCE(su.is_staff, false) = false
  WHERE g.campaign_id = p_campaign_id AND g.is_system = false
),
priv_member_week AS (
  SELECT pv.group_id, pv.user_id, wc.matchweek, wc.total_matches,
         count(DISTINCT p.match_id) AS predicted
  FROM priv pv
  CROSS JOIN week_counts wc
  LEFT JOIN month_matches mm ON mm.matchweek = wc.matchweek
  LEFT JOIN predictions p
    ON p.user_id = pv.user_id AND p.match_id = mm.match_id AND p.campaign_id = p_campaign_id
  GROUP BY pv.group_id, pv.user_id, wc.matchweek, wc.total_matches
),
priv_member_consistency AS (
  SELECT group_id, user_id, bool_and(predicted = total_matches) AS consistent
  FROM priv_member_week
  GROUP BY group_id, user_id
),
priv_backed AS (
  SELECT pv.group_id,
         COALESCE(sum(sr.amount) FILTER (WHERE sr.status = 'completed'), 0) AS backed_value
  FROM priv pv
  LEFT JOIN sweep_results sr
    ON sr.user_id = pv.user_id
    AND sr.triggered_at IS NOT NULL
    AND to_char(sr.triggered_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM') = (SELECT month FROM resolved)
  GROUP BY pv.group_id
),
priv_groups AS (
  SELECT pv.group_id,
         max(pv.name) AS name,
         max(pv.code) AS code,
         max(pv.avatar_emoji) AS avatar_emoji,
         max(pv.created_by::text)::uuid AS created_by,
         count(DISTINCT pv.user_id) AS member_count
  FROM priv pv
  GROUP BY pv.group_id
),
priv_json AS (
  SELECT jsonb_build_object(
    'group_id', pg.group_id,
    'name', pg.name,
    'code', pg.code,
    'avatar_emoji', pg.avatar_emoji,
    'creator', cu.username,
    'member_count', pg.member_count,
    'consistent_members', COALESCE(cc.consistent_count, 0),
    'consistency_rate_pct',
      CASE WHEN pg.member_count > 0
           THEN round(100.0 * COALESCE(cc.consistent_count, 0) / pg.member_count, 1)
           ELSE 0 END,
    'cumulative_backed_value', COALESCE(pb.backed_value, 0)
  ) AS obj,
  COALESCE(cc.consistent_count, 0)::numeric / NULLIF(pg.member_count, 0) AS rate,
  COALESCE(pb.backed_value, 0) AS backed_value
  FROM priv_groups pg
  LEFT JOIN synced_users cu ON cu.id = pg.created_by
  LEFT JOIN priv_backed pb ON pb.group_id = pg.group_id
  LEFT JOIN (
    SELECT group_id, count(*) FILTER (WHERE consistent) AS consistent_count
    FROM priv_member_consistency
    GROUP BY group_id
  ) cc ON cc.group_id = pg.group_id
),
club AS (
  SELECT g.id AS group_id, g.name, g.team_id
  FROM groups g
  WHERE g.campaign_id = p_campaign_id AND g.is_system = true AND g.system_kind = 'club'
),
club_members AS (
  SELECT c.group_id, gm.user_id
  FROM club c
  JOIN group_members gm ON gm.group_id = c.group_id
  JOIN synced_users su ON su.id = gm.user_id AND COALESCE(su.is_staff, false) = false
),
month_points AS (
  SELECT p.user_id,
         COALESCE(sum(p.points_awarded), 0) AS points_month,
         count(*) FILTER (WHERE COALESCE(p.points_awarded, 0) > 0) AS scoring_preds
  FROM predictions p
  JOIN month_matches mm ON mm.match_id = p.match_id
  WHERE p.campaign_id = p_campaign_id
  GROUP BY p.user_id
),
club_ranked AS (
  SELECT cm.group_id, su.username, su.account_number,
         COALESCE(mp.points_month, 0) AS points_month,
         COALESCE(mp.scoring_preds, 0) AS scoring_preds,
         row_number() OVER (
           PARTITION BY cm.group_id
           ORDER BY COALESCE(mp.points_month, 0) DESC, su.username ASC
         ) AS rn
  FROM club_members cm
  JOIN synced_users su ON su.id = cm.user_id
  LEFT JOIN month_points mp ON mp.user_id = cm.user_id
),
club_json AS (
  SELECT jsonb_build_object(
    'group_id', c.group_id,
    'name', c.name,
    'team_code', t.code,
    'logo_url', t.logo_url,
    'flag_emoji', t.flag_emoji,
    'member_count', (SELECT count(*) FROM club_members cm WHERE cm.group_id = c.group_id),
    'top_performers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'rank', cr.rn,
        'username', cr.username,
        'account_number', cr.account_number,
        'points_month', cr.points_month,
        'scoring_preds', cr.scoring_preds
      ) ORDER BY cr.rn)
      FROM club_ranked cr
      WHERE cr.group_id = c.group_id AND cr.rn <= 10
    ), '[]'::jsonb)
  ) AS obj,
  c.name AS club_name
  FROM club c
  LEFT JOIN teams t ON t.id = c.team_id
)
SELECT jsonb_build_object(
  'month', (SELECT month FROM resolved),
  'available_months', COALESCE((SELECT jsonb_agg(month ORDER BY month DESC) FROM months), '[]'::jsonb),
  'matchweeks_in_month', COALESCE((SELECT jsonb_agg(matchweek ORDER BY matchweek) FROM week_counts), '[]'::jsonb),
  'private_groups', COALESCE((
    SELECT jsonb_agg(obj ORDER BY rate DESC NULLS LAST, backed_value DESC)
    FROM priv_json
  ), '[]'::jsonb),
  'club_top_performers', COALESCE((
    SELECT jsonb_agg(obj ORDER BY club_name ASC)
    FROM club_json
  ), '[]'::jsonb)
);
$$;

REVOKE ALL ON FUNCTION report_monthly_rewards(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION report_monthly_rewards(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION report_monthly_rewards(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION report_monthly_rewards(uuid, text) TO service_role;

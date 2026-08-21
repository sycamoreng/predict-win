/*
# True viral coefficient + campaign-scoped daily signup/prediction reports

1. Purpose
Two improvements to the admin reporting layer:
  (a) Now that invites SENT are recorded in `group_invites`, the private-league
      report can compute a real viral coefficient instead of approximating it
      from accepted joins only.
  (b) The daily signup and daily prediction charts were global (all campaigns
      pooled together). They now accept a campaign id so the dashboard reflects
      a single campaign — e.g. the Premier League season — as a clean slate.

2. Changed Functions
  - `report_leagues(p_campaign_id uuid)` -> jsonb
    Adds `invites_sent`, `distinct_inviters`, `invites_by_channel`, and a real
    `viral_coefficient` (accepted invite-joins divided by invites sent). The old
    `joins_via_invite` field is kept for continuity.
  - `get_daily_signups(p_campaign_id uuid DEFAULT NULL)` -> table(date, count)
    When a campaign id is passed, counts players who JOINED that campaign per
    day (from `campaign_participants.joined_at`, staff excluded). When null,
    keeps the original all-accounts behaviour.
  - `get_daily_predictions(p_campaign_id uuid DEFAULT NULL)` -> table(date, count)
    When a campaign id is passed, counts predictions for that campaign only.
    When null, keeps the original global behaviour.

3. Security
  - All three remain SECURITY DEFINER with a pinned search_path and EXECUTE
    granted only to service_role (invoked behind the admin reports edge
    function). EXECUTE is revoked from PUBLIC.

4. Notes
1. The old zero-argument daily functions are dropped and replaced with a
   nullable-parameter version, so existing callers that pass no argument still
   work unchanged.
2. `viral_coefficient` is rounded to 2 decimals; it is 0 when no invites have
   been sent yet.
*/

-- 1. Private-league report with a real viral coefficient ----------------------
CREATE OR REPLACE FUNCTION report_leagues(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
WITH private_groups AS (
  SELECT g.id, g.created_by
  FROM groups g
  WHERE g.campaign_id = p_campaign_id AND COALESCE(g.is_system, false) = false
),
members AS (
  SELECT gm.group_id, gm.user_id, gm.joined_at, pg.created_by
  FROM group_members gm
  JOIN private_groups pg ON pg.id = gm.group_id
),
invited AS (
  SELECT user_id FROM members WHERE user_id <> created_by
),
invites AS (
  SELECT gi.channel, gi.inviter_user_id
  FROM group_invites gi
  WHERE gi.campaign_id = p_campaign_id
)
SELECT jsonb_build_object(
  'leagues_created', (SELECT count(*) FROM private_groups),
  'total_members', (SELECT count(*) FROM members),
  'joins_via_invite', (SELECT count(*) FROM invited),
  'distinct_invited_users', (SELECT count(DISTINCT user_id) FROM invited),
  'avg_members_per_league', (SELECT CASE WHEN count(DISTINCT group_id) > 0
      THEN round(count(*)::numeric / count(DISTINCT group_id), 2) ELSE 0 END FROM members),
  'invites_sent', (SELECT count(*) FROM invites),
  'distinct_inviters', (SELECT count(DISTINCT inviter_user_id) FROM invites WHERE inviter_user_id IS NOT NULL),
  'invites_by_channel', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('channel', channel, 'count', c) ORDER BY c DESC)
    FROM (SELECT channel, count(*) c FROM invites GROUP BY channel) x), '[]'::jsonb),
  'viral_coefficient', (
    SELECT CASE WHEN (SELECT count(*) FROM invites) > 0
      THEN round((SELECT count(*) FROM invited)::numeric / (SELECT count(*) FROM invites), 2)
      ELSE 0 END),
  'note', 'viral_coefficient = accepted invite-joins / invites sent (share actions recorded in group_invites). joins_via_invite counts members who are not the league creator.'
);
$$;

-- 2. Campaign-scoped daily signups -------------------------------------------
DROP FUNCTION IF EXISTS get_daily_signups();
CREATE OR REPLACE FUNCTION get_daily_signups(p_campaign_id uuid DEFAULT NULL)
RETURNS TABLE(date text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_char(ts AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS date,
         count(*) AS count
  FROM (
    SELECT su.created_at AS ts
    FROM synced_users su
    WHERE p_campaign_id IS NULL AND su.created_at IS NOT NULL
    UNION ALL
    SELECT COALESCE(cp.joined_at, cp.created_at) AS ts
    FROM campaign_participants cp
    JOIN synced_users u ON u.id = cp.user_id
    WHERE p_campaign_id IS NOT NULL
      AND cp.campaign_id = p_campaign_id
      AND COALESCE(u.is_staff, false) = false
  ) s
  WHERE ts IS NOT NULL
  GROUP BY 1
  ORDER BY 1;
$$;

-- 3. Campaign-scoped daily predictions ---------------------------------------
DROP FUNCTION IF EXISTS get_daily_predictions();
CREATE OR REPLACE FUNCTION get_daily_predictions(p_campaign_id uuid DEFAULT NULL)
RETURNS TABLE(date text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_char(created_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS date,
         count(*) AS count
  FROM predictions
  WHERE created_at IS NOT NULL
    AND (p_campaign_id IS NULL OR campaign_id = p_campaign_id)
  GROUP BY 1
  ORDER BY 1;
$$;

-- 4. Lock execution to the service role (edge-function boundary) --------------
REVOKE ALL ON FUNCTION report_leagues(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION report_leagues(uuid) TO service_role;
REVOKE ALL ON FUNCTION get_daily_signups(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_daily_signups(uuid) TO service_role;
REVOKE ALL ON FUNCTION get_daily_predictions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_daily_predictions(uuid) TO service_role;

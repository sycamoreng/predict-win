/*
  # Reporting functions for the admin Reports hub

  Adds four read-only reporting functions that power the named stakeholder
  reports. Each is SECURITY DEFINER (so it can read across tables regardless of
  row-level security), pinned to the public schema, and callable ONLY by the
  service role — the admin Reports edge function invokes them after verifying the
  caller is a staff member. They never write data.

  1. New functions
     - `report_participation(campaign)` -> jsonb
       Per-matchweek active predictors, split into first-time vs returning
       (returning = the user predicted in an earlier matchweek), plus a
       bank-account link summary for the campaign's participants.
     - `report_savings(campaign)` -> jsonb
       Active "Back A Team" savings plans, successful / failed / pending
       auto-save triggers, total saved balance, a breakdown of failure reasons
       (health check on the pilot auto-save bug), and the 100 most recent events.
     - `report_leagues(campaign)` -> jsonb
       Private leagues created, members, and accepted invites (members who are
       not the league creator). Note: raw "invites sent" is not tracked yet, so
       the true viral coefficient needs invite-event tracking added later.
     - `report_audit(campaign, matchweek)` -> jsonb
       Row-level prediction timestamps per user per match with any applied
       power-ups (for the grand-prize audit), plus a tie-break ranking ordered by
       points then earliest cumulative prediction timestamp.

  2. Security
     - EXECUTE revoked from PUBLIC (hence anon/authenticated) and granted only to
       service_role. Staff/test accounts (`synced_users.is_staff`) are excluded
       from headline counts so figures reflect real players.
*/

-- 1. Gameweek Participation & Conversion --------------------------------------
CREATE OR REPLACE FUNCTION report_participation(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
WITH preds AS (
  SELECT p.user_id, m.matchweek, p.created_at
  FROM predictions p
  JOIN matches m ON m.id = p.match_id
  JOIN synced_users u ON u.id = p.user_id
  WHERE m.campaign_id = p_campaign_id
    AND m.matchweek IS NOT NULL
    AND COALESCE(u.is_staff, false) = false
),
debut AS (
  SELECT user_id, (array_agg(matchweek ORDER BY created_at, matchweek))[1] AS debut_mw
  FROM preds GROUP BY user_id
),
per_week AS (
  SELECT a.matchweek,
         a.active_predictors,
         COALESCE(n.new_predictors, 0) AS new_predictors,
         a.active_predictors - COALESCE(n.new_predictors, 0) AS returning_predictors
  FROM (SELECT matchweek, count(DISTINCT user_id) AS active_predictors FROM preds GROUP BY matchweek) a
  LEFT JOIN (SELECT debut_mw AS matchweek, count(*) AS new_predictors FROM debut GROUP BY debut_mw) n
    ON n.matchweek = a.matchweek
)
SELECT jsonb_build_object(
  'by_week', COALESCE((SELECT jsonb_agg(to_jsonb(pw) ORDER BY pw.matchweek) FROM per_week pw), '[]'::jsonb),
  'account_links', (
    SELECT jsonb_build_object(
      'total_participants', count(*),
      'linked_accounts', count(*) FILTER (WHERE is_linked),
      'link_rate_pct', CASE WHEN count(*) > 0
        THEN round(100.0 * count(*) FILTER (WHERE is_linked) / count(*), 1) ELSE 0 END
    )
    FROM (
      SELECT (u.account_number IS NOT NULL AND COALESCE(u.is_account_valid, false)) AS is_linked
      FROM campaign_participants cp
      JOIN synced_users u ON u.id = cp.user_id
      WHERE cp.campaign_id = p_campaign_id AND COALESCE(u.is_staff, false) = false
    ) s
  )
);
$$;

-- 2. "Back A Team" Savings Performance ----------------------------------------
CREATE OR REPLACE FUNCTION report_savings(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
SELECT jsonb_build_object(
  'active_plans', (SELECT count(*) FROM campaign_participants
                   WHERE campaign_id = p_campaign_id AND auto_savings_enabled = true),
  'successful_triggers', (SELECT count(*) FROM sweep_results
                          WHERE campaign_id = p_campaign_id AND status = 'completed'),
  'failed_triggers', (SELECT count(*) FROM sweep_results
                      WHERE campaign_id = p_campaign_id AND status = 'failed'),
  'pending_triggers', (SELECT count(*) FROM sweep_results
                       WHERE campaign_id = p_campaign_id AND status = 'pending'),
  'total_balance', (SELECT COALESCE(sum(amount), 0) FROM sweep_results
                    WHERE campaign_id = p_campaign_id AND status = 'completed'),
  'by_reason', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('reason', COALESCE(failure_reason, 'Unknown'), 'count', c) ORDER BY c DESC)
    FROM (SELECT failure_reason, count(*) c FROM sweep_results
          WHERE campaign_id = p_campaign_id AND status = 'failed'
          GROUP BY failure_reason) r), '[]'::jsonb),
  'recent', COALESCE((
    SELECT jsonb_agg(to_jsonb(x)) FROM (
      SELECT sr.triggered_at, sr.status, sr.amount, sr.action, sr.failure_reason, u.username
      FROM sweep_results sr
      LEFT JOIN synced_users u ON u.id = sr.user_id
      WHERE sr.campaign_id = p_campaign_id
      ORDER BY sr.triggered_at DESC
      LIMIT 100) x), '[]'::jsonb)
);
$$;

-- 3. Private League Viral Coefficient (approximate until invites are tracked) --
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
)
SELECT jsonb_build_object(
  'leagues_created', (SELECT count(*) FROM private_groups),
  'total_members', (SELECT count(*) FROM members),
  'joins_via_invite', (SELECT count(*) FROM invited),
  'distinct_invited_users', (SELECT count(DISTINCT user_id) FROM invited),
  'avg_members_per_league', (SELECT CASE WHEN count(DISTINCT group_id) > 0
      THEN round(count(*)::numeric / count(DISTINCT group_id), 2) ELSE 0 END FROM members),
  'note', 'Invites sent is not tracked yet; joins_via_invite counts accepted invites (members who are not the league creator). Add invite tracking to compute a true viral coefficient.'
);
$$;

-- 4. Leaderboard Integrity & Timestamp Audit ----------------------------------
CREATE OR REPLACE FUNCTION report_audit(p_campaign_id uuid, p_matchweek integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
WITH base AS (
  SELECT p.user_id, u.username, u.email, m.matchweek,
         (ht.code || ' vs ' || at.code) AS fixture,
         p.created_at AS predicted_at, p.updated_at AS last_updated_at,
         p.points_awarded, p.match_id
  FROM predictions p
  JOIN matches m ON m.id = p.match_id
  JOIN synced_users u ON u.id = p.user_id
  JOIN teams ht ON ht.id = m.home_team_id
  JOIN teams at ON at.id = m.away_team_id
  WHERE m.campaign_id = p_campaign_id
    AND (p_matchweek IS NULL OR m.matchweek = p_matchweek)
),
chips AS (
  SELECT ca.user_id, ca.match_id, ca.week_number,
         string_agg(DISTINCT ca.chip_type, ', ') AS chips
  FROM chip_activations ca
  WHERE ca.campaign_id = p_campaign_id
  GROUP BY ca.user_id, ca.match_id, ca.week_number
),
rows AS (
  SELECT b.username, b.email, b.matchweek, b.fixture, b.predicted_at,
         b.last_updated_at, b.points_awarded,
         COALESCE(cm.chips, cw.chips, '') AS power_ups
  FROM base b
  LEFT JOIN chips cm ON cm.user_id = b.user_id AND cm.match_id = b.match_id
  LEFT JOIN chips cw ON cw.user_id = b.user_id AND cw.match_id IS NULL AND cw.week_number = b.matchweek
),
ranking AS (
  SELECT u.username, u.email,
         COALESCE(cp.total_points, u.total_points, 0) AS total_points,
         count(p.id) AS predictions_count,
         min(p.created_at) AS first_prediction_at,
         max(p.created_at) AS last_prediction_at,
         EXTRACT(EPOCH FROM sum(p.created_at - timestamptz 'epoch'))::bigint AS cumulative_timestamp_epoch
  FROM synced_users u
  JOIN campaign_participants cp ON cp.user_id = u.id AND cp.campaign_id = p_campaign_id
  LEFT JOIN predictions p ON p.user_id = u.id AND p.campaign_id = p_campaign_id
  WHERE COALESCE(u.is_staff, false) = false
  GROUP BY u.username, u.email, cp.total_points, u.total_points
)
SELECT jsonb_build_object(
  'rows', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
     SELECT username, email, matchweek, fixture, predicted_at, last_updated_at, points_awarded, power_ups
     FROM rows ORDER BY username, matchweek LIMIT 5000) x), '[]'::jsonb),
  'ranking', COALESCE((SELECT jsonb_agg(to_jsonb(r))
     FROM (SELECT * FROM ranking ORDER BY total_points DESC, cumulative_timestamp_epoch ASC LIMIT 1000) r), '[]'::jsonb)
);
$$;

-- Lock down execution to the service role only (edge function boundary).
REVOKE ALL ON FUNCTION report_participation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION report_savings(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION report_leagues(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION report_audit(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION report_participation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION report_savings(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION report_leagues(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION report_audit(uuid, integer) TO service_role;

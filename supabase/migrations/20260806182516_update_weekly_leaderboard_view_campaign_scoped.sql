/*
  # Update weekly_leaderboard view — campaign-scoped

  ## Changes
  - The view now accepts the active campaign's week_start_date from the
    campaigns table (instead of campaign_config).
  - Matches are filtered by campaign_id matching the active campaign.
  - User stats (active_customer_flag, is_account_valid, is_staff) still
    come from synced_users.
  - backed_team_id now comes from campaign_participants.
  - Only shows data for the active campaign (is_active = true).

  ## Security
  - Re-grants SELECT to anon and authenticated.
*/

CREATE OR REPLACE VIEW weekly_leaderboard AS
WITH active_campaign AS (
  SELECT id AS campaign_id, week_start_date
  FROM campaigns
  WHERE is_active = true
  LIMIT 1
),
campaign_anchor AS (
  SELECT
    campaign_id,
    COALESCE(week_start_date, CURRENT_DATE) AS anchor
  FROM active_campaign
),
current_week AS (
  SELECT
    ca.campaign_id,
    (ca.anchor + (FLOOR(((now() AT TIME ZONE 'UTC')::date - ca.anchor) / 7.0)::int * 7) * interval '1 day')::timestamptz AS week_start,
    (ca.anchor + (FLOOR(((now() AT TIME ZONE 'UTC')::date - ca.anchor) / 7.0)::int * 7) * interval '1 day' + interval '7 days')::timestamptz AS week_end
  FROM campaign_anchor ca
),
week_matches AS (
  SELECT m.id
  FROM matches m
  JOIN current_week cw ON m.campaign_id = cw.campaign_id
  WHERE m.kickoff_at >= cw.week_start
    AND m.kickoff_at < cw.week_end
    AND m.status = 'completed'
),
week_predictions AS (
  SELECT
    p.user_id,
    SUM(COALESCE(p.points_awarded, 0)) AS week_points,
    COUNT(*) FILTER (WHERE p.points_awarded > 0) AS correct_predictions,
    COUNT(*) FILTER (
      WHERE p.predicted_home_score = m.home_score
        AND p.predicted_away_score = m.away_score
    ) AS exact_scorelines,
    COUNT(*) AS matches_predicted
  FROM predictions p
  JOIN week_matches wm ON wm.id = p.match_id
  JOIN matches m ON m.id = p.match_id
  GROUP BY p.user_id
)
SELECT
  u.id AS user_id,
  u.name,
  u.username,
  u.email,
  u.is_staff,
  u.active_customer_flag,
  u.is_account_valid,
  cp.backed_team_id,
  wp.week_points,
  wp.correct_predictions,
  wp.exact_scorelines,
  wp.matches_predicted,
  RANK() OVER (
    PARTITION BY u.is_staff
    ORDER BY wp.week_points DESC,
             wp.exact_scorelines DESC,
             wp.correct_predictions DESC,
             wp.matches_predicted DESC,
             u.name ASC
  ) AS rank
FROM week_predictions wp
JOIN synced_users u ON u.id = wp.user_id
LEFT JOIN campaign_participants cp ON cp.user_id = u.id
  AND cp.campaign_id = (SELECT campaign_id FROM active_campaign)
WHERE u.active_customer_flag = true
  AND u.is_account_valid = true
  AND wp.week_points > 0;

GRANT SELECT ON weekly_leaderboard TO authenticated;
GRANT SELECT ON weekly_leaderboard TO anon;

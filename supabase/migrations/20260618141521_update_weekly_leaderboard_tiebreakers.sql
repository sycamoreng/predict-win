-- Update weekly leaderboard view to add matches_predicted as a tiebreaker
-- Order: points > exact scorelines > correct predictions > matches predicted (more is better) > name
CREATE OR REPLACE VIEW weekly_leaderboard AS
WITH current_week AS (
  SELECT
    date_trunc('week', now() AT TIME ZONE 'UTC') - interval '1 day' AS week_start,
    date_trunc('week', now() AT TIME ZONE 'UTC') - interval '1 day' + interval '7 days' AS week_end
),
week_matches AS (
  SELECT m.id
  FROM matches m, current_week cw
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
  u.backed_team_id,
  wp.week_points,
  wp.correct_predictions,
  wp.exact_scorelines,
  wp.matches_predicted,
  RANK() OVER (
    ORDER BY wp.week_points DESC,
             wp.exact_scorelines DESC,
             wp.correct_predictions DESC,
             wp.matches_predicted DESC,
             u.name ASC
  ) AS rank
FROM week_predictions wp
JOIN synced_users u ON u.id = wp.user_id
WHERE u.active_customer_flag = true
  AND u.is_account_valid = true
  AND wp.week_points > 0;

GRANT SELECT ON weekly_leaderboard TO authenticated;
GRANT SELECT ON weekly_leaderboard TO anon;

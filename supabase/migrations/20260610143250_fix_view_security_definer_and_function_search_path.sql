-- Fix 1: Recreate weekly_leaderboard view with SECURITY INVOKER
CREATE OR REPLACE VIEW weekly_leaderboard
WITH (security_invoker = true) AS
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
             u.name ASC
  ) AS rank
FROM week_predictions wp
JOIN synced_users u ON u.id = wp.user_id
WHERE u.active_customer_flag = true
  AND u.is_account_valid = true
  AND wp.week_points > 0;

-- Fix 2: Recreate get_week_bounds with immutable search_path
CREATE OR REPLACE FUNCTION get_week_bounds(ref_date timestamptz DEFAULT now())
RETURNS TABLE(week_start timestamptz, week_end timestamptz, week_number int)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  ws timestamptz;
  we timestamptz;
  wn int;
BEGIN
  ws := date_trunc('week', ref_date AT TIME ZONE 'UTC') - interval '1 day';
  we := ws + interval '7 days';
  SELECT COALESCE(
    FLOOR(EXTRACT(EPOCH FROM (ws - (date_trunc('week', MIN(m.kickoff_at) AT TIME ZONE 'UTC') - interval '1 day'))) / (7*86400))::int + 1,
    1
  ) INTO wn FROM matches m;
  RETURN QUERY SELECT ws, we, wn;
END;
$$;
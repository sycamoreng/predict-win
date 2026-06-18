-- Add week_start_date to campaign_config so admins control when weeks begin
ALTER TABLE campaign_config
  ADD COLUMN IF NOT EXISTS week_start_date date NOT NULL DEFAULT '2026-06-11';

-- Update existing row to tournament start date
UPDATE campaign_config SET week_start_date = '2026-06-11' WHERE id = 1;

-- Rewrite get_week_bounds to use configurable week start
CREATE OR REPLACE FUNCTION get_week_bounds(ref_date timestamptz DEFAULT now())
RETURNS TABLE(week_start timestamptz, week_end timestamptz, week_number int) AS $$
DECLARE
  ws timestamptz;
  we timestamptz;
  wn int;
  anchor date;
  ref_utc date;
  days_since int;
BEGIN
  -- Get the admin-configured week start date
  SELECT c.week_start_date INTO anchor FROM campaign_config c WHERE c.id = 1;
  IF anchor IS NULL THEN
    anchor := '2026-06-11';
  END IF;

  ref_utc := (ref_date AT TIME ZONE 'UTC')::date;
  
  -- Calculate days since the anchor
  days_since := ref_utc - anchor;
  
  -- If before anchor, clamp to anchor
  IF days_since < 0 THEN
    days_since := 0;
  END IF;
  
  -- Week start = anchor + (floor(days_since / 7) * 7)
  ws := (anchor + (FLOOR(days_since / 7.0)::int * 7) * interval '1 day')::timestamptz;
  we := ws + interval '7 days';
  wn := FLOOR(days_since / 7.0)::int + 1;
  
  RETURN QUERY SELECT ws, we, wn;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_week_bounds TO authenticated;
GRANT EXECUTE ON FUNCTION get_week_bounds TO anon;

-- Recreate weekly_leaderboard view to use configurable week bounds
CREATE OR REPLACE VIEW weekly_leaderboard AS
WITH current_week AS (
  SELECT * FROM get_week_bounds(now())
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

GRANT SELECT ON weekly_leaderboard TO authenticated;
GRANT SELECT ON weekly_leaderboard TO anon;

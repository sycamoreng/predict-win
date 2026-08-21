/*
# Switch weekly standings from calendar weeks to matchweeks

## Why
The active Premier League campaign is organised into official matchweeks
(gameweeks), which do not line up with fixed 7-day calendar windows: some
gameweeks are three weeks apart, others fall just a few days apart. Bucketing
the weekly standings into rigid calendar weeks either split one gameweek across
two standings or lumped two gameweeks together. This change makes "this week's"
standings track the current gameweek exactly.

## Changes
1. `weekly_leaderboard` view (CREATE OR REPLACE, same columns)
   - Instead of matches inside a 7-day window, it now aggregates the completed
     matches of the CURRENT matchweek of the active campaign.
   - Current matchweek = the matchweek of the most recent fixture that has
     already kicked off; before any fixture kicks off it falls back to the
     lowest matchweek number. This keeps the just-finished gameweek visible
     during gaps between gameweeks.
   - Output columns, ranking and eligibility filters are unchanged, so the
     leaderboard page continues to work without other query changes.

2. `get_week_bounds()` function (CREATE OR REPLACE, same signature/columns)
   - Now returns the current matchweek number as `week_number`, and the first
     and last kickoff times of that matchweek as `week_start` / `week_end`
     (used only for the on-screen label). Scoped to the active campaign.

## Security
- No security changes. SELECT on the view stays granted to anon + authenticated
  (the leaderboard is visible to signed-out visitors). The function remains
  SECURITY DEFINER with a fixed search_path.
*/

CREATE OR REPLACE VIEW weekly_leaderboard AS
WITH active_campaign AS (
  SELECT id AS campaign_id
  FROM campaigns
  WHERE is_active = true
  LIMIT 1
),
current_mw AS (
  SELECT COALESCE(
    (SELECT m.matchweek
       FROM matches m
       JOIN active_campaign ac ON ac.campaign_id = m.campaign_id
      WHERE m.matchweek IS NOT NULL
        AND m.kickoff_at <= now()
      ORDER BY m.kickoff_at DESC
      LIMIT 1),
    (SELECT MIN(m.matchweek)
       FROM matches m
       JOIN active_campaign ac ON ac.campaign_id = m.campaign_id
      WHERE m.matchweek IS NOT NULL)
  ) AS matchweek
),
week_matches AS (
  SELECT m.id
  FROM matches m
  JOIN active_campaign ac ON ac.campaign_id = m.campaign_id
  JOIN current_mw cm ON m.matchweek = cm.matchweek
  WHERE m.status = 'completed'
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

CREATE OR REPLACE FUNCTION public.get_week_bounds(ref_date timestamptz DEFAULT now())
RETURNS TABLE(week_start timestamptz, week_end timestamptz, week_number integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cid uuid;
  cur_mw int;
  ws timestamptz;
  we timestamptz;
BEGIN
  SELECT id INTO cid FROM campaigns WHERE is_active = true LIMIT 1;
  IF cid IS NULL THEN
    RETURN QUERY SELECT ref_date, ref_date, 1;
    RETURN;
  END IF;

  SELECT COALESCE(
    (SELECT m.matchweek
       FROM matches m
      WHERE m.campaign_id = cid
        AND m.matchweek IS NOT NULL
        AND m.kickoff_at <= ref_date
      ORDER BY m.kickoff_at DESC
      LIMIT 1),
    (SELECT MIN(m.matchweek)
       FROM matches m
      WHERE m.campaign_id = cid
        AND m.matchweek IS NOT NULL)
  ) INTO cur_mw;

  IF cur_mw IS NULL THEN
    RETURN QUERY SELECT ref_date, ref_date, 1;
    RETURN;
  END IF;

  SELECT MIN(m.kickoff_at), MAX(m.kickoff_at)
    INTO ws, we
  FROM matches m
  WHERE m.campaign_id = cid
    AND m.matchweek = cur_mw;

  RETURN QUERY SELECT ws, we, cur_mw;
END;
$function$;
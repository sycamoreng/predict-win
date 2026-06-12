CREATE OR REPLACE FUNCTION get_daily_signups()
RETURNS TABLE(date text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(created_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS date,
    count(*) AS count
  FROM synced_users
  WHERE created_at IS NOT NULL
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION get_daily_predictions()
RETURNS TABLE(date text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(created_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS date,
    count(*) AS count
  FROM predictions
  WHERE created_at IS NOT NULL
  GROUP BY 1
  ORDER BY 1;
$$;

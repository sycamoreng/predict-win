-- Function to get week bounds for any date (defaults to now). Week runs Sun-Sat.
CREATE OR REPLACE FUNCTION get_week_bounds(ref_date timestamptz DEFAULT now())
RETURNS TABLE(week_start timestamptz, week_end timestamptz, week_number int) AS $$
DECLARE
  ws timestamptz;
  we timestamptz;
  wn int;
BEGIN
  -- Shift to Sunday start: date_trunc('week') gives Monday, subtract 1 day
  ws := date_trunc('week', ref_date AT TIME ZONE 'UTC') - interval '1 day';
  we := ws + interval '7 days';
  -- Week number within the tournament (weeks since earliest match)
  SELECT COALESCE(
    FLOOR(EXTRACT(EPOCH FROM (ws - (date_trunc('week', MIN(m.kickoff_at) AT TIME ZONE 'UTC') - interval '1 day'))) / (7*86400))::int + 1,
    1
  ) INTO wn FROM matches m;
  RETURN QUERY SELECT ws, we, wn;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_week_bounds TO authenticated;
GRANT EXECUTE ON FUNCTION get_week_bounds TO anon;
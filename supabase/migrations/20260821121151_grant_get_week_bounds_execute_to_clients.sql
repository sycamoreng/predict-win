
-- get_week_bounds only reads public campaign/match data and is called from the
-- browser by the leaderboard page. A prior SECURITY DEFINER hardening pass revoked
-- EXECUTE from the app roles, which silently broke the weekly week-range label.
-- Restore EXECUTE for the anon-key clients; the function exposes nothing sensitive.
GRANT EXECUTE ON FUNCTION public.get_week_bounds(timestamptz) TO anon, authenticated;

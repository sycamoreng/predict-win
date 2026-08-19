-- These aggregate-count functions are SECURITY DEFINER and are now only called by
-- the `reports` edge function (service role) behind an admin check. Remove public
-- access so they can no longer be run with the public anon key.

REVOKE EXECUTE ON FUNCTION public.get_daily_signups() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_daily_predictions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_exact_scorelines_count(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_daily_signups() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_predictions() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_exact_scorelines_count(uuid, timestamptz, timestamptz) TO service_role;

-- The weekly_leaderboard view was running with owner rights (SECURITY DEFINER),
-- which bypasses row-level security. The tables it reads (synced_users,
-- predictions, matches, campaigns, campaign_participants) all grant public
-- SELECT for the leaderboard, so running it as the caller is safe and correct.
ALTER VIEW public.weekly_leaderboard SET (security_invoker = true);

-- These are trigger / internal helper functions. They must not be callable
-- directly through the public REST API. Triggers still fire normally after
-- this, because trigger execution does not depend on EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.notify_group_membership_email() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_week_bounds(timestamp with time zone) FROM anon, authenticated, public;

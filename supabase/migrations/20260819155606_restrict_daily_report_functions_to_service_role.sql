/*
# Lock the campaign-scoped daily report functions to service_role only

1. Purpose
When `get_daily_signups` and `get_daily_predictions` were recreated with a
campaign parameter, Postgres/Supabase default privileges re-granted EXECUTE to
the `anon` and `authenticated` roles. These functions are SECURITY DEFINER and
are only meant to be invoked by the admin reports edge function (service role),
so this migration revokes public/anon/authenticated access and re-grants EXECUTE
to service_role only.

2. Security
- Revokes EXECUTE from PUBLIC, anon, and authenticated on both functions.
- Grants EXECUTE to service_role only.

3. Notes
1. No behaviour change for the reports dashboard, which calls these through the
   service-role edge function.
*/

REVOKE ALL ON FUNCTION get_daily_signups(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_daily_predictions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_daily_signups(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_daily_predictions(uuid) TO service_role;

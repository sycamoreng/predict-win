-- These reporting functions are SECURITY DEFINER and are only ever called by the
-- `reports` edge function using the service role. They expose sensitive aggregates
-- (savings balances, participation, league standings, audit data), so remove public
-- access and keep them callable only by the service role.

REVOKE EXECUTE ON FUNCTION public.report_savings(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_participation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_leagues(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_audit(uuid, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.report_savings(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_participation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_leagues(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_audit(uuid, integer) TO service_role;

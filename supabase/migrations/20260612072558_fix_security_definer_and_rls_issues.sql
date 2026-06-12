
-- 1. Fix weekly_leaderboard view: set security_invoker = true
ALTER VIEW public.weekly_leaderboard SET (security_invoker = on);

-- 2. Drop overly permissive anon policies on notifications
DROP POLICY IF EXISTS "update_notifications_anon" ON public.notifications;
DROP POLICY IF EXISTS "select_notifications_anon" ON public.notifications;

-- 3. Revoke EXECUTE on admin-only SECURITY DEFINER functions from public roles
REVOKE EXECUTE ON FUNCTION public.get_daily_predictions() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_daily_signups() FROM anon, authenticated;

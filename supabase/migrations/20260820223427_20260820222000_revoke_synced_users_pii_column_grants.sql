-- Private/PII and business columns of synced_users were world-readable via the
-- anon key (column SELECT grants + a USING(true) policy). Members now read their
-- own row through the profile-me edge function, and the admin console reads
-- through the admin-users edge function (both service-role). Revoke public
-- SELECT on the sensitive columns; keep the leaderboard/public columns granted
-- so the security_invoker weekly_leaderboard view and leaderboard pages still work.

REVOKE SELECT (
  email,
  phone_number,
  account_number,
  bank_name,
  social_handles,
  core_user_id,
  core_signup_at,
  signup_source,
  signup_platform,
  qualifying_transactions_count,
  auto_savings_enabled,
  auto_savings_amount,
  auto_savings_duration,
  auto_savings_consented_at
) ON public.synced_users FROM anon, authenticated;

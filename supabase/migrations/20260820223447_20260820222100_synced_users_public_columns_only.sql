-- The previous column-level REVOKE was a no-op because anon/authenticated hold a
-- TABLE-WIDE SELECT grant on synced_users, which covers every column regardless of
-- column-level revokes. Remove the blanket grant, then re-grant SELECT only on the
-- public/leaderboard columns. Private columns (email, phone_number, account_number,
-- bank_name, social_handles, savings, signup source, core ids, qualifying tx count)
-- are then unreadable via the anon key; members read their own row through the
-- profile-me edge function and admins through admin-users (both service-role).

REVOKE SELECT ON public.synced_users FROM anon, authenticated;

GRANT SELECT (
  id,
  name,
  username,
  is_staff,
  active_customer_flag,
  is_account_valid,
  backed_team_id,
  backed_team_wins,
  backed_team_locked_at,
  correct_predictions_count,
  exact_scorelines_count,
  total_points,
  created_at,
  updated_at,
  is_guest,
  username_set_by_user
) ON public.synced_users TO anon, authenticated;

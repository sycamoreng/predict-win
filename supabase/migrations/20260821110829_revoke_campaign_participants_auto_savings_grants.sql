-- campaign_participants has a "USING (true)" SELECT policy so every participant row
-- is world-readable via the anon key. Its auto_savings_* columns mirror the private
-- financial columns that were revoked on synced_users, so they were still leaking:
-- any visitor could read every user's auto-savings amount, duration, enabled flag and
-- consent timestamp. A table-wide SELECT grant makes column-level revokes a no-op, so
-- (as with synced_users) drop the blanket grant and re-grant SELECT only on the
-- public leaderboard/gameplay columns. Members read their own auto-savings settings
-- through the service-role profile-me / payouts edge functions.

REVOKE SELECT ON public.campaign_participants FROM anon, authenticated;

GRANT SELECT (
  id,
  user_id,
  campaign_id,
  backed_team_id,
  backed_team_locked_at,
  backed_team_wins,
  correct_predictions_count,
  exact_scorelines_count,
  total_points,
  joined_at,
  created_at,
  updated_at
) ON public.campaign_participants TO anon, authenticated;

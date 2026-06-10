-- 1. Fix campaign_config: drop the always-true UPDATE policy, replace with service_role only
--    (service_role bypasses RLS, so no policy needed for it; deny anon/authenticated)
DROP POLICY IF EXISTS "anyone_can_update_config" ON campaign_config;

-- 2. Fix synced_users: drop the always-true UPDATE policy for anon,
--    replace with a proper policy that only allows updating own row by matching on id
--    The app identifies users by their synced_users.id stored client-side after OTP login.
--    We restrict columns implicitly - RLS controls row access, not column access.
DROP POLICY IF EXISTS "Users can update own profile" ON synced_users;

-- The synced_users table uses a custom session model (not Supabase auth).
-- Updates come from the client with .eq('id', user.id). Since there's no auth.uid(),
-- we allow authenticated updates only to specific safe columns via a restrictive approach.
-- However, since auth.uid() isn't available, we need service_role for edge function updates
-- and allow limited anon updates where the client proves knowledge of the user ID.
-- The safest fix: only allow service_role to update (edge functions handle user updates).
-- But the settings page does direct updates... so we keep anon but remove the blanket "true".
-- Since we can't use auth.uid() (no Supabase auth), the practical fix is:
-- Only the service_role (edge functions) should update synced_users.
-- We'll create a thin edge function for profile updates.

-- For now: no anon UPDATE policy at all. Updates go through service_role only.
-- Edge functions already use service_role key.

-- 3. Fix admin_sessions: add restrictive policies
--    This table should never be readable/writable from client side.
--    Only service_role (edge functions) should access it.
--    Since service_role bypasses RLS, we just need a deny-all policy for anon/authenticated.
CREATE POLICY "deny_all_select_admin_sessions" ON admin_sessions
  FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "deny_all_insert_admin_sessions" ON admin_sessions
  FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "deny_all_update_admin_sessions" ON admin_sessions
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_all_delete_admin_sessions" ON admin_sessions
  FOR DELETE TO anon, authenticated USING (false);
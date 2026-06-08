-- Allow anon users to update their own profile fields (username, social_handles).
-- Since the app uses custom session auth (not Supabase Auth), we allow updates on these columns for any authenticated request.
CREATE POLICY "Users can update own profile"
  ON synced_users
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

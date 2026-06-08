CREATE POLICY "anyone_can_update_config" ON campaign_config
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);
-- Stores SendGrid dynamic template IDs mapped to event names.
-- Admins manage template IDs via DB rows, not secrets.
CREATE TABLE IF NOT EXISTS email_templates (
  event_name TEXT PRIMARY KEY,
  sendgrid_template_id TEXT,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write (edge functions use service_role key)
CREATE POLICY "service_role_all" ON email_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed all known event types
INSERT INTO email_templates (event_name, description) VALUES
  ('otp_login', 'OTP code for user login'),
  ('otp_admin_login', 'OTP code for admin login'),
  ('prediction_submitted', 'Confirmation after user submits a prediction'),
  ('prediction_correct', 'Notification that user scored points'),
  ('prediction_incorrect', 'Notification that user scored 0 points'),
  ('team_won', 'Notification that user''s backed team won a match'),
  ('auto_savings_enabled', 'Confirmation of auto-savings opt-in'),
  ('auto_savings_disabled', 'Confirmation of auto-savings opt-out'),
  ('team_win_sweep_completed', 'Savings successfully credited after team win'),
  ('team_win_sweep_skipped', 'Sweep could not be processed'),
  ('team_eliminated', 'User''s backed team eliminated from tournament'),
  ('team_reinstated', 'User''s backed team reinstated in tournament'),
  ('welcome', 'Welcome email when user first joins predictor league'),
  ('matchday_reminder', 'Reminder of upcoming matches to predict'),
  ('weekly_leaderboard', 'Weekly summary of leaderboard standings'),
  ('payout_notification', 'User receives a payout')
ON CONFLICT (event_name) DO NOTHING;

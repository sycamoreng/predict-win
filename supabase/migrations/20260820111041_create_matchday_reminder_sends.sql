/*
# Track matchday reminder sends (once-per-matchweek guard)

1. New Tables
   - `matchday_reminder_sends`
     - `id` (uuid, primary key)
     - `user_id` (uuid) — the player who was emailed
     - `campaign_id` (uuid) — the campaign the matchweek belongs to
     - `matchweek` (int) — the matchweek the reminder covered
     - `sent_at` (timestamptz) — when the reminder was recorded
   - Unique constraint on (user_id, campaign_id, matchweek) so a player is
     recorded at most once per matchweek per campaign.

2. Purpose
   - The matchday reminder now emails the whole matchweek. This table lets the
     reminder job skip anyone already reminded for the current matchweek, so
     each player receives the matchweek reminder at most once.

3. Security
   - Enable RLS.
   - No anon/authenticated policies are added: this table is written and read
     only by the reminder edge function (service role), which bypasses RLS.
     Deny-by-default keeps it inaccessible to the public API.
*/

CREATE TABLE IF NOT EXISTS matchday_reminder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  matchweek integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign_id, matchweek)
);

CREATE INDEX IF NOT EXISTS idx_matchday_reminder_sends_campaign_week
  ON matchday_reminder_sends (campaign_id, matchweek);

ALTER TABLE matchday_reminder_sends ENABLE ROW LEVEL SECURITY;

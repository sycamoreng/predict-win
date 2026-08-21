/*
# Track per-matchday results digest sends (once-per-day guard)

1. New Tables
   - `matchday_result_sends`
     - `id` (uuid, primary key)
     - `user_id` (uuid) — the player who received the results recap
     - `campaign_id` (uuid) — the campaign the matchday belongs to
     - `result_date` (date) — the calendar day (Africa/Lagos) the recap covered
     - `sent_at` (timestamptz) — when the recap was recorded
   - Unique constraint on (user_id, campaign_id, result_date) so a player gets
     the "how you did today" recap at most once per day per campaign.

2. Purpose
   - The new per-matchday results digest emails each player one recap after all
     of a day's matches are settled. This table lets the digest job skip anyone
     already emailed for that day, so nobody is recapped twice.

3. Security
   - Enable RLS.
   - No anon/authenticated policies are added: this table is written and read
     only by the results-digest edge function (service role), which bypasses RLS.
     Deny-by-default keeps it inaccessible to the public API.
*/

CREATE TABLE IF NOT EXISTS matchday_result_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  result_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign_id, result_date)
);

CREATE INDEX IF NOT EXISTS idx_matchday_result_sends_campaign_date
  ON matchday_result_sends (campaign_id, result_date);

ALTER TABLE matchday_result_sends ENABLE ROW LEVEL SECURITY;

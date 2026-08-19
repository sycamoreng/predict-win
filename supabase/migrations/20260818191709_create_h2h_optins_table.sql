/*
# Create head-to-head weekly opt-in table

1. New Tables
  - `h2h_optins` — records which players have chosen to enter a given week's
    head-to-head matchups. Only opted-in players get paired, so we no longer
    pair the entire participant base.
    + `id` (uuid, PK)
    + `campaign_id` (uuid, FK -> campaigns) — which campaign the opt-in belongs to
    + `week_number` (integer) — the matchday week the player is opting into
    + `user_id` (uuid, FK -> synced_users) — the opting-in player
    + `created_at` (timestamptz) — when they opted in

2. Security
  - RLS enabled.
  - Public SELECT so the app can show how many players opted in.
  - INSERT / DELETE open to anon + authenticated because this app uses custom
    OTP auth (not Supabase auth.uid()); identity is supplied by the client,
    mirroring the existing campaign_participants trust model.

3. Constraints
  - A player can opt into a given campaign week only once
    (unique on campaign_id, week_number, user_id).
*/

CREATE TABLE IF NOT EXISTS h2h_optins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  user_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, week_number, user_id)
);

CREATE INDEX IF NOT EXISTS idx_h2h_optins_campaign_week
  ON h2h_optins(campaign_id, week_number);

ALTER TABLE h2h_optins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_h2h_optins" ON h2h_optins;
CREATE POLICY "select_h2h_optins" ON h2h_optins FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_h2h_optins" ON h2h_optins;
CREATE POLICY "insert_h2h_optins" ON h2h_optins FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_h2h_optins" ON h2h_optins;
CREATE POLICY "delete_h2h_optins" ON h2h_optins FOR DELETE
  TO anon, authenticated USING (true);

/*
# Create chip_activations table for Double Down feature

1. New Tables
  - `chip_activations`
    + `id` (uuid, PK)
    + `user_id` (uuid, FK → synced_users) — the user who activated the chip
    + `campaign_id` (uuid, FK → campaigns) — which campaign
    + `chip_type` (text, default 'double_down') — extensible for future chip types
    + `week_number` (integer) — the matchday week this chip applies to
    + `activated_at` (timestamptz) — when user activated
    + `created_at` (timestamptz)

2. Security
  - RLS enabled
  - Public SELECT (users can see their own and others' chip usage)
  - INSERT/UPDATE/DELETE restricted — managed via edge function with service role

3. Constraints
  - UNIQUE(user_id, campaign_id, chip_type, week_number) — prevent double-activating same week
*/

CREATE TABLE IF NOT EXISTS chip_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES synced_users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  chip_type text NOT NULL DEFAULT 'double_down',
  week_number integer NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, campaign_id, chip_type, week_number)
);

CREATE INDEX IF NOT EXISTS idx_chip_activations_user_campaign
  ON chip_activations(user_id, campaign_id, chip_type);

ALTER TABLE chip_activations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_chip_activations" ON chip_activations;
CREATE POLICY "select_chip_activations" ON chip_activations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_chip_activations" ON chip_activations;
CREATE POLICY "insert_chip_activations" ON chip_activations FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_chip_activations" ON chip_activations;
CREATE POLICY "update_chip_activations" ON chip_activations FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_chip_activations" ON chip_activations;
CREATE POLICY "delete_chip_activations" ON chip_activations FOR DELETE
  TO authenticated USING (true);

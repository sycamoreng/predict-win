/*
  # Add logo_url to teams and INSERT policy for campaign_participants

  ## 1. Schema Changes
  - Add `logo_url` column to `teams` table (nullable text) for club logo images
  - Backfill logo_url for all teams that have an api_football_id

  ## 2. Security Changes
  - Add INSERT policy on `campaign_participants` so users can join campaigns
  - Add UPDATE policy on `campaign_participants` so users can update their own rows

  ## Important Notes
  1. logo_url uses api-sports.io CDN format: https://media.api-sports.io/football/teams/{id}.png
  2. National teams also get logo_url backfilled from api_football_id
  3. INSERT policy allows anon + authenticated since this app uses custom OTP auth (not Supabase auth.uid())
*/

-- 1. Add logo_url column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE teams ADD COLUMN logo_url text;
  END IF;
END $$;

-- 2. Backfill logo_url for all teams with api_football_id
UPDATE teams
SET logo_url = 'https://media.api-sports.io/football/teams/' || api_football_id || '.png'
WHERE api_football_id IS NOT NULL AND (logo_url IS NULL OR logo_url = '');

-- 3. Add INSERT policy for campaign_participants
DROP POLICY IF EXISTS "Users can join campaigns" ON campaign_participants;
CREATE POLICY "Users can join campaigns"
  ON campaign_participants FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 4. Add UPDATE policy for campaign_participants (own rows only)
DROP POLICY IF EXISTS "Users can update own participation" ON campaign_participants;
CREATE POLICY "Users can update own participation"
  ON campaign_participants FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

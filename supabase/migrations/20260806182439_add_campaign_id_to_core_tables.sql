/*
  # Add campaign_id to matches, predictions, notifications, sweep_results, analytics_events

  ## Changes
  Adds a `campaign_id` column (uuid, FK -> campaigns) to each core table.
  All existing rows are backfilled to point to the World Cup 2026 campaign.

  ## Indexes
  - idx_matches_campaign on matches(campaign_id)
  - idx_predictions_campaign on predictions(campaign_id)
  - idx_notifications_campaign on notifications(campaign_id)

  ## Notes
  - Columns are added as nullable first, then backfilled, then set NOT NULL
    on the tables where it is required (matches, predictions).
  - notifications, sweep_results, and analytics_events keep campaign_id nullable
    since some historical rows may pre-date the campaign concept.
*/

-- Step 1: Add columns (nullable to allow backfill)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE matches ADD COLUMN campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'predictions' AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE predictions ADD COLUMN campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sweep_results' AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE sweep_results ADD COLUMN campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 2: Backfill all existing rows to the World Cup campaign
UPDATE matches SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'world-cup-2026')
WHERE campaign_id IS NULL;

UPDATE predictions SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'world-cup-2026')
WHERE campaign_id IS NULL;

UPDATE notifications SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'world-cup-2026')
WHERE campaign_id IS NULL;

UPDATE sweep_results SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'world-cup-2026')
WHERE campaign_id IS NULL;

UPDATE analytics_events SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'world-cup-2026')
WHERE campaign_id IS NULL;

-- Step 3: Make campaign_id NOT NULL on matches and predictions
ALTER TABLE matches ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE predictions ALTER COLUMN campaign_id SET NOT NULL;

-- Step 4: Indexes
CREATE INDEX IF NOT EXISTS idx_matches_campaign ON matches(campaign_id);
CREATE INDEX IF NOT EXISTS idx_predictions_campaign ON predictions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notifications_campaign ON notifications(campaign_id);

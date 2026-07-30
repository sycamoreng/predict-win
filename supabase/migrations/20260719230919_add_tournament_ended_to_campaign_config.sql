/*
# Add tournament_ended flag to campaign_config

1. Modified Tables
   - `campaign_config`
     - `tournament_ended` (boolean, default false) - Flag indicating the tournament is over, triggers celebration UI

2. Important Notes
   - This column drives the confetti/celebration mode on the leaderboard page.
   - Default is false; admins set it to true when the final match concludes.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'campaign_config'
      AND column_name = 'tournament_ended'
  ) THEN
    ALTER TABLE campaign_config ADD COLUMN tournament_ended boolean NOT NULL DEFAULT false;
  END IF;
END $$;

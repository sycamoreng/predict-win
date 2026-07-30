/*
# Add finish_type column to matches

1. Modified Tables
  - `matches`
    - Added `finish_type` (text, nullable) - stores 'FT', 'AET', or 'PEN' indicating how the match was decided.
      NULL for matches not yet completed. Used by the scoring engine to compare against
      user predictions and award bonus points for correctly predicting AET/PEN outcomes.

2. Important Notes
  - FT = match decided in regular time (90 minutes)
  - AET = match decided in extra time (120 minutes)
  - PEN = match decided by penalty shootout
  - Group stage matches will always be FT.
  - The sync-results function will populate this from the API fixture status.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'finish_type'
  ) THEN
    ALTER TABLE matches ADD COLUMN finish_type text;
  END IF;
END $$;
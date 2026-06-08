/*
  # Add api-football identifiers

  1. Changes
    - Adds `api_football_id` column to `teams` (integer, nullable, unique). Lets us
      reliably link rows we receive from api-sports.io without depending on team-name
      string matching.
    - Adds `api_football_id` column to `matches` (integer, nullable, unique). Stores
      the api-sports.io fixture id so we can resync the same fixture without
      duplicates.

  2. Notes
    - Both columns are nullable so existing rows remain valid.
    - Unique constraints prevent the import from accidentally creating duplicate
      records when re-run.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'api_football_id'
  ) THEN
    ALTER TABLE teams ADD COLUMN api_football_id integer UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'api_football_id'
  ) THEN
    ALTER TABLE matches ADD COLUMN api_football_id integer UNIQUE;
  END IF;
END $$;

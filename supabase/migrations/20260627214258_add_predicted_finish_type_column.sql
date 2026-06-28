/*
# Add predicted_finish_type column to predictions

1. Modified Tables
  - `predictions`
    - `predicted_finish_type` (text, nullable) — stores 'FT', 'AET', or 'PEN' for knockout matches.
      NULL for group-stage predictions (backwards compatible).

2. Notes
  - This column enables the knockout prediction widget to store how the user predicts
    the match will end (full time, after extra time, or penalties).
  - Group stage predictions will continue to have this as NULL.
  - The scoring engine uses this to award different point values for correct knockout scorelines.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'predictions'
      AND column_name = 'predicted_finish_type'
  ) THEN
    ALTER TABLE predictions ADD COLUMN predicted_finish_type text;
  END IF;
END $$;

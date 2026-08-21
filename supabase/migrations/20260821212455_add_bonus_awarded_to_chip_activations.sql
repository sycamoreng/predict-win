/*
# Add bonus_awarded column to chip_activations

1. Purpose
  - Stores a flat bonus point value earned by activating a chip whose reward is a
    lump-sum bonus rather than a per-match multiplier. Currently used by the
    "Perfect Week" chip, which awards a fixed bonus when every match in the
    matchweek is predicted correctly.

2. Modified Tables
  - `chip_activations`
    + `bonus_awarded` (integer, not null, default 0) — the bonus points granted
      by this chip activation. 0 means no bonus (either the chip is not a
      bonus-type chip, or its condition was not met).

3. Security
  - No policy changes. Existing RLS policies continue to apply. This column is
    written only by the scoring routine running with the service role.

4. Notes
  1. The value is recomputed idempotently by the scoring routine, so re-scoring
     a matchweek safely overwrites any previous value.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chip_activations' AND column_name = 'bonus_awarded'
  ) THEN
    ALTER TABLE chip_activations ADD COLUMN bonus_awarded integer NOT NULL DEFAULT 0;
  END IF;
END $$;
/*
# Add new chip types: First Blood, Streak Shield, Last Stand, Perfect Week

1. Modified Tables
  - `campaigns`
    + `max_first_blood_uses` (integer, default 3) — how many First Blood chips per user per campaign
    + `max_streak_shield_uses` (integer, default 1) — how many Streak Shield chips per user per campaign
    + `max_last_stand_uses` (integer, default 1) — how many Last Stand chips per user per campaign
    + `max_perfect_week_uses` (integer, default 1) — how many Perfect Week chips per user per campaign
    + `total_matchweeks` (integer, default 38) — total matchweeks in the campaign (for Last Stand restriction)

2. Notes
  - First Blood: apply to matchweek 1's first match. If your first prediction of the matchweek is correct, 1.5x bonus carries to all other matches in that week
  - Streak Shield: protects your current streak from being broken for one matchweek
  - Last Stand: 4x points, usable only in the final 5 matchweeks, once per campaign
  - Perfect Week: passive bonus (+50 points) if you predict every match in a matchweek correctly while this chip is active
  - All chips use the existing chip_activations table with different chip_type values
  - Constraint: only one chip per matchweek (already enforced by existing unique constraint)
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'max_first_blood_uses') THEN
    ALTER TABLE campaigns ADD COLUMN max_first_blood_uses integer NOT NULL DEFAULT 3;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'max_streak_shield_uses') THEN
    ALTER TABLE campaigns ADD COLUMN max_streak_shield_uses integer NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'max_last_stand_uses') THEN
    ALTER TABLE campaigns ADD COLUMN max_last_stand_uses integer NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'max_perfect_week_uses') THEN
    ALTER TABLE campaigns ADD COLUMN max_perfect_week_uses integer NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'total_matchweeks') THEN
    ALTER TABLE campaigns ADD COLUMN total_matchweeks integer NOT NULL DEFAULT 38;
  END IF;
END $$;

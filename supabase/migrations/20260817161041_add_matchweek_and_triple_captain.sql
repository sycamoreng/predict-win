/*
# Add matchweek column to matches and Triple Captain chip support

1. Modified Tables
  - `matches`
    + `matchweek` (integer, nullable) — the official matchweek number from the league (e.g. 1-38 for PL)
  - `chip_activations`
    + `match_id` (uuid, nullable, FK → matches) — for per-match chips like Triple Captain
  - `campaigns`
    + `max_triple_captain_uses` (integer, default 1) — how many Triple Captain chips per user per campaign

2. Constraints
  - UNIQUE(user_id, campaign_id, chip_type, match_id) added so a user can't triple-captain the same match twice
  - The existing week_number unique constraint remains for Double Down

3. Notes
  - Triple Captain targets a specific match (match_id), while Double Down targets a whole week (week_number).
  - matchweek is parsed from the API's round field: "Regular Season - 5" → 5
*/

-- Add matchweek to matches
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'matchweek') THEN
    ALTER TABLE matches ADD COLUMN matchweek integer;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_matches_matchweek ON matches(matchweek);

-- Add match_id to chip_activations for per-match chips (Triple Captain)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chip_activations' AND column_name = 'match_id') THEN
    ALTER TABLE chip_activations ADD COLUMN match_id uuid REFERENCES matches(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chip_activations_user_match
  ON chip_activations(user_id, campaign_id, chip_type, match_id)
  WHERE match_id IS NOT NULL;

-- Add max_triple_captain_uses to campaigns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'max_triple_captain_uses') THEN
    ALTER TABLE campaigns ADD COLUMN max_triple_captain_uses integer NOT NULL DEFAULT 1;
  END IF;
END $$;

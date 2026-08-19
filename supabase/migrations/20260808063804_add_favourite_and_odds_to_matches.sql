/*
# Add favourite_team_id and odds columns to matches

1. Modified Tables
  - `matches`
    + `favourite_team_id` (uuid, nullable) — FK to teams; the pre-match favourite. NULL means no clear favourite.
    + `home_odds` (numeric, nullable) — pre-match decimal odds for home win
    + `away_odds` (numeric, nullable) — pre-match decimal odds for away win
    + `draw_odds` (numeric, nullable) — pre-match decimal odds for draw

2. Notes
  - favourite_team_id is used by the upset multiplier scoring logic.
  - If NULL, no upset multiplier is applied for that match.
  - Odds are informational and can be used to auto-derive favourite_team_id during fixture sync.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'favourite_team_id') THEN
    ALTER TABLE matches ADD COLUMN favourite_team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'home_odds') THEN
    ALTER TABLE matches ADD COLUMN home_odds numeric(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'away_odds') THEN
    ALTER TABLE matches ADD COLUMN away_odds numeric(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'draw_odds') THEN
    ALTER TABLE matches ADD COLUMN draw_odds numeric(5,2);
  END IF;
END $$;

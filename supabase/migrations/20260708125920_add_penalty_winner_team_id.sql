/*
# Add penalty_winner_team_id column to matches

1. Modified Tables
  - `matches`
    - Added `penalty_winner_team_id` (uuid, nullable, FK to teams) - stores the team that won a penalty shootout in knockout matches where the score is level after extra time.

2. Important Notes
  - This column is NULL for all non-penalty matches.
  - When populated, the rescoreMatch logic should use this as the "winner" instead of comparing home_score vs away_score.
  - The sync-results function will populate this from the API's teams.home.winner/teams.away.winner fields when fixture status is "PEN".
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'penalty_winner_team_id'
  ) THEN
    ALTER TABLE matches ADD COLUMN penalty_winner_team_id uuid REFERENCES teams(id);
  END IF;
END $$;
/*
  # Add match_truth snapshot table for tournament simulations

  1. New Tables
    - `match_truth`
      - `match_id` (uuid, primary key, FK to matches with cascade delete) - one truth row per match.
      - `home_score` (integer, NOT NULL, default 0) - the real final home score we will reveal.
      - `away_score` (integer, NOT NULL, default 0) - the real final away score we will reveal.
      - `first_to_score_team_id` (uuid, FK to teams, nullable) - team that scored first, fetched lazily from api-football events when a match is revealed.
      - `events_fetched` (boolean, default false) - flag so we only call /fixtures/events once per match.
      - `created_at` (timestamptz, default now()).

  2. Why
    - The simulator wipes scores from `matches` to put them back into `scheduled` state so we can replay the tournament. We still need the "true" results somewhere to drive the replay - that lives here.

  3. Security
    - RLS enabled.
    - Authenticated users can read truth (handy for debugging UI / parity checks). Writes are restricted to the service role used by the edge function.
*/

CREATE TABLE IF NOT EXISTS match_truth (
  match_id uuid PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  home_score integer NOT NULL DEFAULT 0,
  away_score integer NOT NULL DEFAULT 0,
  first_to_score_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  events_fetched boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE match_truth ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'match_truth' AND policyname = 'Authenticated can read match truth'
  ) THEN
    CREATE POLICY "Authenticated can read match truth"
      ON match_truth FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

/*
# Backfill matchweek values for Premier League matches

1. Modified Tables
  - `matches`
    + Populates `matchweek` (integer 1-38) based on kickoff order
    + Every 10 consecutive matches (ordered by kickoff_at) = 1 matchweek

2. Notes
  - Premier League has 380 matches total, 10 per matchweek, 38 matchweeks
  - Matches are assigned in strict kickoff chronological order
  - This is idempotent: only updates rows where matchweek IS NULL
*/

UPDATE matches
SET matchweek = ranked.week_num
FROM (
  SELECT id, CEIL(ROW_NUMBER() OVER (ORDER BY kickoff_at, id)::numeric / 10) AS week_num
  FROM matches
  WHERE campaign_id IS NOT NULL
) ranked
WHERE matches.id = ranked.id
  AND matches.matchweek IS NULL;

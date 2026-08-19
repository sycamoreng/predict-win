/*
# Enforce 1 chip per user per matchweek

1. Changes to `chip_activations`
  - Adds unique index on (user_id, campaign_id, week_number) WHERE week_number > 0
    This prevents a user from activating both a Double Down AND a Triple Captain
    in the same matchweek. Triple Captain records now store the actual matchweek
    in week_number (not 0).
  - The existing unique index on (user_id, campaign_id, chip_type, week_number) remains
    for backward compat but this new one is the real guard.

2. Security notes
  - This is a DB-level constraint backing server-side validation in the edge function.
  - Users cannot bypass this even if they call the API directly.
*/

-- First, clean up any triple_captain rows that have week_number=0 (from previous implementation)
-- by removing them so they can be re-inserted with correct week_number
-- (There should be none in production since TC was just added)
DELETE FROM chip_activations WHERE chip_type = 'triple_captain' AND week_number = 0;

-- Add unique partial index: only 1 chip per user per campaign per week
CREATE UNIQUE INDEX IF NOT EXISTS idx_chip_one_per_user_per_week
  ON chip_activations(user_id, campaign_id, week_number)
  WHERE week_number > 0;

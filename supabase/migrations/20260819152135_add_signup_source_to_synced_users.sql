/*
# Record where each player first signed up (Play vs Sycamore)

1. Purpose
Adds a durable, write-once record of where a player's account first came
from, so the system can always tell apart:
- players who signed up for the first time through the Play predictor app
  ("play"), and
- players who first existed as Sycamore banking customers ("sycamore").

Until now this was inferred from the mutable `is_guest` flag, which only
reflects whether a player currently has a Sycamore account. That flag goes
stale once a Play guest later opens a Sycamore account, losing the origin.
`signup_source` is set once at account creation and never changed afterwards.

2. Modified Tables
- `synced_users`
  - New column `signup_source` (text, nullable): one of 'play' or 'sycamore'.
    Constrained by a CHECK so only those two values (or null for
    historical/unknown rows) are ever stored.

3. Backfill
Existing rows are classified from the best signal available today:
- rows flagged as guests (`is_guest = true`) are marked 'play'.
- every other existing row is marked 'sycamore' (they came in via the core
  banking sync or already held a Sycamore account).

4. Security
- No RLS or policy changes. This only adds an informational column to an
  existing table whose policies remain unchanged.

5. Notes
1. The column is intentionally left nullable with no default; both account
   creation paths (the Play sign-in flow and the core sync) set it explicitly
   on insert, and it must never be overwritten on later updates.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synced_users' AND column_name = 'signup_source'
  ) THEN
    ALTER TABLE synced_users ADD COLUMN signup_source text;

    ALTER TABLE synced_users
      ADD CONSTRAINT synced_users_signup_source_check
      CHECK (signup_source IS NULL OR signup_source IN ('play', 'sycamore'));

    UPDATE synced_users
      SET signup_source = CASE WHEN is_guest THEN 'play' ELSE 'sycamore' END
      WHERE signup_source IS NULL;
  END IF;
END $$;

/*
# Store each player's Sycamore signup date and platform

1. Purpose
The Sycamore core sync feed already sends, for each banking customer, the
date they signed up on Sycamore and the platform they used. Until now those
values were only forwarded to analytics and never stored, so the game could
not tell whether a player had signed up on Sycamore just before (or after)
coming to Play. These columns persist that information so the two events can
be compared.

2. Modified Tables
- `synced_users`
  - New column `core_signup_at` (timestamptz, nullable): when the player
    signed up on the Sycamore app/bank, as reported by the core feed.
  - New column `signup_platform` (text, nullable): the platform the player
    used to sign up on Sycamore (e.g. ios, android, web), as reported by the
    core feed.

3. Security
- No RLS or policy changes; these are informational columns on an existing
  table whose policies remain unchanged.

4. Notes
1. Both columns are nullable with no default. They are populated by the core
   sync when the feed provides the values; existing rows stay null until the
   next sync delivers the data for that customer.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synced_users' AND column_name = 'core_signup_at'
  ) THEN
    ALTER TABLE synced_users ADD COLUMN core_signup_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synced_users' AND column_name = 'signup_platform'
  ) THEN
    ALTER TABLE synced_users ADD COLUMN signup_platform text;
  END IF;
END $$;

/*
# Add weekly head-to-head opt-in limit to campaigns

1. Modified Tables
  - `campaigns`
    + `h2h_weekly_limit` (integer, NOT NULL, default 0) — the maximum number of
      players allowed to opt into a single week's head-to-head matchups.
      A value of 0 means unlimited (no cap), which is the default so existing
      behaviour is unchanged until an admin sets a cap.

2. Notes
  - Enforced in two places: the app blocks new opt-ins once the cap is reached,
    and the pairing generator trims to the cap as a safety net.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'h2h_weekly_limit') THEN
    ALTER TABLE campaigns ADD COLUMN h2h_weekly_limit integer NOT NULL DEFAULT 0;
  END IF;
END $$;

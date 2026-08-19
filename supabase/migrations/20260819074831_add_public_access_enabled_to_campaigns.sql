/*
# Add public access gate to campaigns

1. Modified Tables
- `campaigns`
- Adds `public_access_enabled` (boolean, default false): when false, the
  player-facing sign-in page and dashboard are closed to the public and only
  the landing "coming soon" page is reachable. Admins flip this on when the
  game opens to players.

2. Security
- No RLS change. This is a read-only flag consumed by the frontend and only
  written through the admin-gated campaign-config-update edge function.

3. Notes
1. Defaults to false so the app starts in "coming soon" mode until an admin
   explicitly opens access.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'public_access_enabled'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN public_access_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

/*
# Add eligibility gates to campaigns

1. Purpose
   Lets an admin control whether being an "active customer" on Sycamore is
   required to appear on the general leaderboard and to use power-up chips.
   Each gate is independent so leaderboard and chips can be toggled separately.

2. Modified Tables
   - `campaigns`
     - `require_eligibility_leaderboard` (boolean, NOT NULL, default true):
       when true, only active customers appear on the general leaderboard;
       when false, ineligible customers are also shown.
     - `require_eligibility_chips` (boolean, NOT NULL, default true):
       when true, only active customers may activate power-up chips;
       when false, ineligible customers may also use chips.

3. Security
   - No RLS changes. Columns are written only via the admin-gated
     `campaign-config-update` edge function (super_admin required) and read
     client-side through the existing campaign config query.

4. Notes
   1. Defaults preserve/restore the intended behaviour: leaderboard already
      required active customers; chips are now gated by default too.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'require_eligibility_leaderboard'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN require_eligibility_leaderboard boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'require_eligibility_chips'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN require_eligibility_chips boolean NOT NULL DEFAULT true;
  END IF;
END $$;

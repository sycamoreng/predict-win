/*
# Add is_guest flag to synced_users

1. Purpose
   Guests (people who sign in with just an email and no Sycamore account) need a
   real saved player record so they can join campaigns, make predictions and be
   tracked consistently. This flag distinguishes those guest records from real
   Sycamore customer records.

2. Modified Tables
   - `synced_users`
     - `is_guest` (boolean, NOT NULL, default false): true for guest records
       created from the predictor sign-in flow, false for synced Sycamore
       customers.

3. Security
   - No RLS changes. Guest records are created server-side (service role) by the
     sign-in and predictions edge functions.

4. Notes
   1. Default false preserves the meaning of every existing row (all are synced
      Sycamore customers).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synced_users' AND column_name = 'is_guest'
  ) THEN
    ALTER TABLE synced_users ADD COLUMN is_guest boolean NOT NULL DEFAULT false;
  END IF;
END $$;

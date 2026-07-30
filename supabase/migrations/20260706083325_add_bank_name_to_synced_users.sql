/*
# Add bank_name column to synced_users

1. Modified Tables
   - `synced_users`
     - `bank_name` (text, nullable) — the name of the user's bank, 
       supplied by Core during sync. Stored as-is for display/reporting purposes.

2. Important Notes
   - Nullable because existing users won't have this value yet.
   - Core sync will populate it going forward on upsert/bulk payloads.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synced_users' AND column_name = 'bank_name'
  ) THEN
    ALTER TABLE synced_users ADD COLUMN bank_name text;
  END IF;
END $$;

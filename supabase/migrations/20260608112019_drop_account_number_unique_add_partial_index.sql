-- Drop the existing unique constraint that causes conflicts on duplicate/null account numbers
ALTER TABLE synced_users DROP CONSTRAINT IF EXISTS synced_users_account_number_key;

-- Add a partial unique index: only enforce uniqueness for non-null, non-empty account numbers
CREATE UNIQUE INDEX IF NOT EXISTS synced_users_account_number_unique
  ON synced_users (account_number)
  WHERE account_number IS NOT NULL AND account_number <> '';

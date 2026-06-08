-- Add username column (unique, nullable initially for existing users)
ALTER TABLE synced_users ADD COLUMN IF NOT EXISTS username TEXT;

-- Create a unique index on username (partial: only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS synced_users_username_unique
  ON synced_users (username)
  WHERE username IS NOT NULL;

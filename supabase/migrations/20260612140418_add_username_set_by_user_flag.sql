-- Add flag to track whether user explicitly chose their username
ALTER TABLE synced_users ADD COLUMN IF NOT EXISTS username_set_by_user BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: auto-generated usernames follow the pattern word-word-digits (e.g. swift-fox-42)
-- Anything NOT matching that pattern was user-chosen
UPDATE synced_users
SET username_set_by_user = TRUE
WHERE username IS NOT NULL
  AND username !~ '^[a-z]+-[a-z]+-\d+$';
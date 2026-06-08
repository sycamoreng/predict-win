-- Add social media handles as a JSONB column for flexibility
ALTER TABLE synced_users ADD COLUMN IF NOT EXISTS social_handles JSONB DEFAULT '{}'::jsonb;

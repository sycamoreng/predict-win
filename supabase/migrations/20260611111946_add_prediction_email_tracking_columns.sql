ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS reminder_email_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lock_email_sent boolean NOT NULL DEFAULT false;

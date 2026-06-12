
ALTER TABLE matches ADD COLUMN IF NOT EXISTS lock_1h_email_sent boolean DEFAULT false;

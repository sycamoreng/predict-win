ALTER TABLE synced_users ADD COLUMN is_staff boolean NOT NULL DEFAULT false;

UPDATE synced_users SET is_staff = true WHERE email = 'danielchidiebele@gmail.com';

CREATE INDEX IF NOT EXISTS idx_synced_users_staff ON synced_users(is_staff) WHERE is_staff = true;
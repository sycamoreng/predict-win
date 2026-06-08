/*
  # Auto-savings opt-in columns

  Per PRD §3.7, users can opt into Team Win Auto-Savings.
  When their backed team wins, Sycamore core sweeps funds from wallet → savings.

  Fields stored here mirror what is reverse-synced to core (§4.2):
  - auto_savings_enabled: boolean opt-in flag
  - auto_savings_amount: chosen sweep amount (2000 / 5000 / 10000)
  - auto_savings_duration: lock period in days (30 / 60 / 90)
  - auto_savings_consented_at: timestamp of consent for audit trail
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'synced_users' AND column_name = 'auto_savings_enabled'
  ) THEN
    ALTER TABLE public.synced_users
      ADD COLUMN auto_savings_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'synced_users' AND column_name = 'auto_savings_amount'
  ) THEN
    ALTER TABLE public.synced_users
      ADD COLUMN auto_savings_amount integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'synced_users' AND column_name = 'auto_savings_duration'
  ) THEN
    ALTER TABLE public.synced_users
      ADD COLUMN auto_savings_duration integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'synced_users' AND column_name = 'auto_savings_consented_at'
  ) THEN
    ALTER TABLE public.synced_users
      ADD COLUMN auto_savings_consented_at timestamptz DEFAULT NULL;
  END IF;
END $$;

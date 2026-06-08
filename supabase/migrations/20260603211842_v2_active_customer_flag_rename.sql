/*
  # PRD v2: Rename balance_flag to active_customer_flag

  ## Background
  PRD v2 changes the eligibility model from "minimum N2,000 balance" to
  "active customer = made at least 1 qualifying transaction during the
  campaign period". The flag column is renamed accordingly so the code
  reads naturally and reviewers can confirm the semantics on schema diff.

  ## Changes
  1. Rename `synced_users.balance_flag` to `synced_users.active_customer_flag`
     (preserving the existing boolean default false and all data).
  2. Add `synced_users.qualifying_transactions_count integer NOT NULL DEFAULT 0`
     so backend systems can record the underlying count alongside the flag.

  ## Notes
  - No data is dropped. The rename is a metadata operation; rows keep their values.
  - Renaming is wrapped in IF EXISTS guards so the migration is idempotent.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'synced_users'
      AND column_name = 'balance_flag'
  ) THEN
    ALTER TABLE public.synced_users RENAME COLUMN balance_flag TO active_customer_flag;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'synced_users'
      AND column_name = 'qualifying_transactions_count'
  ) THEN
    ALTER TABLE public.synced_users
      ADD COLUMN qualifying_transactions_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

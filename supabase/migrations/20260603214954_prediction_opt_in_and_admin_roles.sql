/*
  # Optional prediction types and admin roles

  ## Background
  1. Users want to opt in/out of each of the three prediction types per match
     (winner, first-to-score, exact scoreline). Picks they did not opt into
     must not earn points.
  2. The platform needs distinct admin roles instead of a single "is admin"
     flag, so different operators can be granted only the privileges they
     need (results entry, fixture management, payout export, full access).

  ## Changes
  1. New columns on `predictions`:
     - `wants_winner_pick boolean NOT NULL DEFAULT true`
     - `wants_first_to_score_pick boolean NOT NULL DEFAULT true`
     - `wants_exact_score_pick boolean NOT NULL DEFAULT true`
     Existing rows default to true so prior predictions keep being scored.
  2. New columns on `admin_users`:
     - `role text NOT NULL DEFAULT 'super_admin'` — labels the operator role.
     - `name text NOT NULL DEFAULT ''` — display name for the admin console.
     - `created_at` already exists.
     Allowed role values: `super_admin`, `results`, `fixtures`, `payouts`.
     Existing admin rows are migrated to `super_admin` by the default value.
  3. `synced_users` previously seeded the admin via `admin_users` insert;
     this migration backfills `role` for any existing rows.

  ## Notes
  - No data is dropped. Defaults preserve existing user behaviour.
  - A check constraint guards the role enum without using a Postgres ENUM
    type (so the list can evolve without ALTER TYPE).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'predictions' AND column_name = 'wants_winner_pick'
  ) THEN
    ALTER TABLE public.predictions
      ADD COLUMN wants_winner_pick boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'predictions' AND column_name = 'wants_first_to_score_pick'
  ) THEN
    ALTER TABLE public.predictions
      ADD COLUMN wants_first_to_score_pick boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'predictions' AND column_name = 'wants_exact_score_pick'
  ) THEN
    ALTER TABLE public.predictions
      ADD COLUMN wants_exact_score_pick boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.admin_users
      ADD COLUMN role text NOT NULL DEFAULT 'super_admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.admin_users
      ADD COLUMN name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND constraint_name = 'admin_users_role_check'
  ) THEN
    ALTER TABLE public.admin_users
      ADD CONSTRAINT admin_users_role_check
      CHECK (role IN ('super_admin', 'results', 'fixtures', 'payouts'));
  END IF;
END $$;

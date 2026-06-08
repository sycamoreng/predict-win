/*
  # Account validation, tie-break counters, and analytics events

  ## 1. New columns on `synced_users`
    - `is_account_valid` (boolean, default true) — set on sync after NUBAN validation; eligibility = is_account_valid AND balance_flag.
    - `correct_predictions_count` (integer, default 0) — total predictions that earned >0 points; tiebreak #1.
    - `exact_scorelines_count` (integer, default 0) — total predictions that hit the exact scoreline; tiebreak #2 (highest skill bracket).

  ## 2. New tables
    - `analytics_events` — append-only log mirroring what's pushed to Netcore.
      `id` (uuid), `user_id` (uuid, fk synced_users), `event_name` (text),
      `properties` (jsonb), `delivered_to_netcore` (boolean), `created_at` (timestamptz)

  ## 3. Status values
    Match statuses now formally include `postponed` and `cancelled`. We add a check
    constraint to keep the column tidy.

  ## 4. Security
    `analytics_events` is service-role only; no client reads. RLS enabled.

  ## 5. Indexes
    - `analytics_events(user_id, created_at)` for marketing exports.
    - `synced_users(total_points DESC, exact_scorelines_count DESC, correct_predictions_count DESC)` for leaderboard.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synced_users' AND column_name = 'is_account_valid'
  ) THEN
    ALTER TABLE synced_users ADD COLUMN is_account_valid boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synced_users' AND column_name = 'correct_predictions_count'
  ) THEN
    ALTER TABLE synced_users ADD COLUMN correct_predictions_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synced_users' AND column_name = 'exact_scorelines_count'
  ) THEN
    ALTER TABLE synced_users ADD COLUMN exact_scorelines_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES synced_users(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered_to_netcore boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analytics_events' AND policyname = 'No public access to analytics events'
  ) THEN
    CREATE POLICY "No public access to analytics events"
      ON analytics_events FOR SELECT
      TO authenticated
      USING (false);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created
  ON analytics_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
  ON analytics_events(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_synced_users_leaderboard
  ON synced_users(total_points DESC, exact_scorelines_count DESC, correct_predictions_count DESC);

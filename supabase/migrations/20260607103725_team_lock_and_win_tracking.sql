/*
  # Team lock + win tracking

  1. `teams.is_eliminated` — once a team is knocked out, users who backed
     them can switch to a new team. Otherwise the choice is permanent.

  2. `synced_users.backed_team_wins` — incremented each time the user's
     backed team wins a match. Used for display/engagement.

  3. `synced_users.backed_team_locked_at` — timestamp when the user locked
     their team choice (set on first back-team call).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'is_eliminated'
  ) THEN
    ALTER TABLE public.teams
      ADD COLUMN is_eliminated boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'synced_users' AND column_name = 'backed_team_wins'
  ) THEN
    ALTER TABLE public.synced_users
      ADD COLUMN backed_team_wins integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'synced_users' AND column_name = 'backed_team_locked_at'
  ) THEN
    ALTER TABLE public.synced_users
      ADD COLUMN backed_team_locked_at timestamptz DEFAULT NULL;
  END IF;
END $$;

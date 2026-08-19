/*
  # Create campaigns table — multi-competition foundation

  ## 1. New Tables

  ### `campaigns`
  One row per competition (e.g. "FIFA World Cup 2026", "Premier League 2026/27").
  Stores all campaign-level configuration that was previously in `campaign_config`.

  - `id` (uuid, primary key)
  - `name` (text) — display name, e.g. "FIFA World Cup 2026"
  - `slug` (text, unique) — URL-safe identifier, e.g. "world-cup-2026"
  - `competition_type` (text) — 'tournament' or 'league'
  - `api_football_league_id` (integer) — league ID on football data provider
  - `api_football_season` (integer) — season year
  - `is_active` (boolean) — the currently visible campaign in the app
  - `predictions_enabled` (boolean) — can users make predictions
  - `leaderboard_enabled` (boolean) — is leaderboard visible
  - `team_picking_enabled` (boolean) — can users pick a backed team
  - `registration_open` (boolean) — can new users join this campaign
  - `campaign_ended` (boolean) — triggers end-of-campaign UI
  - `prediction_lock_minutes` (integer) — minutes before kickoff to lock predictions
  - `week_start_date` (date) — anchor for weekly leaderboard calculation
  - `scoring_exact_ft` (integer, default 15) — points for exact scoreline (full time)
  - `scoring_exact_aet` (integer, default 20) — points for exact scoreline (after extra time)
  - `scoring_exact_pen` (integer, default 25) — points for exact scoreline (penalties)
  - `scoring_result` (integer, default 5) — points for correct result
  - `scoring_first_to_score` (integer, default 10) — points for correct first to score
  - `has_knockout_stages` (boolean, default true) — whether this competition has knockout rounds
  - `has_groups` (boolean, default true) — whether teams are organized in groups
  - `starts_at` (timestamptz) — when the competition begins
  - `ends_at` (timestamptz, nullable) — when the competition ends
  - `created_at`, `updated_at` (timestamptz)

  ## 2. Backfill

  Inserts the existing World Cup campaign as the first campaign row, pulling
  configuration from the current `campaign_config` table.

  ## 3. Security
  - RLS enabled with public read access (campaign info is not sensitive).
  - Writes restricted to service role (admin operations via edge functions).
*/

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  competition_type text NOT NULL DEFAULT 'tournament',
  api_football_league_id integer,
  api_football_season integer,
  is_active boolean NOT NULL DEFAULT false,
  predictions_enabled boolean NOT NULL DEFAULT false,
  leaderboard_enabled boolean NOT NULL DEFAULT false,
  team_picking_enabled boolean NOT NULL DEFAULT false,
  registration_open boolean NOT NULL DEFAULT false,
  campaign_ended boolean NOT NULL DEFAULT false,
  prediction_lock_minutes integer NOT NULL DEFAULT 60,
  week_start_date date,
  scoring_exact_ft integer NOT NULL DEFAULT 15,
  scoring_exact_aet integer NOT NULL DEFAULT 20,
  scoring_exact_pen integer NOT NULL DEFAULT 25,
  scoring_result integer NOT NULL DEFAULT 5,
  scoring_first_to_score integer NOT NULL DEFAULT 10,
  has_knockout_stages boolean NOT NULL DEFAULT true,
  has_groups boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view campaigns" ON campaigns;
CREATE POLICY "Anyone can view campaigns"
  ON campaigns FOR SELECT
  TO anon, authenticated
  USING (true);

-- Backfill the World Cup as the first campaign
INSERT INTO campaigns (
  name, slug, competition_type,
  api_football_league_id, api_football_season,
  is_active, predictions_enabled, leaderboard_enabled,
  team_picking_enabled, registration_open, campaign_ended,
  prediction_lock_minutes, week_start_date,
  scoring_exact_ft, scoring_exact_aet, scoring_exact_pen,
  scoring_result, scoring_first_to_score,
  has_knockout_stages, has_groups,
  starts_at
)
SELECT
  COALESCE(cc.campaign_name, 'FIFA World Cup 2026'),
  'world-cup-2026',
  'tournament',
  1, 2026,
  false,
  COALESCE(cc.predictions_enabled, false),
  COALESCE(cc.leaderboard_enabled, false),
  COALESCE(cc.team_picking_enabled, false),
  false,
  COALESCE(cc.tournament_ended, false),
  COALESCE(cc.prediction_lock_minutes, 60),
  COALESCE(cc.week_start_date, '2026-06-11')::date,
  15, 20, 25, 5, 10,
  true, true,
  '2026-06-11T00:00:00Z'
FROM (SELECT 1) AS dummy
LEFT JOIN campaign_config cc ON cc.id = 1
WHERE NOT EXISTS (SELECT 1 FROM campaigns WHERE slug = 'world-cup-2026');

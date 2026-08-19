/*
# Create Premier League 2026/27 Campaign and Seed Teams

1. New Data
   - Inserts a new campaign row for "Premier League 2026/27" with league-type settings
   - Competition type: league (no knockout stages, no groups)
   - Scoring: 5pts result, 10pts first scorer, 15pts exact score (no AET/PEN variants)
   - Registration open, predictions enabled
   - Inserts all 20 Premier League teams into the teams table
   - Creates campaign_teams entries linking all 20 teams to the new campaign

2. Campaign Configuration
   - is_active: true (this becomes the current active campaign)
   - has_knockout_stages: false, has_groups: false
   - api_football_league_id: 39 (Premier League), api_football_season: 2026
   - prediction_lock_minutes: 60

3. Important Notes
   - The World Cup 2026 campaign remains intact with is_active = false
   - Newcastle uses code NCL, Southampton uses SOT to avoid conflicts with World Cup national teams
*/

-- Deactivate any currently active campaign
UPDATE campaigns SET is_active = false WHERE is_active = true;

-- Insert the Premier League 2026/27 campaign
INSERT INTO campaigns (
  name, slug, competition_type, is_active, campaign_ended,
  has_knockout_stages, has_groups,
  predictions_enabled, leaderboard_enabled, team_picking_enabled, registration_open,
  scoring_result, scoring_first_to_score, scoring_exact_ft, scoring_exact_aet, scoring_exact_pen,
  api_football_league_id, api_football_season,
  prediction_lock_minutes, week_start_date
) VALUES (
  'Premier League 2026/27', 'premier-league-2026-27', 'league', true, false,
  false, false,
  true, true, true, true,
  5, 10, 15, 15, 15,
  39, 2026,
  60, '2026-08-08'
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  campaign_ended = false,
  predictions_enabled = true,
  leaderboard_enabled = true,
  team_picking_enabled = true,
  registration_open = true,
  updated_at = now();

-- Insert PL teams (ON CONFLICT by api_football_id to handle re-runs)
INSERT INTO teams (name, code, flag_emoji, api_football_id) VALUES
  ('Arsenal', 'ARS', '🔴', 42),
  ('Aston Villa', 'AVL', '🟣', 66),
  ('Bournemouth', 'BOU', '🍒', 35),
  ('Brentford', 'BRE', '🐝', 55),
  ('Brighton', 'BHA', '🔵', 51),
  ('Chelsea', 'CHE', '🔵', 49),
  ('Crystal Palace', 'CRY', '🦅', 52),
  ('Everton', 'EVE', '🔵', 45),
  ('Fulham', 'FUL', '⚪', 36),
  ('Ipswich Town', 'IPS', '🔵', 57),
  ('Leicester City', 'LEI', '🦊', 46),
  ('Liverpool', 'LIV', '🔴', 40),
  ('Manchester City', 'MCI', '🩵', 50),
  ('Manchester United', 'MUN', '🔴', 33),
  ('Newcastle United', 'NCL', '⬛', 34),
  ('Nottingham Forest', 'NFO', '🌳', 65),
  ('Southampton', 'SOT', '🔴', 41),
  ('Tottenham', 'TOT', '⚪', 47),
  ('West Ham', 'WHU', '🟤', 48),
  ('Wolves', 'WOL', '🟠', 39)
ON CONFLICT (api_football_id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  flag_emoji = EXCLUDED.flag_emoji;

-- Link all PL teams to the campaign via campaign_teams
INSERT INTO campaign_teams (campaign_id, team_id)
SELECT c.id, t.id
FROM campaigns c
CROSS JOIN teams t
WHERE c.slug = 'premier-league-2026-27'
  AND t.api_football_id IN (42, 66, 35, 55, 51, 49, 52, 45, 36, 57, 46, 40, 50, 33, 34, 65, 41, 47, 48, 39)
ON CONFLICT (campaign_id, team_id) DO NOTHING;

-- Reset is_eliminated on PL teams (they should start fresh)
UPDATE teams SET is_eliminated = false
WHERE api_football_id IN (42, 66, 35, 55, 51, 49, 52, 45, 36, 57, 46, 40, 50, 33, 34, 65, 41, 47, 48, 39);

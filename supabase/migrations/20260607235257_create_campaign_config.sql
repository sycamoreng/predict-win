CREATE TABLE IF NOT EXISTS campaign_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  predictions_enabled boolean NOT NULL DEFAULT false,
  leaderboard_enabled boolean NOT NULL DEFAULT false,
  team_picking_enabled boolean NOT NULL DEFAULT false,
  campaign_name text NOT NULL DEFAULT 'FIFA World Cup 2026',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO campaign_config (id, predictions_enabled, leaderboard_enabled, team_picking_enabled, campaign_name)
VALUES (1, true, false, true, 'FIFA World Cup 2026')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE campaign_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_config" ON campaign_config
  FOR SELECT TO anon, authenticated USING (true);

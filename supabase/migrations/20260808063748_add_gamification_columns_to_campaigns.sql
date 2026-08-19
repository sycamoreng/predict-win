/*
# Add gamification columns to campaigns table

1. Modified Tables
  - `campaigns`
    + `max_double_down_uses` (integer, default 2) — how many Double Down chips a user can use per campaign
    + `upset_multiplier_enabled` (boolean, default false) — toggle upset scoring multiplier
    + `upset_multiplier_underdog` (numeric, default 2.0) — multiplier for correct underdog predictions
    + `upset_multiplier_draw` (numeric, default 1.5) — multiplier for correct draw predictions
    + `upset_multiplier_favourite` (numeric, default 1.0) — multiplier for correct favourite predictions (no bonus)

2. Notes
  - These settings are per-campaign, allowing different competitions to have different gamification rules.
  - Upset multiplier is disabled by default and must be toggled on per campaign.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'max_double_down_uses') THEN
    ALTER TABLE campaigns ADD COLUMN max_double_down_uses integer NOT NULL DEFAULT 2;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'upset_multiplier_enabled') THEN
    ALTER TABLE campaigns ADD COLUMN upset_multiplier_enabled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'upset_multiplier_underdog') THEN
    ALTER TABLE campaigns ADD COLUMN upset_multiplier_underdog numeric(3,1) NOT NULL DEFAULT 2.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'upset_multiplier_draw') THEN
    ALTER TABLE campaigns ADD COLUMN upset_multiplier_draw numeric(3,1) NOT NULL DEFAULT 1.5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'upset_multiplier_favourite') THEN
    ALTER TABLE campaigns ADD COLUMN upset_multiplier_favourite numeric(3,1) NOT NULL DEFAULT 1.0;
  END IF;
END $$;

/*
# Add prediction_lock_minutes to campaign_config

1. Modified Tables
   - `campaign_config`
     - `prediction_lock_minutes` (integer, NOT NULL, default 60)
       Controls how many minutes before kickoff predictions lock.
       Admins can change this in real-time from the Campaign settings panel.

2. Important Notes
   - Default is 60 (1 hour before kickoff).
   - Both the predictions edge function and frontend MatchCard read this value
     to enforce/display the lock window.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_config' AND column_name = 'prediction_lock_minutes'
  ) THEN
    ALTER TABLE campaign_config ADD COLUMN prediction_lock_minutes integer NOT NULL DEFAULT 60;
  END IF;
END $$;

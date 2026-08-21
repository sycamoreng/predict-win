/*
# Schedule the per-matchday results digest job

1. Purpose
   - Runs the `matchday-results` edge function on a schedule so that, once all
     of a calendar day's matches are settled, each player receives one "how you
     did today" recap email. The function itself guards against sending twice.

2. Schedule
   - Every 30 minutes. The function only emails days that are fully settled and
     have rolled over, so frequent runs simply pick up newly-finished days
     promptly without duplicating recaps.

3. Notes
   - Uses pg_net (net.http_post) with the stored Supabase URL and service-role
     key settings, matching every other scheduled job in this project.
   - Idempotent: unschedules any existing job of the same name first.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'matchday-results-digest') THEN
    PERFORM cron.unschedule('matchday-results-digest');
  END IF;
END $$;

SELECT cron.schedule(
  'matchday-results-digest',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/matchday-results',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

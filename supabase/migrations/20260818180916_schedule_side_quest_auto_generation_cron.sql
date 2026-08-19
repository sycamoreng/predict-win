/*
# Schedule automatic side quest generation cron

1. Changes
   - Adds a pg_cron job that runs daily at 06:00 UTC.
   - Calls the side-quests edge function with action "auto-generate" using pg_net.
   - The edge function determines the next matchweek and generates quests if they don't exist yet.

2. Important Notes
   - Uses pg_net for async HTTP calls (non-blocking).
   - Only generates quests that don't already exist (idempotent).
*/

SELECT cron.unschedule('auto-generate-side-quests') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-generate-side-quests'
);

SELECT cron.schedule(
  'auto-generate-side-quests',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/side-quests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key')
    ),
    body := '{"action":"auto-generate"}'::jsonb
  );
  $$
);

/*
# Schedule sweep-catchup cron job

1. Purpose
   - Adds a periodic cron that calls the sweep-catchup edge function every 30 minutes.
   - This acts as a safety net to detect and trigger missed auto-savings sweeps 
     (e.g. when the fire-and-forget call in sync-results silently fails).

2. Schedule
   - Runs every 30 minutes around the clock.

3. Important Notes
   - The sweep-catchup function is idempotent: it only triggers sweeps for 
     match/user combinations that have no existing sweep_results row.
   - Uses pg_net (net.http_post) to call the edge function, same pattern as other crons.
*/

SELECT cron.schedule(
  'sweep-catchup-every-30m',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sweep-catchup',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

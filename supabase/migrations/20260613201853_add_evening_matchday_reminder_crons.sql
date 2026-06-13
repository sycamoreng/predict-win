-- Add matchday reminder crons at 16:00 and 19:00 UTC to cover evening matches (7pm WAT / 8pm WAT kickoffs)
SELECT cron.schedule(
  'matchday-reminder-16',
  '0 16 * * *',
  $$SELECT net.http_post(
url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/matchday-reminder',
headers := '{"Content-Type": "application/json"}'::jsonb,
body := '{}'::jsonb
)$$
);

SELECT cron.schedule(
  'matchday-reminder-19',
  '0 19 * * *',
  $$SELECT net.http_post(
url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/matchday-reminder',
headers := '{"Content-Type": "application/json"}'::jsonb,
body := '{}'::jsonb
)$$
);
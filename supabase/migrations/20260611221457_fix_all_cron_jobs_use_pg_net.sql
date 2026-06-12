
-- Drop all broken cron jobs that use extensions.http_post or app.settings
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobid IN (1,2,3,4,5,6,7,8,9,10,11,12,13);

-- Re-create sync-results crons using net.http_post (no auth needed, verify_jwt=false)
-- Schedule: every 2 hours during match windows + key times
SELECT cron.schedule(
  'sync-results-18',
  '0 18 * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "update-scores"}'::jsonb
  )$$
);

SELECT cron.schedule(
  'sync-results-20',
  '0 20 * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "update-scores"}'::jsonb
  )$$
);

SELECT cron.schedule(
  'sync-results-2130',
  '30 21 * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "update-scores"}'::jsonb
  )$$
);

SELECT cron.schedule(
  'sync-results-23',
  '0 23 * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "update-scores"}'::jsonb
  )$$
);

SELECT cron.schedule(
  'sync-results-01',
  '0 1 * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "update-scores"}'::jsonb
  )$$
);

SELECT cron.schedule(
  'sync-results-03',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "update-scores"}'::jsonb
  )$$
);

SELECT cron.schedule(
  'sync-results-05',
  '0 5 * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "update-scores"}'::jsonb
  )$$
);

SELECT cron.schedule(
  'sync-results-0630',
  '30 6 * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "update-scores"}'::jsonb
  )$$
);

-- Matchday reminder crons
SELECT cron.schedule(
  'matchday-reminder-07',
  '0 7 * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/matchday-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

SELECT cron.schedule(
  'matchday-reminder-10',
  '0 10 * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/matchday-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

SELECT cron.schedule(
  'matchday-reminder-13',
  '0 13 * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/matchday-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

-- Weekly digest (Mondays 8am) - needs anon key since verify_jwt=true
SELECT cron.schedule(
  'weekly-digest-mon',
  '0 8 * * 1',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhla25laml6aGFzc2RrcGVkYW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ1NTgyMCwiZXhwIjoyMDk2MDMxODIwfQ.R1KlUm6b7MF3IA3sFMJdG5fHfDXwJKGXvEnqI1FmCJY'
    ),
    body := '{}'::jsonb
  )$$
);

-- Prediction lock emails (every 10 min)
SELECT cron.schedule(
  'prediction-lock-emails',
  '*/10 * * * *',
  $$SELECT net.http_post(
    url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/prediction-lock-emails',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

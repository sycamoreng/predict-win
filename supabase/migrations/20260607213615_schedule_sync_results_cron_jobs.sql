-- Schedule sync-results edge function calls at 8 strategic times daily
-- to capture match results shortly after they finish.
-- Match hours (UTC): 0-4 (Americas evening) and 16-23 (Europe/Africa evening)

SELECT cron.schedule(
  'sync-results-1800',
  '0 18 * * *',
  $$SELECT extensions.http_post(
    'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    '{"action":"update-scores"}',
    'application/json'
  )$$
);

SELECT cron.schedule(
  'sync-results-2000',
  '0 20 * * *',
  $$SELECT extensions.http_post(
    'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    '{"action":"update-scores"}',
    'application/json'
  )$$
);

SELECT cron.schedule(
  'sync-results-2130',
  '30 21 * * *',
  $$SELECT extensions.http_post(
    'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    '{"action":"update-scores"}',
    'application/json'
  )$$
);

SELECT cron.schedule(
  'sync-results-2300',
  '0 23 * * *',
  $$SELECT extensions.http_post(
    'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    '{"action":"update-scores"}',
    'application/json'
  )$$
);

SELECT cron.schedule(
  'sync-results-0100',
  '0 1 * * *',
  $$SELECT extensions.http_post(
    'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    '{"action":"update-scores"}',
    'application/json'
  )$$
);

SELECT cron.schedule(
  'sync-results-0300',
  '0 3 * * *',
  $$SELECT extensions.http_post(
    'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    '{"action":"update-scores"}',
    'application/json'
  )$$
);

SELECT cron.schedule(
  'sync-results-0500',
  '0 5 * * *',
  $$SELECT extensions.http_post(
    'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    '{"action":"update-scores"}',
    'application/json'
  )$$
);

SELECT cron.schedule(
  'sync-results-0630',
  '30 6 * * *',
  $$SELECT extensions.http_post(
    'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
    '{"action":"update-scores"}',
    'application/json'
  )$$
);
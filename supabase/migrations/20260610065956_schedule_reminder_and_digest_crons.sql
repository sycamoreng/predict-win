-- Matchday Reminder: runs 3x daily at times that cover typical World Cup kickoffs
-- Nigeria is UTC+1. Matches kick at 13:00, 16:00, 19:00, 22:00 WAT typically.
-- We remind ~6h before lock (lock is 3h before kick), so remind ~9h before kick.
-- Run at 07:00, 10:00, 13:00 UTC (08:00, 11:00, 14:00 WAT)

SELECT cron.schedule(
  'matchday-reminder-0700',
  '0 7 * * *',
  $$SELECT extensions.http_post(
    'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/matchday-reminder',
    '{}',
    'application/json'
  )$$
);

SELECT cron.schedule(
  'matchday-reminder-1000',
  '0 10 * * *',
  $$SELECT extensions.http_post(
    'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/matchday-reminder',
    '{}',
    'application/json'
  )$$
);

SELECT cron.schedule(
  'matchday-reminder-1300',
  '0 13 * * *',
  $$SELECT extensions.http_post(
    'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/matchday-reminder',
    '{}',
    'application/json'
  )$$
);

-- Weekly Leaderboard Digest: runs every Monday at 08:00 UTC (09:00 WAT)
SELECT cron.schedule(
  'weekly-digest-monday',
  '0 8 * * 1',
  $$SELECT extensions.http_post(
    'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/weekly-digest',
    '{}',
    'application/json'
  )$$
);

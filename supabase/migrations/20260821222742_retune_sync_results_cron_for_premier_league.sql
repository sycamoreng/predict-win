-- The original 8 sync-results checks (01,03,05,0630,18,20,2130,23 UTC) were tuned
-- for the World Cup's global kickoff spread. Premier League fixtures cluster on
-- Saturday/Sunday afternoons (14:00-15:00 UTC) plus midweek/Fri/Mon evenings.
-- Retune: add afternoon checks to catch the weekend block quickly, keep the
-- evening block, drop the useless overnight runs, keep one morning safety net.

DO $$
DECLARE
  j record;
BEGIN
  FOR j IN SELECT jobname FROM cron.job WHERE jobname LIKE 'sync-results%' LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;

DO $$
DECLARE
  slots text[] := ARRAY[
    'sync-results-0700:0 7 * * *',    -- overnight/postponed safety net
    'sync-results-1330:30 13 * * *',  -- Sat 11:30 UTC finishers
    'sync-results-1600:0 16 * * *',   -- Sun 13:00 + early Sat 14:00 finishers
    'sync-results-1700:0 17 * * *',   -- Sat/Sun 14:00-15:00 finishers
    'sync-results-1800:0 18 * * *',   -- 15:00 finishers, Sun 15:30
    'sync-results-1900:0 19 * * *',   -- 16:30 late-afternoon finishers
    'sync-results-2100:0 21 * * *',   -- Fri/Mon 19:00 finishers
    'sync-results-2200:0 22 * * *',   -- Wed 20:00 finishers
    'sync-results-2300:0 23 * * *'    -- final catch-all
  ];
  s text;
  jobname text;
  sched text;
BEGIN
  FOREACH s IN ARRAY slots LOOP
    jobname := split_part(s, ':', 1);
    sched := split_part(s, ':', 2);
    PERFORM cron.schedule(
      jobname,
      sched,
      $cmd$SELECT net.http_post(
url := 'https://xeknejizhassdkpedaoh.supabase.co/functions/v1/sync-results',
headers := '{"Content-Type": "application/json"}'::jsonb,
body := '{"action": "update-scores"}'::jsonb
)$cmd$
    );
  END LOOP;
END $$;

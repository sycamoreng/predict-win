
-- Guard table so the weekly digest fires exactly once per matchweek. Written only
-- by the service-role weekly-digest function; RLS on with no policies denies all
-- anon/authenticated access (matches the other *_sends bookkeeping tables).
CREATE TABLE IF NOT EXISTS public.weekly_digest_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  matchweek integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, matchweek)
);

ALTER TABLE public.weekly_digest_sends ENABLE ROW LEVEL SECURITY;

-- Turn on automatic result syncing, matchday reminders, prediction-lock emails and
-- the savings catch-up sweep.
SELECT cron.alter_job(jobid, active := true) FROM cron.job
  WHERE jobname IN (
    'sync-results-01','sync-results-03','sync-results-05','sync-results-0630',
    'sync-results-18','sync-results-20','sync-results-2130','sync-results-23',
    'matchday-reminder-07','matchday-reminder-10','matchday-reminder-13',
    'matchday-reminder-16','matchday-reminder-19',
    'prediction-lock-emails','sweep-catchup-every-30m'
  );

-- Weekly digest: check daily and let the function send only when a matchweek has
-- finished (and only once), instead of firing every Monday regardless.
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'weekly-digest-mon'),
  schedule := '0 8 * * *',
  active := true
);

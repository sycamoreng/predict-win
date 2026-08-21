
-- get_week_bounds only reads campaigns/matches, both already readable by the app's
-- anon-key clients. Run it as the caller (SECURITY INVOKER) so it no longer needs an
-- elevated-privilege grant, which resolves the linter warning while keeping the
-- leaderboard's weekly week-range label working.
CREATE OR REPLACE FUNCTION public.get_week_bounds(ref_date timestamptz DEFAULT now())
 RETURNS TABLE(week_start timestamptz, week_end timestamptz, week_number integer)
 LANGUAGE plpgsql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
cid uuid;
cur_mw int;
ws timestamptz;
we timestamptz;
BEGIN
SELECT id INTO cid FROM campaigns WHERE is_active = true LIMIT 1;
IF cid IS NULL THEN
RETURN QUERY SELECT ref_date, ref_date, 1;
RETURN;
END IF;

SELECT COALESCE(
(SELECT m.matchweek
FROM matches m
WHERE m.campaign_id = cid
AND m.matchweek IS NOT NULL
AND m.kickoff_at <= ref_date
ORDER BY m.kickoff_at DESC
LIMIT 1),
(SELECT MIN(m.matchweek)
FROM matches m
WHERE m.campaign_id = cid
AND m.matchweek IS NOT NULL)
) INTO cur_mw;

IF cur_mw IS NULL THEN
RETURN QUERY SELECT ref_date, ref_date, 1;
RETURN;
END IF;

SELECT MIN(m.kickoff_at), MAX(m.kickoff_at)
INTO ws, we
FROM matches m
WHERE m.campaign_id = cid
AND m.matchweek = cur_mw;

RETURN QUERY SELECT ws, we, cur_mw;
END;
$function$;

CREATE OR REPLACE FUNCTION get_exact_scorelines_count(
  p_campaign_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)
  FROM predictions p
  JOIN matches m ON m.id = p.match_id
  WHERE p.scored = true
    AND p.wants_exact_score_pick = true
    AND m.status = 'completed'
    AND m.home_score = p.predicted_home_score
    AND m.away_score = p.predicted_away_score
    AND (p_campaign_id IS NULL OR p.campaign_id = p_campaign_id)
    AND (p_from IS NULL OR p.created_at >= p_from)
    AND (p_to IS NULL OR p.created_at <= p_to);
$$;

/*
  # Disable emails not relevant to the Premier League campaign

  1. What changes
     Turns OFF (without deleting) four email events by setting `enabled = false`
     on their `email_templates` rows. Their SendGrid designs stay saved, so any
     of them can be switched back on later by flipping `enabled` to true.

  2. Events disabled
     - team_eliminated      : no elimination/relegation in the league game
     - prediction_correct   : superseded by the matchday_results summary
     - prediction_incorrect : superseded by the matchday_no_points summary
     - payout_notification  : parked for now (kept, just not sending)

  3. Notes
     No schema, RLS, or data-shape changes. The send-email engine already
     refuses to send when `enabled = false`.
*/

UPDATE public.email_templates
SET enabled = false, updated_at = now()
WHERE event_name IN (
  'team_eliminated',
  'prediction_correct',
  'prediction_incorrect',
  'payout_notification'
);
/*
# Register the per-matchday results recap email against the existing "you scored" template

1. Purpose
   - The new per-matchday results digest sends emails under the event name
     `matchday_results`. The send-email function looks up a SendGrid template by
     event name, so this event needs a row in `email_templates` or it silently
     will not deliver.
   - Per the product decision, this recap reuses the SAME SendGrid template as
     the previous per-match "you scored" email (`prediction_correct`).

2. Changes
   - Inserts (or updates) a `matchday_results` row whose `sendgrid_template_id`
     is copied from the existing `prediction_correct` row, so both point at the
     same SendGrid design.

3. Notes
   - Idempotent: re-running keeps the template id in sync with prediction_correct.
   - No schema or security changes; RLS on email_templates is unchanged.
*/

INSERT INTO email_templates (event_name, sendgrid_template_id, description, enabled)
SELECT
  'matchday_results',
  sendgrid_template_id,
  'Per-matchday results recap: one "how you did today" email listing each of the day''s finished matches',
  enabled
FROM email_templates
WHERE event_name = 'prediction_correct'
ON CONFLICT (event_name) DO UPDATE
  SET sendgrid_template_id = EXCLUDED.sendgrid_template_id,
      updated_at = now();

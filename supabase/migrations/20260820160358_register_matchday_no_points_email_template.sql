/*
  # Register the "better luck next time" matchday recap template

  1. Purpose
     - The per-matchday recap now sends an alternative email to players who
       predicted but scored zero points across the whole matchday. This uses a
       distinct event name so it can be toggled independently of the positive
       "you scored" recap.

  2. Changes
     - Inserts (or updates) a `matchday_no_points` row pointing at the existing
       "better luck next time" SendGrid design
       (d-ec5f1ac8540f4694b044bcbcbb3da939, the same one used by
       prediction_incorrect).

  3. Notes
     - Idempotent. No schema or security changes.
*/

INSERT INTO email_templates (event_name, sendgrid_template_id, description, enabled)
VALUES (
  'matchday_no_points',
  'd-ec5f1ac8540f4694b044bcbcbb3da939',
  'Per-matchday recap sent to players who predicted but scored 0 points that day ("better luck next time")',
  true
)
ON CONFLICT (event_name) DO UPDATE
  SET sendgrid_template_id = EXCLUDED.sendgrid_template_id,
      updated_at = now();

/*
  # Disable the instant "Prediction submitted" email

  1. What changes
     Turns OFF (without deleting) the `prediction_submitted` email event by
     setting `enabled = false`. Its SendGrid design stays saved, so it can be
     switched back on later by flipping `enabled` to true.

  2. Why
     People should be able to edit their picks freely after saving. The
     "Prediction locked" email already confirms their final picks just before
     the deadline, so the instant receipt is no longer wanted.

  3. Notes
     No schema, RLS, or data-shape changes. The send-email engine already
     refuses to send when `enabled = false`.
*/

UPDATE public.email_templates
SET enabled = false, updated_at = now()
WHERE event_name = 'prediction_submitted';
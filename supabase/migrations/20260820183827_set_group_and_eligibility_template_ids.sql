/*
  # Attach SendGrid template ids to the three new lifecycle emails

  1. Purpose
     The designs for the "eligibility unlocked", "group created" and
     "group joined" emails are now ready in SendGrid. This sets each event's
     template id so delivery begins automatically.

  2. Modified rows (email_templates)
     - eligibility_unlocked -> d-387cf6120215450bb3a573ab3762be79
     - group_created        -> d-3945b40fb6e443e0bc7349ecd024b320
     - group_joined         -> d-09d2c219ce6d4d4eb571afa2b9154f8c

  3. Security
     No schema or RLS changes.

  4. Notes
     1. Idempotent: re-running simply re-sets the same ids.
*/

UPDATE email_templates SET sendgrid_template_id = 'd-387cf6120215450bb3a573ab3762be79', updated_at = now()
  WHERE event_name = 'eligibility_unlocked';
UPDATE email_templates SET sendgrid_template_id = 'd-3945b40fb6e443e0bc7349ecd024b320', updated_at = now()
  WHERE event_name = 'group_created';
UPDATE email_templates SET sendgrid_template_id = 'd-09d2c219ce6d4d4eb571afa2b9154f8c', updated_at = now()
  WHERE event_name = 'group_joined';

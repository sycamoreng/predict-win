/*
  # Register three new lifecycle email events

  1. Purpose
     Add rows in `email_templates` for three new moments in the player journey so
     the send-email function has an event to look up. The actual SendGrid designs
     will be attached later; until a template id is set, send-email safely skips
     delivery (it already treats a missing sendgrid_template_id as "not delivered").

  2. New event rows (in email_templates)
     - `eligibility_unlocked`: sent when a player who was previously not an active
       Sycamore customer becomes one, unlocking the general leaderboard and
       power-up chips.
     - `group_created`: sent to a player right after they create a private group.
     - `group_joined`: sent to a player right after they join an existing group.

  3. Security
     No schema or RLS changes. This only inserts configuration rows.

  4. Notes
     1. sendgrid_template_id is left NULL on purpose. Set it once the designs are
        ready and delivery begins automatically.
     2. Idempotent: re-running keeps the descriptions in sync and never disables
        an already-configured template.
*/

INSERT INTO email_templates (event_name, sendgrid_template_id, description, enabled)
VALUES
  ('eligibility_unlocked', NULL,
   'Sent when a previously-ineligible player becomes an active customer, unlocking the leaderboard and power-up chips', true),
  ('group_created', NULL,
   'Sent to a player immediately after they create a private group/league', true),
  ('group_joined', NULL,
   'Sent to a player immediately after they join an existing private group/league', true)
ON CONFLICT (event_name) DO UPDATE
  SET description = EXCLUDED.description,
      updated_at = now();

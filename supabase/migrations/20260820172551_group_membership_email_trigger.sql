/*
  # Send group-created / group-joined emails via a database trigger

  1. Purpose
     Group creation and joining happen entirely in the browser (direct inserts
     into `group_members`), so there is no server code to trigger an email. This
     migration adds a database trigger that fires the right email automatically
     whenever a membership row is created:
       - role 'admin'  -> the creator just made the group  -> `group_created`
       - role 'member' -> the player just joined a group    -> `group_joined`

  2. New database objects
     - Function `notify_group_membership_email()` (SECURITY DEFINER): looks up the
       new member's email/name and the group's name/code, then calls the
       `send-email` edge function asynchronously via pg_net.
     - Trigger `trg_group_membership_email` on `group_members` (AFTER INSERT).

  3. Behaviour / guards
     1. System groups (auto-created club/global leagues, `groups.is_system = true`)
        never send an email — those memberships are automatic, not user actions.
     2. Guests and rows without a real email address are skipped.
     3. Uses the stored `app.settings.supabase_url` / `app.settings.service_role_key`
        settings, exactly like the project's scheduled jobs. Missing settings
        degrade gracefully (no email, no error) thanks to the missing_ok form of
        current_setting.

  4. Security
     No RLS or table-shape changes. The function is SECURITY DEFINER with a fixed
     search_path so it can read the lookup tables and reach the net schema.
*/

CREATE OR REPLACE FUNCTION notify_group_membership_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, pg_catalog
AS $$
DECLARE
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_service_key  text := current_setting('app.settings.service_role_key', true);
  v_group        public.groups%ROWTYPE;
  v_email        text;
  v_name         text;
  v_username     text;
  v_is_guest     boolean;
  v_first_name   text;
  v_event        text;
BEGIN
  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = NEW.group_id;
  IF v_group.id IS NULL OR COALESCE(v_group.is_system, false) THEN
    RETURN NEW;
  END IF;

  SELECT email, name, username, COALESCE(is_guest, false)
    INTO v_email, v_name, v_username, v_is_guest
    FROM public.synced_users
    WHERE id = NEW.user_id;

  IF v_email IS NULL OR v_email = '' OR v_is_guest THEN
    RETURN NEW;
  END IF;

  v_first_name := COALESCE(
    NULLIF(split_part(COALESCE(v_name, ''), ' ', 1), ''),
    NULLIF(v_username, ''),
    split_part(v_email, '@', 1)
  );

  v_event := CASE WHEN NEW.role = 'admin' THEN 'group_created' ELSE 'group_joined' END;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'event_name', v_event,
      'to_email', v_email,
      'to_name', COALESCE(v_name, v_first_name),
      'dynamic_template_data', jsonb_build_object(
        'firstName', v_first_name,
        'groupName', v_group.name,
        'groupCode', v_group.code,
        'groupsLink', 'https://play.sycamore.ng/groups'
      )
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_membership_email ON group_members;
CREATE TRIGGER trg_group_membership_email
  AFTER INSERT ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_group_membership_email();

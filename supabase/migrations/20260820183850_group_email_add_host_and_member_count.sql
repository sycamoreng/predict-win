/*
  # Add host name and member count to group emails

  1. Purpose
     The group-joined email design needs the league host (creator) and the
     current member count, and its call-to-action button should open that
     specific private league. This updates the trigger function to include:
       - hostName    : the group creator's first name / username
       - memberCount : how many players are now in the group (cap is 100)
     and points `groupsLink` at a deep link that opens the group directly.

  2. Modified database objects
     - Function `notify_group_membership_email()` is replaced. The trigger on
       `group_members` is unchanged and keeps using it.

  3. Behaviour
     1. `memberCount` is read after the new membership row exists, so it
        includes the person who just joined.
     2. `groupsLink` becomes https://play.sycamore.ng/groups?join=<code>, which
        opens that league for a member (and would join a non-member).
     3. System groups, guests and rows without an email are still skipped.

  4. Security
     No RLS or table-shape changes. SECURITY DEFINER with a fixed search_path,
     as before.
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
  v_host_name    text;
  v_host_username text;
  v_host_email   text;
  v_host_display text;
  v_member_count integer;
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

  -- League host (creator) display name
  SELECT name, username, email
    INTO v_host_name, v_host_username, v_host_email
    FROM public.synced_users
    WHERE id = v_group.created_by;

  v_host_display := COALESCE(
    NULLIF(split_part(COALESCE(v_host_name, ''), ' ', 1), ''),
    NULLIF(v_host_username, ''),
    NULLIF(split_part(COALESCE(v_host_email, ''), '@', 1), ''),
    'the host'
  );

  SELECT count(*) INTO v_member_count
    FROM public.group_members
    WHERE group_id = NEW.group_id;

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
        'hostName', v_host_display,
        'memberCount', v_member_count,
        'groupsLink', 'https://play.sycamore.ng/groups?join=' || v_group.code
      )
    )
  );

  RETURN NEW;
END;
$$;

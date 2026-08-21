-- First-time Google login failed with "Database error saving new user" because the
-- auth.users trigger (and its nested audit write) aborted the whole signup.
-- Audit must never block creating a profile; failed logins must be recordable
-- before a session exists.

CREATE OR REPLACE FUNCTION private.audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  rec jsonb;
  resource_id text;
  op text := lower(TG_OP);
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();
  rec := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  resource_id := coalesce(rec->>'id', rec->>'email');

  INSERT INTO public.audit_events (
    actor_id, actor_email, actor_role, action, resource_type, resource_id, payload, ok
  ) VALUES (
    auth.uid(),
    actor.email,
    actor.app_role::text,
    'db.' || op || '.' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    resource_id,
    jsonb_strip_nulls(jsonb_build_object(
      'old', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE private.audit_readable(to_jsonb(OLD)) END,
      'new', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE private.audit_readable(to_jsonb(NEW)) END
    )),
    true
  );
  RETURN coalesce(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'audit_row failed on %.%: %', TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;
    RETURN coalesce(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email text := lower(coalesce(NEW.email, ''));
  role public.app_role := 'member';
  invited public.app_role;
BEGIN
  IF email NOT LIKE '%@sociopublico.com' THEN
    RAISE EXCEPTION 'Solo se permiten cuentas @sociopublico.com';
  END IF;

  SELECT a.app_role INTO invited FROM public.app_emails a WHERE a.email = email;

  IF email IN ('agustina@sociopublico.com', 'alejandra@sociopublico.com')
     OR EXISTS (SELECT 1 FROM public.admin_emails a WHERE a.email = email)
     OR invited = 'admin' THEN
    role := 'admin';
  ELSIF invited IS NOT NULL THEN
    role := invited;
  ELSIF EXISTS (SELECT 1 FROM public.editor_emails e WHERE e.email = email) THEN
    role := 'pm';
  END IF;

  INSERT INTO public.profiles (id, app_role, email)
  VALUES (NEW.id, role, email);

  INSERT INTO public.app_emails (email, app_role)
  VALUES (email, role)
  ON CONFLICT (email) DO UPDATE SET app_role = EXCLUDED.app_role;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user failed for %: %', email, SQLERRM;
    RAISE;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT USAGE ON SCHEMA private TO supabase_auth_admin;
GRANT INSERT, UPDATE ON public.profiles TO supabase_auth_admin;
GRANT INSERT, UPDATE ON public.app_emails TO supabase_auth_admin;
GRANT INSERT ON public.audit_events TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.handle_new_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.audit_row() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.audit_readable(jsonb) TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_action text,
  p_error text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_action <> 'auth.login_failed' THEN
    RAISE EXCEPTION 'Acción no permitida';
  END IF;
  IF octet_length(coalesce(p_payload, '{}'::jsonb)::text) > 2000 THEN
    RAISE EXCEPTION 'payload too large';
  END IF;

  INSERT INTO public.audit_events (
    actor_id, actor_email, actor_role, action, path, payload, ok, error
  ) VALUES (
    auth.uid(),
    nullif(p_payload->>'email', ''),
    NULL,
    p_action,
    '/login',
    coalesce(p_payload, '{}'::jsonb),
    false,
    left(coalesce(p_error, ''), 500)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_auth_event(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_auth_event(text, text, jsonb) TO anon, authenticated;

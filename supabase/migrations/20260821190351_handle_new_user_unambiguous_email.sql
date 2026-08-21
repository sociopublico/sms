-- handle_new_user failed for enrique@sociopublico.com with:
--   column reference "email" is ambiguous
-- The PL/pgSQL variable was named `email`, which collides with NEW.email
-- (auth.users) and with public.app_emails.email / public.profiles.email
-- in the SQL statements added after the first users had already signed up.

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(NEW.email, ''));
  v_role public.app_role := 'member';
  v_invited public.app_role;
BEGIN
  IF v_email NOT LIKE '%@sociopublico.com' THEN
    RAISE EXCEPTION 'Solo se permiten cuentas @sociopublico.com';
  END IF;

  SELECT a.app_role INTO v_invited FROM public.app_emails a WHERE a.email = v_email;

  IF v_email IN ('agustina@sociopublico.com', 'alejandra@sociopublico.com')
     OR EXISTS (SELECT 1 FROM public.admin_emails a WHERE a.email = v_email)
     OR v_invited = 'admin' THEN
    v_role := 'admin';
  ELSIF v_invited IS NOT NULL THEN
    v_role := v_invited;
  ELSIF EXISTS (SELECT 1 FROM public.editor_emails e WHERE e.email = v_email) THEN
    v_role := 'pm';
  END IF;

  INSERT INTO public.profiles (id, app_role, email)
  VALUES (NEW.id, v_role, v_email);

  INSERT INTO public.app_emails (email, app_role)
  VALUES (v_email, v_role)
  ON CONFLICT (email) DO UPDATE SET app_role = EXCLUDED.app_role;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user failed for %: %', v_email, SQLERRM;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION private.handle_new_user() TO supabase_auth_admin;

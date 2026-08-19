CREATE TABLE IF NOT EXISTS public.app_emails (
  email text PRIMARY KEY,
  app_role public.app_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.app_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_app_emails" ON public.app_emails
  FOR SELECT TO authenticated
  USING (private.is_admin());
CREATE POLICY "admins_insert_app_emails" ON public.app_emails
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "admins_update_app_emails" ON public.app_emails
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());
CREATE POLICY "admins_delete_app_emails" ON public.app_emails
  FOR DELETE TO authenticated
  USING (private.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_emails TO authenticated, service_role;

INSERT INTO public.app_emails (email, app_role)
SELECT email, 'admin'::public.app_role FROM public.admin_emails
ON CONFLICT (email) DO UPDATE SET app_role = EXCLUDED.app_role;

INSERT INTO public.app_emails (email, app_role)
SELECT email, 'pm'::public.app_role FROM public.editor_emails
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.app_emails (email, app_role)
SELECT lower(email), app_role
FROM public.profiles
WHERE email IS NOT NULL
ON CONFLICT (email) DO UPDATE SET app_role = EXCLUDED.app_role;

DELETE FROM public.editor_emails e
WHERE EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE lower(p.email) = e.email AND p.app_role = 'member'
);

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
END;
$$;

CREATE OR REPLACE FUNCTION private.set_app_role(p_email text, p_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text := lower(trim(p_email));
  my_email text;
  existing_role public.app_role;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Solo admin';
  END IF;
  IF normalized NOT LIKE '%@sociopublico.com' THEN
    RAISE EXCEPTION 'Solo se permiten cuentas @sociopublico.com';
  END IF;

  SELECT lower(email) INTO my_email FROM public.profiles WHERE id = auth.uid();
  IF my_email IS NOT NULL AND my_email = normalized THEN
    RAISE EXCEPTION 'No podés cambiar tu propio rol.';
  END IF;

  SELECT app_role INTO existing_role
  FROM public.profiles
  WHERE lower(email) = normalized;

  IF existing_role IS NULL THEN
    SELECT app_role INTO existing_role FROM public.app_emails WHERE email = normalized;
  END IF;
  IF existing_role IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.admin_emails WHERE email = normalized) THEN
      existing_role := 'admin';
    ELSIF EXISTS (SELECT 1 FROM public.editor_emails WHERE email = normalized) THEN
      existing_role := 'pm';
    ELSE
      existing_role := 'member';
    END IF;
  END IF;

  IF existing_role = 'admin' AND p_role <> 'admin' AND private.admin_count() <= 1 THEN
    RAISE EXCEPTION 'Tiene que quedar al menos un admin.';
  END IF;

  INSERT INTO public.app_emails (email, app_role, created_by)
  VALUES (normalized, p_role, auth.uid())
  ON CONFLICT (email) DO UPDATE SET app_role = EXCLUDED.app_role;

  IF p_role = 'admin' THEN
    INSERT INTO public.admin_emails (email, created_by)
    VALUES (normalized, auth.uid())
    ON CONFLICT (email) DO NOTHING;
    DELETE FROM public.editor_emails WHERE email = normalized;
    UPDATE public.profiles SET app_role = 'admin' WHERE lower(email) = normalized;
  ELSIF p_role = 'pm' THEN
    DELETE FROM public.admin_emails WHERE email = normalized;
    INSERT INTO public.editor_emails (email, created_by)
    VALUES (normalized, auth.uid())
    ON CONFLICT (email) DO NOTHING;
    UPDATE public.profiles SET app_role = 'pm' WHERE lower(email) = normalized;
  ELSE
    DELETE FROM public.admin_emails WHERE email = normalized;
    DELETE FROM public.editor_emails WHERE email = normalized;
    UPDATE public.profiles SET app_role = 'member' WHERE lower(email) = normalized;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.add_editor(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM private.set_app_role(p_email, 'pm');
END;
$$;

DROP TRIGGER IF EXISTS audit_app_emails ON public.app_emails;
CREATE TRIGGER audit_app_emails
  AFTER INSERT OR UPDATE OR DELETE ON public.app_emails
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();

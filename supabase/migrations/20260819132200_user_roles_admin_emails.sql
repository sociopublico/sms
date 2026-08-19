CREATE TABLE IF NOT EXISTS public.admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_admin_emails" ON public.admin_emails
  FOR SELECT TO authenticated
  USING (private.is_admin());
CREATE POLICY "admins_insert_admin_emails" ON public.admin_emails
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "admins_delete_admin_emails" ON public.admin_emails
  FOR DELETE TO authenticated
  USING (private.is_admin());

GRANT SELECT, INSERT, DELETE ON public.admin_emails TO authenticated, service_role;

INSERT INTO public.admin_emails (email)
VALUES ('agustina@sociopublico.com'), ('alejandra@sociopublico.com')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email text := lower(coalesce(NEW.email, ''));
  role public.app_role := 'member';
BEGIN
  IF email NOT LIKE '%@sociopublico.com' THEN
    RAISE EXCEPTION 'Solo se permiten cuentas @sociopublico.com';
  END IF;

  IF email IN ('agustina@sociopublico.com', 'alejandra@sociopublico.com')
     OR EXISTS (SELECT 1 FROM public.admin_emails a WHERE a.email = email) THEN
    role := 'admin';
  ELSIF EXISTS (SELECT 1 FROM public.editor_emails e WHERE e.email = email) THEN
    role := 'pm';
  END IF;

  INSERT INTO public.profiles (id, app_role, email)
  VALUES (NEW.id, role, email);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.admin_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM (
    SELECT lower(email) AS email
    FROM public.profiles
    WHERE app_role = 'admin' AND email IS NOT NULL
    UNION
    SELECT email FROM public.admin_emails
  ) t
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

CREATE OR REPLACE FUNCTION public.set_app_role(p_email text, p_role public.app_role)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.set_app_role(p_email, p_role)
$$;

REVOKE ALL ON FUNCTION public.set_app_role(text, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_app_role(text, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.set_app_role(text, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_count() TO authenticated, service_role;

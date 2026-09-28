-- Invite → persona: app_emails.person_id, copy on signup, UNIQUE 1:1, admin setea al invitar.

ALTER TABLE public.app_emails
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id);

CREATE UNIQUE INDEX IF NOT EXISTS app_emails_person_id_unique
  ON public.app_emails (person_id)
  WHERE person_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_person_id_unique
  ON public.profiles (person_id)
  WHERE person_id IS NOT NULL;

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
  v_person_id uuid;
BEGIN
  IF v_email NOT LIKE '%@sociopublico.com' THEN
    RAISE EXCEPTION 'Solo se permiten cuentas @sociopublico.com';
  END IF;

  SELECT a.app_role, a.person_id
    INTO v_invited, v_person_id
  FROM public.app_emails a
  WHERE a.email = v_email;

  IF v_email IN ('agustina@sociopublico.com', 'alejandra@sociopublico.com')
     OR EXISTS (SELECT 1 FROM public.admin_emails a WHERE a.email = v_email)
     OR v_invited = 'admin' THEN
    v_role := 'admin';
  ELSIF v_invited IS NOT NULL THEN
    v_role := v_invited;
  ELSIF EXISTS (SELECT 1 FROM public.editor_emails e WHERE e.email = v_email) THEN
    v_role := 'pm';
  END IF;

  INSERT INTO public.profiles (id, app_role, email, person_id)
  VALUES (NEW.id, v_role, v_email, v_person_id);

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

CREATE OR REPLACE FUNCTION private.assert_person_link_available(
  p_email text,
  p_person_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text := lower(trim(p_email));
BEGIN
  IF p_person_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.people pe
    WHERE pe.id = p_person_id AND pe.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Persona inválida.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.person_id = p_person_id
      AND lower(pr.email) IS DISTINCT FROM normalized
  ) THEN
    RAISE EXCEPTION 'Esa persona ya está vinculada a otra cuenta.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.app_emails ae
    WHERE ae.person_id = p_person_id
      AND ae.email IS DISTINCT FROM normalized
  ) THEN
    RAISE EXCEPTION 'Esa persona ya está vinculada a otra cuenta.';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.set_app_role(text, public.app_role);
DROP FUNCTION IF EXISTS private.set_app_role(text, public.app_role);

CREATE OR REPLACE FUNCTION private.set_app_role(
  p_email text,
  p_role public.app_role,
  p_person_id uuid DEFAULT NULL,
  p_set_person boolean DEFAULT false
)
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

  IF p_set_person THEN
    PERFORM private.assert_person_link_available(normalized, p_person_id);
  END IF;

  INSERT INTO public.app_emails (email, app_role, person_id, created_by)
  VALUES (
    normalized,
    p_role,
    CASE WHEN p_set_person THEN p_person_id ELSE NULL END,
    auth.uid()
  )
  ON CONFLICT (email) DO UPDATE SET
    app_role = EXCLUDED.app_role,
    person_id = CASE
      WHEN p_set_person THEN p_person_id
      ELSE public.app_emails.person_id
    END;

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
  ELSIF p_role = 'staff' THEN
    DELETE FROM public.admin_emails WHERE email = normalized;
    DELETE FROM public.editor_emails WHERE email = normalized;
    UPDATE public.profiles SET app_role = 'staff' WHERE lower(email) = normalized;
  ELSE
    DELETE FROM public.admin_emails WHERE email = normalized;
    DELETE FROM public.editor_emails WHERE email = normalized;
    UPDATE public.profiles SET app_role = 'member' WHERE lower(email) = normalized;
  END IF;

  IF p_set_person THEN
    UPDATE public.profiles
    SET person_id = p_person_id
    WHERE lower(email) = normalized;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_app_role(
  p_email text,
  p_role public.app_role,
  p_person_id uuid DEFAULT NULL,
  p_set_person boolean DEFAULT false
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.set_app_role(p_email, p_role, p_person_id, p_set_person)
$$;

CREATE OR REPLACE FUNCTION private.set_user_person(p_email text, p_person_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text := lower(trim(p_email));
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Solo admin';
  END IF;
  IF normalized NOT LIKE '%@sociopublico.com' THEN
    RAISE EXCEPTION 'Solo se permiten cuentas @sociopublico.com';
  END IF;

  PERFORM private.assert_person_link_available(normalized, p_person_id);

  INSERT INTO public.app_emails (email, app_role, person_id, created_by)
  VALUES (
    normalized,
    coalesce(
      (SELECT app_role FROM public.profiles WHERE lower(email) = normalized),
      (SELECT app_role FROM public.app_emails WHERE email = normalized),
      'member'::public.app_role
    ),
    p_person_id,
    auth.uid()
  )
  ON CONFLICT (email) DO UPDATE SET person_id = EXCLUDED.person_id;

  UPDATE public.profiles
  SET person_id = p_person_id
  WHERE lower(email) = normalized;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_person(p_email text, p_person_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.set_user_person(p_email, p_person_id)
$$;

REVOKE ALL ON FUNCTION public.set_app_role(text, public.app_role, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_person(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_app_role(text, public.app_role, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_person(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.set_app_role(text, public.app_role, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.set_user_person(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.assert_person_link_available(text, uuid) TO authenticated, service_role;

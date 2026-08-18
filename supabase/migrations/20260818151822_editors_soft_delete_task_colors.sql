ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles p
SET email = lower(u.email)
FROM auth.users u
WHERE u.id = p.id AND p.email IS NULL;

ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.editor_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.editor_emails ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.current_app_role() = 'admin'
$$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;

CREATE POLICY "admins_read_editor_emails" ON public.editor_emails
  FOR SELECT TO authenticated
  USING (private.is_admin());
CREATE POLICY "admins_insert_editor_emails" ON public.editor_emails
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "admins_delete_editor_emails" ON public.editor_emails
  FOR DELETE TO authenticated
  USING (private.is_admin());

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

  IF email IN ('agustina@sociopublico.com', 'alejandra@sociopublico.com') THEN
    role := 'admin';
  ELSIF EXISTS (SELECT 1 FROM public.editor_emails e WHERE e.email = email) THEN
    role := 'pm';
  END IF;

  INSERT INTO public.profiles (id, app_role, email)
  VALUES (NEW.id, role, email);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.add_editor(p_email text)
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
  IF normalized IN ('agustina@sociopublico.com', 'alejandra@sociopublico.com') THEN
    RAISE EXCEPTION 'Esa cuenta ya es admin';
  END IF;

  INSERT INTO public.editor_emails (email, created_by)
  VALUES (normalized, auth.uid())
  ON CONFLICT (email) DO NOTHING;

  UPDATE public.profiles
  SET app_role = 'pm'
  WHERE lower(email) = normalized
    AND app_role <> 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION private.remove_editor(p_email text)
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
  IF normalized IN ('agustina@sociopublico.com', 'alejandra@sociopublico.com') THEN
    RAISE EXCEPTION 'No se puede quitar a un admin';
  END IF;

  DELETE FROM public.editor_emails WHERE email = normalized;

  UPDATE public.profiles
  SET app_role = 'member'
  WHERE lower(email) = normalized
    AND app_role = 'pm';
END;
$$;

CREATE OR REPLACE FUNCTION public.add_editor(p_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.add_editor(p_email)
$$;

CREATE OR REPLACE FUNCTION public.remove_editor(p_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.remove_editor(p_email)
$$;

REVOKE ALL ON FUNCTION public.add_editor(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_editor(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_editor(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_editor(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.add_editor(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.remove_editor(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.protect_app_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.app_role IS DISTINCT FROM OLD.app_role
     AND auth.uid() IS NOT NULL
     AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'No tenés permiso para cambiar el rol.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_app_role ON public.profiles;
CREATE TRIGGER profiles_protect_app_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.protect_app_role();

UPDATE public.profiles
SET app_role = 'admin'
WHERE lower(email) IN ('agustina@sociopublico.com', 'alejandra@sociopublico.com');

UPDATE public.profiles
SET app_role = 'member'
WHERE app_role = 'pm'
  AND lower(coalesce(email, '')) NOT IN (
    SELECT email FROM public.editor_emails
  )
  AND lower(coalesce(email, '')) NOT IN (
    'agustina@sociopublico.com',
    'alejandra@sociopublico.com'
  );

CREATE OR REPLACE VIEW public.person_week_load
WITH (security_invoker = true) AS
SELECT
  p.id AS person_id,
  p.display_name,
  tw.week_start,
  COUNT(DISTINCT w.id)::integer AS load_count
FROM public.people p
JOIN public.assignments a ON a.person_id = p.id
JOIN public.roles r ON r.id = a.role_id
JOIN public.workstreams w ON w.id = a.workstream_id
JOIN public.timeline_weeks tw ON tw.workstream_id = w.id
WHERE p.deleted_at IS NULL
  AND r.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.timeline_week_tasks twt
    JOIN public.tasks t ON t.id = twt.task_id
    LEFT JOIN public.task_roles tr
      ON tr.task_id = t.id AND tr.role_id = r.id
    WHERE twt.timeline_week_id = tw.id
      AND t.deleted_at IS NULL
      AND (r.always_on_duty OR tr.role_id IS NOT NULL)
  )
GROUP BY p.id, p.display_name, tw.week_start;

CREATE OR REPLACE VIEW public.person_week_load_detail
WITH (security_invoker = true) AS
SELECT DISTINCT
  p.id AS person_id,
  tw.week_start,
  pr.id AS project_id,
  pr.code AS project_code,
  w.id AS workstream_id,
  w.name AS workstream_name,
  t.name AS task_name,
  r.name AS role_name
FROM public.people p
JOIN public.assignments a ON a.person_id = p.id
JOIN public.roles r ON r.id = a.role_id
JOIN public.workstreams w ON w.id = a.workstream_id
JOIN public.projects pr ON pr.id = w.project_id
JOIN public.timeline_weeks tw ON tw.workstream_id = w.id
JOIN public.timeline_week_tasks twt ON twt.timeline_week_id = tw.id
JOIN public.tasks t ON t.id = twt.task_id
LEFT JOIN public.task_roles tr
  ON tr.task_id = t.id AND tr.role_id = r.id
WHERE p.deleted_at IS NULL
  AND r.deleted_at IS NULL
  AND t.deleted_at IS NULL
  AND (r.always_on_duty OR tr.role_id IS NOT NULL);

GRANT SELECT ON public.person_week_load TO authenticated, service_role;
GRANT SELECT ON public.person_week_load_detail TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editor_emails TO authenticated, service_role;

UPDATE public.tasks SET color = '#B8A8D4' WHERE name = 'Discovery';
UPDATE public.tasks SET color = '#7EB6F0' WHERE name = 'Diseño web';
UPDATE public.tasks SET color = '#5BC89C' WHERE name = 'Desarrollo React';
UPDATE public.tasks SET color = '#C8DCA0' WHERE name = 'Desarrollo Wordpress';
UPDATE public.tasks SET color = '#E8C4B0' WHERE name = 'Diseño gráfico';
UPDATE public.tasks SET color = '#D4B8E0' WHERE name = 'Contenido';
UPDATE public.tasks SET color = '#8BA3C8' WHERE name = 'Carga de contenido';
UPDATE public.tasks SET color = '#E8B8C8' WHERE name = 'Edición video';
UPDATE public.tasks SET color = '#E8A8A0' WHERE name = 'Animación';
UPDATE public.tasks SET color = '#70C4B4' WHERE name = 'Estrategia';
UPDATE public.tasks SET color = '#3AA8C8' WHERE name = 'Evaluación';
UPDATE public.tasks SET color = '#4A9BE8' WHERE name = 'ETL';
UPDATE public.tasks SET color = '#D4A090' WHERE name = 'QA';
UPDATE public.tasks SET color = '#C8B8A0' WHERE name = 'Garantía';
UPDATE public.tasks SET color = '#A8C5E8' WHERE name = 'PM';
UPDATE public.tasks SET color = '#E8B8C8' WHERE name = 'Producción';
UPDATE public.tasks SET color = '#8FDBB8' WHERE name = 'Mantenimiento React';
UPDATE public.tasks SET color = '#A8D4C0' WHERE name = 'Mantenimiento Wordpress';
UPDATE public.tasks SET color = '#B8A8D4' WHERE name = 'Investigación';
UPDATE public.tasks SET color = '#E8D8A0' WHERE name = 'Contenido + diseño';
UPDATE public.tasks SET color = '#6BB8D4' WHERE name = 'Data + diseño';
UPDATE public.tasks SET color = '#4A9BE8' WHERE name = 'Data';
UPDATE public.tasks SET color = '#9AABBC' WHERE name = 'On hold';
UPDATE public.tasks SET color = '#8BA3C8' WHERE name = 'Cierre';

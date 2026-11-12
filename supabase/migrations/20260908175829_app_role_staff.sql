-- Staff: mismo poder de escritura de dominio que Editor (`can_write`),
-- sin privilegios de Admin (usuarios, logs, Drive).

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

CREATE OR REPLACE FUNCTION public.can_write()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT private.current_app_role() IN ('admin', 'pm', 'staff')
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
  ELSIF p_role = 'staff' THEN
    DELETE FROM public.admin_emails WHERE email = normalized;
    DELETE FROM public.editor_emails WHERE email = normalized;
    UPDATE public.profiles SET app_role = 'staff' WHERE lower(email) = normalized;
  ELSE
    DELETE FROM public.admin_emails WHERE email = normalized;
    DELETE FROM public.editor_emails WHERE email = normalized;
    UPDATE public.profiles SET app_role = 'member' WHERE lower(email) = normalized;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.audit_readable(rec jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  out jsonb := '{}'::jsonb;
  k text;
  raw text;
  task_name text;
  week_start date;
  ws_name text;
  proj_code text;
  person_name text;
  role_name text;
  client_name text;
BEGIN
  IF rec IS NULL THEN
    RETURN NULL;
  END IF;

  FOR k IN SELECT jsonb_object_keys(rec)
  LOOP
    raw := rec ->> k;
    task_name := NULL;
    week_start := NULL;
    ws_name := NULL;
    proj_code := NULL;
    person_name := NULL;
    role_name := NULL;
    client_name := NULL;
    IF k IN ('id', 'created_at', 'updated_at', 'deleted_at', 'created_by') THEN
      CONTINUE;
    ELSIF k = 'task_id' THEN
      SELECT t.name INTO task_name FROM public.tasks t WHERE t.id::text = raw;
      out := out || jsonb_build_object('tarea', coalesce(task_name, raw));
    ELSIF k = 'timeline_week_id' THEN
      SELECT tw.week_start, w.name, p.code
        INTO week_start, ws_name, proj_code
      FROM public.timeline_weeks tw
      LEFT JOIN public.workstreams w ON w.id = tw.workstream_id
      LEFT JOIN public.projects p ON p.id = w.project_id
      WHERE tw.id::text = raw;
      out := out || jsonb_strip_nulls(jsonb_build_object(
        'semana', to_char(week_start, 'DD/MM/YYYY'),
        'workstream', ws_name,
        'proyecto', proj_code
      ));
    ELSIF k = 'workstream_id' THEN
      SELECT w.name, p.code INTO ws_name, proj_code
      FROM public.workstreams w
      LEFT JOIN public.projects p ON p.id = w.project_id
      WHERE w.id::text = raw;
      out := out || jsonb_strip_nulls(jsonb_build_object(
        'workstream', ws_name,
        'proyecto', proj_code
      ));
    ELSIF k = 'project_id' THEN
      SELECT p.code INTO proj_code FROM public.projects p WHERE p.id::text = raw;
      out := out || jsonb_build_object('proyecto', coalesce(proj_code, raw));
    ELSIF k = 'client_id' THEN
      SELECT c.name INTO client_name FROM public.clients c WHERE c.id::text = raw;
      out := out || jsonb_build_object('cliente', coalesce(client_name, raw));
    ELSIF k = 'person_id' THEN
      SELECT p.display_name INTO person_name FROM public.people p WHERE p.id::text = raw;
      out := out || jsonb_build_object('persona', coalesce(person_name, raw));
    ELSIF k = 'role_id' THEN
      SELECT r.name INTO role_name FROM public.roles r WHERE r.id::text = raw;
      out := out || jsonb_build_object('rol', coalesce(role_name, raw));
    ELSIF k IN ('week_start', 'start_on', 'end_on') AND raw ~ '^\d{4}-\d{2}-\d{2}' THEN
      out := out || jsonb_build_object(
        CASE k WHEN 'week_start' THEN 'semana' WHEN 'start_on' THEN 'inicio' ELSE 'fin' END,
        to_char(raw::date, 'DD/MM/YYYY')
      );
    ELSIF k = 'app_role' THEN
      out := out || jsonb_build_object(
        'permiso',
        CASE raw
          WHEN 'admin' THEN 'Admin'
          WHEN 'pm' THEN 'Editor'
          WHEN 'staff' THEN 'Staff'
          WHEN 'member' THEN 'Lector'
          ELSE raw
        END
      );
    ELSIF k = 'kind' THEN
      out := out || jsonb_build_object(
        'tipo',
        CASE raw WHEN 'client' THEN 'Cliente' WHEN 'internal' THEN 'Interno' ELSE raw END
      );
    ELSIF k = 'status' THEN
      out := out || jsonb_build_object(
        'estado',
        CASE raw
          WHEN 'en_curso' THEN 'En curso'
          WHEN 'pausado' THEN 'Pausado'
          WHEN 'mantenimiento' THEN 'Mantenimiento'
          WHEN 'finalizado' THEN 'Finalizado'
          ELSE raw
        END
      );
    ELSIF k IN ('code') THEN
      out := out || jsonb_build_object('id', raw);
    ELSIF k IN ('name', 'display_name') THEN
      out := out || jsonb_build_object('nombre', raw);
    ELSIF k = 'ficha_url' THEN
      out := out || jsonb_build_object('ficha', nullif(raw, ''));
    ELSIF k = 'hidden' THEN
      out := out || jsonb_build_object('oculto', CASE WHEN raw IN ('true', 't') THEN 'sí' ELSE 'no' END);
    ELSIF k = 'email' THEN
      out := out || jsonb_build_object('mail', raw);
    ELSIF k LIKE '%\_id' ESCAPE '\' THEN
      CONTINUE;
    ELSIF raw IS NULL OR raw = '' THEN
      CONTINUE;
    ELSE
      out := out || jsonb_build_object(k, rec -> k);
    END IF;
  END LOOP;

  RETURN jsonb_strip_nulls(out);
END;
$$;

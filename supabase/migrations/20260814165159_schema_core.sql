CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TYPE public.app_role AS ENUM ('admin', 'pm', 'member');
CREATE TYPE public.project_kind AS ENUM ('client', 'internal');
CREATE TYPE public.project_status AS ENUM ('en_curso', 'pausado', 'mantenimiento', 'finalizado');
CREATE TYPE public.workstream_status AS ENUM ('en_curso', 'pausado', 'mantenimiento', 'finalizado');

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  ficha_url text,
  kind public.project_kind NOT NULL DEFAULT 'client',
  status public.project_status NOT NULL DEFAULT 'en_curso',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_client_id ON public.projects(client_id);

CREATE TABLE public.workstreams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  status public.workstream_status NOT NULL DEFAULT 'en_curso',
  start_on date,
  end_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE INDEX idx_workstreams_project_id ON public.workstreams(project_id);
CREATE INDEX idx_workstreams_status ON public.workstreams(status);

CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL UNIQUE,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  always_on_duty boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#64748b',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.person_roles (
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, role_id)
);

CREATE INDEX idx_person_roles_role_id ON public.person_roles(role_id);

CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstream_id uuid NOT NULL REFERENCES public.workstreams(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id),
  role_id uuid NOT NULL REFERENCES public.roles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workstream_id, person_id, role_id)
);

CREATE INDEX idx_assignments_person_id ON public.assignments(person_id);
CREATE INDEX idx_assignments_role_id ON public.assignments(role_id);

CREATE TABLE public.timeline_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstream_id uuid NOT NULL REFERENCES public.workstreams(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  UNIQUE (workstream_id, week_start)
);

CREATE INDEX idx_timeline_weeks_week_start ON public.timeline_weeks(week_start);

CREATE TABLE public.timeline_week_tasks (
  timeline_week_id uuid NOT NULL REFERENCES public.timeline_weeks(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id),
  PRIMARY KEY (timeline_week_id, task_id)
);

CREATE INDEX idx_timeline_week_tasks_task_id ON public.timeline_week_tasks(task_id);

CREATE TABLE public.task_roles (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, role_id)
);

CREATE INDEX idx_task_roles_role_id ON public.task_roles(role_id);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id),
  app_role public.app_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_person_id ON public.profiles(person_id);

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER workstreams_set_updated_at
  BEFORE UPDATE ON public.workstreams
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER people_set_updated_at
  BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER roles_set_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE OR REPLACE FUNCTION private.sync_workstream_dates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ws_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'timeline_week_tasks' THEN
    SELECT tw.workstream_id INTO ws_id
    FROM public.timeline_weeks tw
    WHERE tw.id = COALESCE(NEW.timeline_week_id, OLD.timeline_week_id);
  ELSE
    ws_id := COALESCE(NEW.workstream_id, OLD.workstream_id);
  END IF;

  IF ws_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.workstreams w
  SET
    start_on = sub.mn,
    end_on = sub.mx
  FROM (
    SELECT
      MIN(tw.week_start) AS mn,
      MAX(tw.week_start) AS mx
    FROM public.timeline_weeks tw
    JOIN public.timeline_week_tasks twt ON twt.timeline_week_id = tw.id
    WHERE tw.workstream_id = ws_id
  ) sub
  WHERE w.id = ws_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER timeline_week_tasks_sync_dates
  AFTER INSERT OR DELETE ON public.timeline_week_tasks
  FOR EACH ROW EXECUTE FUNCTION private.sync_workstream_dates();

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

  IF email = 'agustina@sociopublico.com' THEN
    role := 'admin';
  ELSIF email IN ('alejandra@sociopublico.com', 'mer@sociopublico.com') THEN
    role := 'pm';
  END IF;

  INSERT INTO public.profiles (id, app_role)
  VALUES (NEW.id, role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

GRANT USAGE ON SCHEMA private TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.handle_new_user() TO supabase_auth_admin;

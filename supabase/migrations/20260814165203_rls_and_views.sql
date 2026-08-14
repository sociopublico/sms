CREATE OR REPLACE FUNCTION private.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.app_role::text
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION private.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_app_role() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_write()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT private.current_app_role() IN ('admin', 'pm')
$$;

REVOKE ALL ON FUNCTION public.can_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write() TO authenticated;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_week_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_clients" ON public.clients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_clients" ON public.clients
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_clients" ON public.clients
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_projects" ON public.projects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_projects" ON public.projects
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_projects" ON public.projects
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_workstreams" ON public.workstreams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_workstreams" ON public.workstreams
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_workstreams" ON public.workstreams
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_workstreams" ON public.workstreams
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_people" ON public.people
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_people" ON public.people
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_people" ON public.people
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_people" ON public.people
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_roles" ON public.roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_roles" ON public.roles
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_roles" ON public.roles
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_roles" ON public.roles
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_tasks" ON public.tasks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_tasks" ON public.tasks
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_person_roles" ON public.person_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_person_roles" ON public.person_roles
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_person_roles" ON public.person_roles
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_person_roles" ON public.person_roles
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_assignments" ON public.assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_assignments" ON public.assignments
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_assignments" ON public.assignments
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_assignments" ON public.assignments
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_timeline_weeks" ON public.timeline_weeks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_timeline_weeks" ON public.timeline_weeks
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_timeline_weeks" ON public.timeline_weeks
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_timeline_weeks" ON public.timeline_weeks
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_timeline_week_tasks" ON public.timeline_week_tasks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_timeline_week_tasks" ON public.timeline_week_tasks
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_timeline_week_tasks" ON public.timeline_week_tasks
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_timeline_week_tasks" ON public.timeline_week_tasks
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_task_roles" ON public.task_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_task_roles" ON public.task_roles
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_task_roles" ON public.task_roles
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_task_roles" ON public.task_roles
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "read_own_or_writers_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.can_write());
CREATE POLICY "writers_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.can_write() OR id = auth.uid())
  WITH CHECK (public.can_write() OR id = auth.uid());

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
  AND EXISTS (
    SELECT 1
    FROM public.timeline_week_tasks twt
    JOIN public.tasks t ON t.id = twt.task_id
    LEFT JOIN public.task_roles tr
      ON tr.task_id = t.id AND tr.role_id = r.id
    WHERE twt.timeline_week_id = tw.id
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
  AND (r.always_on_duty OR tr.role_id IS NOT NULL);

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON public.person_week_load TO authenticated, service_role;
GRANT SELECT ON public.person_week_load_detail TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

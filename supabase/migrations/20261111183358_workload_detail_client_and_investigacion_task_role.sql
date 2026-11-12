-- Workload detail: cliente + flag always_on_duty para tooltips.
-- Investigación: la tarea cuenta también para el rol Investigación (no solo PM).
-- DROP + CREATE: CREATE OR REPLACE no puede renombrar columnas de la vista.

DROP VIEW IF EXISTS public.person_week_load_detail;

CREATE VIEW public.person_week_load_detail
WITH (security_invoker = true) AS
SELECT DISTINCT
  p.id AS person_id,
  tw.week_start,
  pr.id AS project_id,
  pr.code AS project_code,
  COALESCE(c.name, 'Interno') AS client_name,
  w.id AS workstream_id,
  w.name AS workstream_name,
  t.name AS task_name,
  r.name AS role_name,
  r.always_on_duty
FROM public.people p
JOIN public.assignments a ON a.person_id = p.id
JOIN public.roles r ON r.id = a.role_id
JOIN public.workstreams w ON w.id = a.workstream_id
JOIN public.projects pr ON pr.id = w.project_id
LEFT JOIN public.clients c ON c.id = pr.client_id
JOIN public.timeline_weeks tw ON tw.workstream_id = w.id
JOIN public.timeline_week_tasks twt ON twt.timeline_week_id = tw.id
JOIN public.tasks t ON t.id = twt.task_id
LEFT JOIN public.task_roles tr
  ON tr.task_id = t.id AND tr.role_id = r.id
WHERE p.deleted_at IS NULL
  AND p.hidden = false
  AND r.deleted_at IS NULL
  AND t.deleted_at IS NULL
  AND (r.always_on_duty OR tr.role_id IS NOT NULL);

GRANT SELECT ON public.person_week_load_detail TO authenticated, service_role;

INSERT INTO public.task_roles (task_id, role_id)
SELECT t.id, r.id
FROM public.tasks t
CROSS JOIN public.roles r
WHERE t.name = 'Investigación'
  AND t.deleted_at IS NULL
  AND r.name = 'Investigación'
  AND r.deleted_at IS NULL
ON CONFLICT DO NOTHING;

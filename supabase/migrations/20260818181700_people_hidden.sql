ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

UPDATE public.people
SET hidden = true
WHERE deleted_at IS NOT NULL;

UPDATE public.people
SET deleted_at = NULL
WHERE deleted_at IS NOT NULL;

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
  AND p.hidden = false
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
  AND p.hidden = false
  AND r.deleted_at IS NULL
  AND t.deleted_at IS NULL
  AND (r.always_on_duty OR tr.role_id IS NOT NULL);

GRANT SELECT ON public.person_week_load TO authenticated, service_role;
GRANT SELECT ON public.person_week_load_detail TO authenticated, service_role;

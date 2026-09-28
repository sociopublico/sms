-- Autocompletar fin real desde fin de contrato cuando falte.
-- La retención de archivos pasa a basarse en actual_end_on (+ 90 días).

UPDATE public.projects
SET actual_end_on = end_on
WHERE actual_end_on IS NULL
  AND end_on IS NOT NULL;

COMMENT ON COLUMN public.projects.file_retention_resolution IS
  'NULL = pendiente (si actual_end_on+90 <= hoy). done = archivos ordenados. not_applicable = no aplica.';

-- Reubicar marcas de timeline: lunes de actual_end_on+90.
DO $$
DECLARE
  retention_task_id uuid := 'a8c4e2f0-91b6-5d3a-9e17-6f0d4b8c2a15';
  r record;
  v_ws_id uuid;
  v_week_start date;
  v_week_id uuid;
BEGIN
  -- Quitar marcas viejas (basadas en end_on de contrato).
  DELETE FROM public.timeline_week_tasks
  WHERE task_id = retention_task_id;

  FOR r IN
    SELECT p.id AS project_id, p.actual_end_on
    FROM public.projects p
    WHERE p.actual_end_on IS NOT NULL
      AND p.file_retention_resolution IS NULL
  LOOP
    SELECT w.id INTO v_ws_id
    FROM public.workstreams w
    WHERE w.project_id = r.project_id
    ORDER BY w.name
    LIMIT 1;

    IF v_ws_id IS NULL THEN
      CONTINUE;
    END IF;

    v_week_start := date_trunc('week', (r.actual_end_on + 90)::timestamp)::date;

    INSERT INTO public.timeline_weeks (workstream_id, week_start)
    VALUES (v_ws_id, v_week_start)
    ON CONFLICT (workstream_id, week_start) DO NOTHING;

    SELECT id INTO v_week_id
    FROM public.timeline_weeks
    WHERE workstream_id = v_ws_id AND week_start = v_week_start;

    INSERT INTO public.timeline_week_tasks (timeline_week_id, task_id)
    VALUES (v_week_id, retention_task_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

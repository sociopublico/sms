-- Retención / borrado de archivos: 90 días después de projects.end_on.

CREATE TYPE public.file_retention_resolution AS ENUM ('done', 'not_applicable');

ALTER TABLE public.projects
  ADD COLUMN file_retention_resolution public.file_retention_resolution,
  ADD COLUMN file_retention_resolved_at timestamptz,
  ADD COLUMN file_retention_resolved_by uuid REFERENCES auth.users (id);

COMMENT ON COLUMN public.projects.file_retention_resolution IS
  'NULL = pendiente (si end_on+90 <= hoy). done = archivos ordenados. not_applicable = no aplica.';

-- Tarea de catálogo para marcar la semana de vencimiento en el timeline.
-- UUID fijo para que la app y el trigger de fechas la reconozcan.
INSERT INTO public.tasks (id, name, color)
VALUES (
  'a8c4e2f0-91b6-5d3a-9e17-6f0d4b8c2a15',
  'Retención de archivos',
  '#E8893A'
)
ON CONFLICT (name) DO NOTHING;

-- La semana de retención no debe alargar start_on/end_on del workstream.
CREATE OR REPLACE FUNCTION private.sync_workstream_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_id uuid;
  retention_task_id uuid := 'a8c4e2f0-91b6-5d3a-9e17-6f0d4b8c2a15';
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
      AND twt.task_id IS DISTINCT FROM retention_task_id
  ) sub
  WHERE w.id = ws_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Marca en timeline (lunes de end_on+90) en el primer workstream de cada proyecto
-- con fecha de fin, mientras la retención no esté resuelta.
DO $$
DECLARE
  retention_task_id uuid := 'a8c4e2f0-91b6-5d3a-9e17-6f0d4b8c2a15';
  r record;
  v_ws_id uuid;
  v_week_start date;
  v_week_id uuid;
BEGIN
  FOR r IN
    SELECT p.id AS project_id, p.end_on
    FROM public.projects p
    WHERE p.end_on IS NOT NULL
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

    v_week_start := date_trunc('week', (r.end_on + 90)::timestamp)::date;
    -- date_trunc('week') en Postgres usa lunes como inicio en ISO.

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

GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_workstream_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_workstream_dates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.set_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.sync_workstream_dates() TO authenticated, service_role;

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users(id),
  actor_email text,
  actor_role text,
  action text NOT NULL,
  path text,
  resource_type text,
  resource_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ok boolean NOT NULL DEFAULT true,
  error text
);

CREATE INDEX idx_audit_events_at ON public.audit_events (at DESC);
CREATE INDEX idx_audit_events_actor_email_at ON public.audit_events (actor_email, at DESC);
CREATE INDEX idx_audit_events_action_at ON public.audit_events (action, at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_audit_events" ON public.audit_events
  FOR SELECT TO authenticated
  USING (private.is_admin());

GRANT SELECT ON public.audit_events TO authenticated, service_role;
REVOKE ALL ON TABLE public.audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.audit_events TO authenticated, service_role;
GRANT ALL ON TABLE public.audit_events TO postgres, service_role;

CREATE OR REPLACE FUNCTION private.log_audit(
  p_action text,
  p_path text DEFAULT NULL,
  p_resource_type text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_ok boolean DEFAULT true,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_events (
    actor_id, actor_email, actor_role, action, path, resource_type, resource_id, payload, ok, error
  ) VALUES (
    auth.uid(),
    coalesce(actor.email, NULL),
    coalesce(actor.app_role::text, NULL),
    p_action,
    p_path,
    p_resource_type,
    p_resource_id,
    coalesce(p_payload, '{}'::jsonb),
    p_ok,
    p_error
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_audit(
  p_action text,
  p_path text DEFAULT NULL,
  p_resource_type text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_ok boolean DEFAULT true,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.log_audit(p_action, p_path, p_resource_type, p_resource_id, p_payload, p_ok, p_error)
$$;

REVOKE ALL ON FUNCTION public.log_audit(text, text, text, text, jsonb, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, text, jsonb, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.log_audit(text, text, text, text, jsonb, boolean, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  rec jsonb;
  resource_id text;
  op text := lower(TG_OP);
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();
  rec := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  resource_id := coalesce(rec->>'id', rec->>'email');

  INSERT INTO public.audit_events (
    actor_id, actor_email, actor_role, action, resource_type, resource_id, payload, ok
  ) VALUES (
    auth.uid(),
    actor.email,
    actor.app_role::text,
    'db.' || op || '.' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    resource_id,
    jsonb_build_object(
      'old', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
      'new', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
    ),
    true
  );
  RETURN coalesce(NEW, OLD);
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'clients',
    'projects',
    'workstreams',
    'people',
    'roles',
    'tasks',
    'assignments',
    'timeline_weeks',
    'timeline_week_tasks',
    'person_roles',
    'task_roles',
    'profiles',
    'editor_emails',
    'admin_emails'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER audit_%I
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION private.audit_row()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

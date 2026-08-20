CREATE TABLE public.drive_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  scopes text,
  root_folder_id text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drive_connections_provider_unique UNIQUE (provider)
);

ALTER TABLE public.drive_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_drive_connections" ON public.drive_connections
  FOR SELECT TO authenticated
  USING (private.is_admin());
CREATE POLICY "admins_insert_drive_connections" ON public.drive_connections
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "admins_update_drive_connections" ON public.drive_connections
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());
CREATE POLICY "admins_delete_drive_connections" ON public.drive_connections
  FOR DELETE TO authenticated
  USING (private.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_connections TO authenticated, service_role;

CREATE TRIGGER drive_connections_set_updated_at
  BEFORE UPDATE ON public.drive_connections
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

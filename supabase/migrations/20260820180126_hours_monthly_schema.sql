-- Horas mensuales: aliases, budgets, time_entries, inventario CSV Drive.

CREATE TYPE public.hours_entry_source AS ENUM ('hours_sheet', 'drive_csv');
CREATE TYPE public.drive_hours_file_status AS ENUM ('pending', 'synced', 'skipped', 'error');

CREATE TABLE public.person_name_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_name_aliases_alias_unique UNIQUE (alias)
);

CREATE INDEX idx_person_name_aliases_person_id ON public.person_name_aliases(person_id);

CREATE TABLE public.project_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL,
  alias_normalized text NOT NULL,
  client_hint text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_aliases_alias_normalized_unique UNIQUE (alias_normalized)
);

CREATE INDEX idx_project_aliases_project_id ON public.project_aliases(project_id);

CREATE TABLE public.person_project_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  raw_client_label text NOT NULL DEFAULT '',
  raw_project_label text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  estimated_hours numeric(10, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_project_budgets_person_labels_unique
    UNIQUE (person_id, raw_client_label, raw_project_label)
);

CREATE INDEX idx_person_project_budgets_project_id ON public.person_project_budgets(project_id);

CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  raw_client_label text NOT NULL DEFAULT '',
  raw_project_label text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  month_start date NOT NULL,
  hours numeric(10, 2) NOT NULL,
  source public.hours_entry_source NOT NULL,
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_entries_month_start_day_check CHECK (EXTRACT(DAY FROM month_start) = 1),
  CONSTRAINT time_entries_hours_nonneg_check CHECK (hours >= 0),
  CONSTRAINT time_entries_unique_month
    UNIQUE (person_id, raw_client_label, raw_project_label, month_start, source)
);

CREATE INDEX idx_time_entries_project_id ON public.time_entries(project_id);
CREATE INDEX idx_time_entries_month_start ON public.time_entries(month_start);
CREATE INDEX idx_time_entries_person_month ON public.time_entries(person_id, month_start);

CREATE TABLE public.drive_hours_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id text NOT NULL,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  folder_id text,
  folder_name text,
  file_name text NOT NULL,
  mime_type text,
  inferred_month date,
  status public.drive_hours_file_status NOT NULL DEFAULT 'pending',
  synced_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drive_hours_files_drive_file_id_unique UNIQUE (drive_file_id),
  CONSTRAINT drive_hours_files_inferred_month_day_check
    CHECK (inferred_month IS NULL OR EXTRACT(DAY FROM inferred_month) = 1)
);

CREATE INDEX idx_drive_hours_files_person_id ON public.drive_hours_files(person_id);
CREATE INDEX idx_drive_hours_files_status ON public.drive_hours_files(status);

ALTER TABLE public.person_name_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_hours_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_person_name_aliases" ON public.person_name_aliases
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_person_name_aliases" ON public.person_name_aliases
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_person_name_aliases" ON public.person_name_aliases
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_person_name_aliases" ON public.person_name_aliases
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_project_aliases" ON public.project_aliases
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_project_aliases" ON public.project_aliases
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_project_aliases" ON public.project_aliases
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_project_aliases" ON public.project_aliases
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_person_project_budgets" ON public.person_project_budgets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_person_project_budgets" ON public.person_project_budgets
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_person_project_budgets" ON public.person_project_budgets
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_person_project_budgets" ON public.person_project_budgets
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_time_entries" ON public.time_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "writers_insert_time_entries" ON public.time_entries
  FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "writers_update_time_entries" ON public.time_entries
  FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_time_entries" ON public.time_entries
  FOR DELETE TO authenticated USING (public.can_write());

CREATE POLICY "authenticated_read_drive_hours_files" ON public.drive_hours_files
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins_insert_drive_hours_files" ON public.drive_hours_files
  FOR INSERT TO authenticated WITH CHECK (private.is_admin());
CREATE POLICY "admins_update_drive_hours_files" ON public.drive_hours_files
  FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "admins_delete_drive_hours_files" ON public.drive_hours_files
  FOR DELETE TO authenticated USING (private.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_name_aliases TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_aliases TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_project_budgets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_hours_files TO authenticated, service_role;

CREATE TRIGGER project_aliases_set_updated_at
  BEFORE UPDATE ON public.project_aliases
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER person_project_budgets_set_updated_at
  BEFORE UPDATE ON public.person_project_budgets
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER time_entries_set_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER drive_hours_files_set_updated_at
  BEFORE UPDATE ON public.drive_hours_files
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Aliases del Sheet de horas → people existentes (sin crear personas).
INSERT INTO public.person_name_aliases (alias, person_id) VALUES
  ('Sherman', '4a442037-3e9b-5d40-8af6-83825a6e769a'),
  ('Sherman (70 diseño)', '4a442037-3e9b-5d40-8af6-83825a6e769a'),
  ('Sher (diseño)', '4a442037-3e9b-5d40-8af6-83825a6e769a'),
  ('Gloriana', '8160e8cc-8c24-5f0b-90a8-1846033f43f7'),
  ('Lu Godoy', 'bc05bd6e-8a51-5c4e-8a5d-a4cf2b44a9f4'),
  ('Belu', '21994680-48ca-554c-9cd3-2374e162ddfe'),
  ('Vic', '7e3bb107-2e16-51e0-b183-71a4fbdb32b1'),
  ('Rocío', 'b59e225c-eb60-5a4b-825c-d12866adaa2d'),
  ('Michelle', 'b182f98e-bacd-538b-89a9-37df648cdab6'),
  ('Emiliano', 'f733e7e1-cccd-54f0-b864-f512b1322071'),
  ('Leandro', '7191e654-58dc-50ca-980c-b168b1994462'),
  ('Eze', 'ac217f57-ef6f-5d23-b5a3-c1b76c058d32'),
  ('Juli (con strapi)', 'a3a830fe-a794-5567-907e-ec26c4db46a9'),
  ('Agus (con strapi)', 'aa382bbb-fded-5f7a-af55-b9bea04916d9'),
  ('Paul MEL', 'a7936332-af42-5ff8-9757-fecdced0228a'),
  ('Paul comms', 'a7936332-af42-5ff8-9757-fecdced0228a')
ON CONFLICT (alias) DO UPDATE SET person_id = EXCLUDED.person_id;

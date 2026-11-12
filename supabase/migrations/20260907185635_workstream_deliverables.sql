-- Entregables por workstream (facturación / seguimiento). Soft delete vía deleted_at.

CREATE TYPE public.deliverable_kind AS ENUM ('product', 'hours');

CREATE TABLE public.deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstream_id uuid NOT NULL REFERENCES public.workstreams(id) ON DELETE CASCADE,
  kind public.deliverable_kind NOT NULL,
  description text NOT NULL,
  triggers_invoice boolean NOT NULL DEFAULT false,
  invoice_percent numeric(6, 2) NOT NULL DEFAULT 0
    CHECK (invoice_percent >= 0),
  delivery_on date,
  url text,
  invoiced boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deliverables_workstream_id ON public.deliverables(workstream_id);
CREATE INDEX idx_deliverables_workstream_sort
  ON public.deliverables(workstream_id, sort_order)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_deliverables_delivery_on ON public.deliverables(delivery_on)
  WHERE deleted_at IS NULL;

ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_deliverables" ON public.deliverables
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "writers_insert_deliverables" ON public.deliverables
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write());
CREATE POLICY "writers_update_deliverables" ON public.deliverables
  FOR UPDATE TO authenticated
  USING (public.can_write())
  WITH CHECK (public.can_write());
CREATE POLICY "writers_delete_deliverables" ON public.deliverables
  FOR DELETE TO authenticated
  USING (public.can_write());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverables TO authenticated, service_role;

CREATE TRIGGER deliverables_set_updated_at
  BEFORE UPDATE ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER audit_deliverables
  AFTER INSERT OR UPDATE OR DELETE ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();

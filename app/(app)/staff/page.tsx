import { redirect } from "next/navigation";
import { homePathForRole, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  StaffDeliverableRow,
  type StaffDeliverableItem,
} from "@/components/StaffDeliverableRow";
import { FileRetentionSection } from "@/components/FileRetentionBanner";
import { fetchPendingFileRetentionProjects } from "@/lib/file-retention-query";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

function todayInBuenosAires() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

function addDaysIso(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function DeliverableList({
  title,
  items,
  empty,
  showInvoicedToggle = true,
}: {
  title: string;
  items: StaffDeliverableItem[];
  empty: string;
  showInvoicedToggle?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium text-ink">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <StaffDeliverableRow
              key={item.id}
              item={item}
              showInvoicedToggle={showInvoicedToggle}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function StaffHomePage() {
  const session = await requireSession();
  if (session.appRole !== "staff") {
    redirect(homePathForRole(session.appRole));
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("deliverables")
    .select(
      "id, description, invoice_percent, delivery_on, url, invoiced, workstreams(id, name, projects(code))",
    )
    .eq("triggers_invoice", true)
    .is("deleted_at", null)
    .order("delivery_on", { ascending: true, nullsFirst: false });

  const items: StaffDeliverableItem[] = (rows ?? []).map((row) => {
    const wsRel = row.workstreams as
      | { id: string; name: string; projects: { code: string } | { code: string }[] | null }
      | {
          id: string;
          name: string;
          projects: { code: string } | { code: string }[] | null;
        }[]
      | null;
    const ws = Array.isArray(wsRel) ? wsRel[0] : wsRel;
    const projectRel = ws?.projects;
    const project = Array.isArray(projectRel) ? projectRel[0] : projectRel;
    return {
      id: row.id,
      description: row.description,
      invoice_percent: row.invoice_percent,
      delivery_on: row.delivery_on,
      url: row.url,
      invoiced: row.invoiced,
      workstreamId: ws?.id ?? "",
      workstreamName: ws?.name ?? "—",
      projectCode: project?.code ?? "—",
    };
  });

  const today = todayInBuenosAires();
  const until = addDaysIso(today, 6);
  const upcoming = items.filter(
    (item) => item.delivery_on && item.delivery_on >= today && item.delivery_on <= until,
  );
  const undated = items.filter((item) => !item.delivery_on);
  const overdue = items
    .filter((item) => item.delivery_on && item.delivery_on < today && !item.invoiced)
    .slice()
    .sort((a, b) => String(b.delivery_on).localeCompare(String(a.delivery_on)));

  const retentionProjects = await fetchPendingFileRetentionProjects(supabase);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Inicio"
        description="Accesos rápidos y entregables que disparan factura."
      />

      <div className="flex flex-wrap gap-3">
        <Button href="/proyectos/nuevo" variant="primary">
          Nuevo proyecto
        </Button>
        <Button href="/proyectos" variant="ghost">
          Proyectos
        </Button>
        <Button href="/horas" variant="ghost">
          Horas
        </Button>
      </div>

      <FileRetentionSection
        projects={retentionProjects}
        canResolve={false}
      />

      <DeliverableList
        title="Próximos 7 días"
        items={upcoming}
        empty="No hay entregables con factura en los próximos 7 días."
      />

      <DeliverableList
        title="Sin fecha de entrega"
        items={undated}
        empty="No hay entregables con factura sin fecha."
      />

      <DeliverableList
        title="Vencidos sin facturar"
        items={overdue}
        empty="No hay entregables vencidos pendientes de facturar."
      />
    </div>
  );
}

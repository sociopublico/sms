import Link from "next/link";
import { notFound } from "next/navigation";
import { canManageDelivery, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WorkstreamDeliverables } from "@/components/WorkstreamDeliverables";
import { WorkstreamEditor } from "@/components/WorkstreamEditor";
import { WorkstreamTeam } from "@/components/WorkstreamTeam";
import { PageHeader } from "@/components/ui/PageHeader";

function formatDay(iso: string | null | undefined) {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function relName<T extends Record<string, unknown>>(
  value: T | T[] | null | undefined,
  key: keyof T,
): string {
  if (!value) return "";
  const row = Array.isArray(value) ? value[0] : value;
  const raw = row?.[key];
  return typeof raw === "string" ? raw : "";
}

export default async function WorkstreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: ws }, { data: people }, { data: roles }, { data: deliverables }] = await Promise.all([
    supabase
      .from("workstreams")
      .select(
        "id, name, status, start_on, end_on, projects(id, code, name, clients(name)), assignments(id, person_id, role_id, people(display_name), roles(name))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("people").select("id, display_name").is("deleted_at", null).order("display_name"),
    supabase.from("roles").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("deliverables")
      .select(
        "id, kind, description, triggers_invoice, invoice_percent, delivery_on, url, invoiced, sort_order",
      )
      .eq("workstream_id", id)
      .is("deleted_at", null)
      .order("delivery_on", { ascending: true, nullsFirst: false })
      .order("sort_order")
      .order("created_at"),
  ]);
  if (!ws) notFound();
  const project = ws.projects as
    | { id: string; code: string; name: string | null; clients: { name: string } | { name: string }[] }
    | { id: string; code: string; name: string | null; clients: { name: string } | { name: string }[] }[]
    | null;
  const proj = Array.isArray(project) ? project[0] : project;
  const clientRel = proj?.clients;
  const clientName = Array.isArray(clientRel) ? clientRel[0]?.name : clientRel?.name;
  const projectLabel = proj?.name?.trim() || proj?.code || "Sin proyecto";
  const startLabel = formatDay(ws.start_on) ?? "Sin inicio";
  const endLabel = formatDay(ws.end_on) ?? "Sin fin";
  const canManage = canManageDelivery(session.appRole);

  const teamAssignments = (ws.assignments ?? []).map((asg) => ({
    id: asg.id,
    person_id: asg.person_id,
    role_id: asg.role_id,
    person_name: relName(
      asg.people as { display_name: string } | { display_name: string }[] | null,
      "display_name",
    ),
    role_name: relName(asg.roles as { name: string } | { name: string }[] | null, "name"),
  }));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {proj?.id ? (
        <p className="text-sm">
          <Link href={`/proyectos/${proj.id}`} className="text-cyan hover:underline">
            ← Volver al proyecto
          </Link>
        </p>
      ) : null}

      <PageHeader
        kicker={
          <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-1.5">
            <Link href="/proyectos" className="hover:text-cyan">
              Proyectos
            </Link>
            <span aria-hidden>/</span>
            {proj?.id ? (
              <Link href={`/proyectos/${proj.id}`} className="hover:text-cyan">
                {projectLabel}
              </Link>
            ) : (
              <span>Sin proyecto</span>
            )}
            <span aria-hidden>/</span>
            <span className="text-ink">{ws.name}</span>
          </nav>
        }
        title={ws.name}
        description={
          <div className="space-y-1">
            {clientName ? <p>{clientName}</p> : null}
            <p>
              {startLabel} → {endLabel}
            </p>
          </div>
        }
      />

      <WorkstreamEditor
        workstreamId={ws.id}
        name={ws.name}
        status={ws.status}
        canWrite={session.canWrite}
      />

      <WorkstreamDeliverables
        workstreamId={ws.id}
        canEdit={session.canWrite}
        canManage={canManage}
        deliverables={deliverables ?? []}
      />

      <WorkstreamTeam
        workstreamId={ws.id}
        canManage={canManage}
        assignments={teamAssignments}
        people={(people ?? []).map((person) => ({ id: person.id, label: person.display_name }))}
        roles={(roles ?? []).map((role) => ({ id: role.id, label: role.name }))}
      />
    </div>
  );
}

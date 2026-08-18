import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL } from "@/lib/dates";
import { addAssignment, removeAssignment, updateWorkstream, updateWorkstreamStatus } from "../../project-actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fieldControlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusSelect } from "@/components/ui/StatusSelect";

export default async function WorkstreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: ws }, { data: people }, { data: roles }] = await Promise.all([
    supabase
      .from("workstreams")
      .select(
        "id, name, status, start_on, end_on, projects(id, code, clients(name)), assignments(id, person_id, role_id, people(display_name), roles(name))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("people").select("id, display_name").is("deleted_at", null).order("display_name"),
    supabase.from("roles").select("id, name").is("deleted_at", null).order("name"),
  ]);
  if (!ws) notFound();
  const project = ws.projects as
    | { id: string; code: string; clients: { name: string } | { name: string }[] }
    | { id: string; code: string; clients: { name: string } | { name: string }[] }[]
    | null;
  const proj = Array.isArray(project) ? project[0] : project;
  const clientRel = proj?.clients;
  const clientName = Array.isArray(clientRel) ? clientRel[0]?.name : clientRel?.name;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={`${clientName} · ${proj?.code}`}
        title={ws.name}
        description={`${STATUS_LABEL[ws.status]} · ${ws.start_on ?? "sin inicio"} → ${ws.end_on ?? "sin fin"}`}
        actions={
          <StatusSelect
            value={ws.status}
            canWrite={session.canWrite}
            onChange={updateWorkstreamStatus.bind(null, ws.id)}
          />
        }
      />

      {session.canWrite ? (
        <Card className="p-5">
          <form action={updateWorkstream} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={ws.id} />
            <input name="name" defaultValue={ws.name} className={`${fieldControlClass} w-auto min-w-56`} />
            <select name="status" defaultValue={ws.status} className={`${fieldControlClass} w-auto`}>
              <option value="en_curso">En curso</option>
              <option value="pausado">Pausado</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="finalizado">Finalizado</option>
            </select>
            <Button type="submit">Guardar</Button>
          </form>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-ink">Equipo</h2>
        <p className="text-sm text-muted">Varias personas por rol, sin columnas duplicadas.</p>
        <Card>
          <ul className="divide-y divide-line">
            {(ws.assignments ?? []).map((asg) => {
              const person = asg.people as { display_name: string } | { display_name: string }[] | null;
              const role = asg.roles as { name: string } | { name: string }[] | null;
              const personName = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
              const roleName = Array.isArray(role) ? role[0]?.name : role?.name;
              return (
                <li key={asg.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    <span className="font-medium text-ink">{personName}</span>
                    <span className="text-muted"> · {roleName}</span>
                  </span>
                  {session.canWrite ? (
                    <form action={removeAssignment.bind(null, asg.id, ws.id)}>
                      <button className="text-sm text-navy hover:text-cyan">Quitar</button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
        {session.canWrite ? (
          <form action={addAssignment} className="flex flex-wrap gap-2">
            <input type="hidden" name="workstream_id" value={ws.id} />
            <select name="person_id" required className={`${fieldControlClass} w-auto min-w-44`}>
              <option value="">Persona</option>
              {(people ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
            <select name="role_id" required className={`${fieldControlClass} w-auto min-w-36`}>
              <option value="">Rol</option>
              {(roles ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <Button type="submit">Asignar</Button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

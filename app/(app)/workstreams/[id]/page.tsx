import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addAssignment, removeAssignment, updateWorkstream, updateWorkstreamStatus } from "../../project-actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldControlClass } from "@/components/ui/Field";
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
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        kicker={clientName}
        title={ws.name}
        description={proj?.code}
        actions={
          <StatusSelect
            value={ws.status}
            canWrite={session.canWrite}
            onChange={updateWorkstreamStatus.bind(null, ws.id)}
          />
        }
      />

      {session.canWrite ? (
        <Card className="p-6">
          <form action={updateWorkstream} className="space-y-4">
            <input type="hidden" name="id" value={ws.id} />
            <Field label="Workstream">
              <input name="name" defaultValue={ws.name} required className={fieldControlClass} />
            </Field>
            <Field label="Estado">
              <select name="status" defaultValue={ws.status} className={fieldControlClass}>
                <option value="en_curso">En curso</option>
                <option value="pausado">Pausado</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </Field>
            <Button type="submit" variant="primary">
              Guardar
            </Button>
          </form>
        </Card>
      ) : (
        <p className="text-sm text-muted">
          {ws.start_on ?? "Sin inicio"} → {ws.end_on ?? "Sin fin"}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium text-ink">Equipo</h2>
        <ul className="space-y-2">
          {(ws.assignments ?? []).map((asg) => {
            const person = asg.people as { display_name: string } | { display_name: string }[] | null;
            const role = asg.roles as { name: string } | { name: string }[] | null;
            const personName = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
            const roleName = Array.isArray(role) ? role[0]?.name : role?.name;
            return (
              <li key={asg.id}>
                <Card className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="font-medium text-ink">{personName}</span>
                  <span className="text-muted">{roleName}</span>
                  {session.canWrite ? (
                    <form action={removeAssignment.bind(null, asg.id, ws.id)} className="ml-auto">
                      <button className="text-sm text-navy hover:text-cyan">Quitar</button>
                    </form>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
        {session.canWrite ? (
          <Card className="mt-4 p-6">
            <form action={addAssignment} className="space-y-4">
              <input type="hidden" name="workstream_id" value={ws.id} />
              <Field label="Persona">
                <select name="person_id" required className={fieldControlClass}>
                  <option value="">Elegir persona</option>
                  {(people ?? []).map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.display_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rol">
                <select name="role_id" required className={fieldControlClass}>
                  <option value="">Elegir rol</option>
                  {(roles ?? []).map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Button type="submit" variant="primary">
                Asignar
              </Button>
            </form>
          </Card>
        ) : null}
      </section>

      {proj?.id ? (
        <p className="text-sm text-muted">
          <Link href={`/proyectos/${proj.id}`} className="hover:text-cyan">
            Volver al proyecto
          </Link>
        </p>
      ) : null}
    </div>
  );
}

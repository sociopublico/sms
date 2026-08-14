import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL } from "@/lib/dates";
import { addAssignment, removeAssignment, updateWorkstream } from "../../project-actions";

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
    supabase.from("roles").select("id, name").order("name"),
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
      <div>
        <p className="text-sm text-stone-500">
          {clientName} · {proj?.code}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{ws.name}</h1>
        <p className="text-sm text-stone-500">
          {STATUS_LABEL[ws.status]} · {ws.start_on ?? "sin inicio"} → {ws.end_on ?? "sin fin"}
        </p>
      </div>

      {session.canWrite ? (
        <form action={updateWorkstream} className="flex flex-wrap gap-3 rounded border border-stone-200 bg-white p-4">
          <input type="hidden" name="id" value={ws.id} />
          <input name="name" defaultValue={ws.name} className="rounded border border-stone-300 px-3 py-2 text-sm" />
          <select name="status" defaultValue={ws.status} className="rounded border border-stone-300 px-3 py-2 text-sm">
            <option value="en_curso">En curso</option>
            <option value="pausado">Pausado</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="finalizado">Finalizado</option>
          </select>
          <button className="rounded bg-stone-900 px-3 py-2 text-sm text-white">Guardar</button>
        </form>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Equipo</h2>
        <p className="text-sm text-stone-600">Varias personas por rol, sin columnas duplicadas.</p>
        <ul className="divide-y divide-stone-100 rounded border border-stone-200 bg-white">
          {(ws.assignments ?? []).map((asg) => {
            const person = asg.people as { display_name: string } | { display_name: string }[] | null;
            const role = asg.roles as { name: string } | { name: string }[] | null;
            const personName = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
            const roleName = Array.isArray(role) ? role[0]?.name : role?.name;
            return (
              <li key={asg.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>
                  <span className="font-medium">{personName}</span>
                  <span className="text-stone-500"> · {roleName}</span>
                </span>
                {session.canWrite ? (
                  <form action={removeAssignment.bind(null, asg.id, ws.id)}>
                    <button className="underline">Quitar</button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
        {session.canWrite ? (
          <form action={addAssignment} className="flex flex-wrap gap-2">
            <input type="hidden" name="workstream_id" value={ws.id} />
            <select name="person_id" required className="rounded border border-stone-300 px-3 py-2 text-sm">
              <option value="">Persona</option>
              {(people ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
            <select name="role_id" required className="rounded border border-stone-300 px-3 py-2 text-sm">
              <option value="">Rol</option>
              {(roles ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button className="rounded bg-stone-900 px-3 py-2 text-sm text-white">Asignar</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL } from "@/lib/dates";
import { updateProject } from "../../project-actions";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, code, ficha_url, kind, status, clients(name), workstreams(id, name, status, start_on, end_on)")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();
  const client = project.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(client) ? client[0]?.name : client?.name;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500">{clientName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{project.code}</h1>
      </div>
      {session.canWrite ? (
        <form action={updateProject} className="grid gap-3 rounded border border-stone-200 bg-white p-4 md:grid-cols-2">
          <input type="hidden" name="id" value={project.id} />
          <label className="text-sm">
            ID
            <input name="code" defaultValue={project.code} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Ficha
            <input name="ficha_url" defaultValue={project.ficha_url ?? ""} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Tipo
            <select name="kind" defaultValue={project.kind} className="mt-1 w-full rounded border border-stone-300 px-3 py-2">
              <option value="client">Cliente</option>
              <option value="internal">Interno</option>
            </select>
          </label>
          <label className="text-sm">
            Estado
            <select name="status" defaultValue={project.status} className="mt-1 w-full rounded border border-stone-300 px-3 py-2">
              <option value="en_curso">En curso</option>
              <option value="pausado">Pausado</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="finalizado">Finalizado</option>
            </select>
          </label>
          <button className="rounded bg-stone-900 px-3 py-2 text-sm text-white md:col-span-2">Guardar contrato</button>
        </form>
      ) : (
        <p className="text-sm text-stone-600">{project.ficha_url || "Sin ficha"}</p>
      )}
      <section>
        <h2 className="mb-2 text-lg font-medium">Workstreams</h2>
        <ul className="space-y-2">
          {(project.workstreams ?? []).map((ws) => (
            <li key={ws.id} className="rounded border border-stone-200 bg-white px-4 py-3 text-sm">
              <Link href={`/workstreams/${ws.id}`} className="font-medium hover:underline">
                {ws.name}
              </Link>
              <span className="ml-2 text-stone-500">{STATUS_LABEL[ws.status]}</span>
              <span className="ml-2 text-stone-400">
                {ws.start_on ?? "—"} → {ws.end_on ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

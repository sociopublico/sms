import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { createProjectAndWorkstream } from "../../project-actions";

export default async function NewProjectPage() {
  const session = await requireSession();
  if (!session.canWrite) {
    return <p>No tenés permiso para crear proyectos.</p>;
  }
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, code, clients(name)")
    .order("code");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo workstream</h1>
      <p className="text-sm text-stone-600">
        La ficha es opcional. Si no hay ID, se genera uno provisional SIN-FICHA.
      </p>
      <form action={createProjectAndWorkstream} className="space-y-4 rounded border border-stone-200 bg-white p-5">
        <label className="block text-sm">
          Colgar de un proyecto existente
          <select name="existing_project_id" className="mt-1 w-full rounded border border-stone-300 px-3 py-2">
            <option value="">Crear proyecto nuevo</option>
            {(projects ?? []).map((p) => {
              const client = p.clients as { name: string } | { name: string }[] | null;
              const clientName = Array.isArray(client) ? client[0]?.name : client?.name;
              return (
                <option key={p.id} value={p.id}>
                  {p.code} · {clientName}
                </option>
              );
            })}
          </select>
        </label>
        <label className="block text-sm">
          Cliente (si es proyecto nuevo)
          <input name="client_name" className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          ID de contrato / ficha
          <input name="code" placeholder="Opcional" className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          URL de ficha
          <input name="ficha_url" placeholder="Opcional" className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          Tipo
          <select name="kind" className="mt-1 w-full rounded border border-stone-300 px-3 py-2">
            <option value="client">Cliente</option>
            <option value="internal">Interno</option>
          </select>
        </label>
        <label className="block text-sm">
          Workstream
          <input name="workstream_name" required className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          Estado
          <select name="status" className="mt-1 w-full rounded border border-stone-300 px-3 py-2">
            <option value="en_curso">En curso</option>
            <option value="pausado">Pausado</option>
            <option value="mantenimiento">Mantenimiento (12 meses)</option>
          </select>
        </label>
        <button className="rounded bg-stone-900 px-4 py-2 text-sm text-white">Crear</button>
      </form>
    </div>
  );
}

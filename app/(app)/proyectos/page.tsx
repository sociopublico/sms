import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/dates";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireSession();
  const { status } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("id, code, ficha_url, kind, status, clients(name), workstreams(id, name, status)")
    .order("code");
  if (status) query = query.eq("status", status);
  const { data: projects } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-stone-600">Contrato (ID) con uno o más workstreams.</p>
        </div>
        <Link href="/proyectos/nuevo" className="rounded bg-stone-900 px-3 py-2 text-sm text-white">
          Nuevo workstream
        </Link>
      </div>
      <div className="flex gap-2 text-sm">
        {[
          ["", "Todos"],
          ["en_curso", "En curso"],
          ["pausado", "Pausado"],
          ["mantenimiento", "Mantenimiento"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/proyectos?status=${value}` : "/proyectos"}
            className={`rounded px-3 py-1 ${status === value || (!status && !value) ? "bg-stone-900 text-white" : "bg-white border border-stone-200"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {(projects ?? []).map((project) => {
          const client = project.clients as { name: string } | { name: string }[] | null;
          const clientName = Array.isArray(client) ? client[0]?.name : client?.name;
          return (
            <article key={project.id} className="rounded border border-stone-200 bg-white p-4">
              <div className="flex items-baseline justify-between gap-4">
                <Link href={`/proyectos/${project.id}`} className="font-medium hover:underline">
                  {project.code}
                </Link>
                <span className="text-xs text-stone-500">
                  {STATUS_LABEL[project.status] ?? project.status} · {project.kind === "internal" ? "interno" : "cliente"}
                </span>
              </div>
              <p className="text-sm text-stone-600">{clientName}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {(project.workstreams ?? []).map((ws) => (
                  <li key={ws.id}>
                    <Link href={`/workstreams/${ws.id}`} className="hover:underline">
                      {ws.name}
                    </Link>
                    <span className="ml-2 text-stone-400">{STATUS_LABEL[ws.status] ?? ws.status}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}

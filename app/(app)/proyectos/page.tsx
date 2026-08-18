import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { updateProjectStatus, updateWorkstreamStatus } from "../project-actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FichaMissing, missingFicha } from "@/components/ui/FichaMissing";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusSelect } from "@/components/ui/StatusSelect";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
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
      <PageHeader
        title="Proyectos"
        description="Contrato (ID) con uno o más workstreams."
        actions={
          <Button href="/proyectos/nuevo" variant="primary">
            Nuevo workstream
          </Button>
        }
      />
      <FilterChips
        items={[
          { href: "/proyectos", label: "Todos", active: !status },
          { href: "/proyectos?status=en_curso", label: "En curso", active: status === "en_curso" },
          { href: "/proyectos?status=pausado", label: "Pausado", active: status === "pausado" },
          {
            href: "/proyectos?status=mantenimiento",
            label: "Mantenimiento",
            active: status === "mantenimiento",
          },
        ]}
      />
      <div className="space-y-3">
        {(projects ?? []).map((project) => {
          const client = project.clients as { name: string } | { name: string }[] | null;
          const clientName = Array.isArray(client) ? client[0]?.name : client?.name;
          return (
            <Card key={project.id} className="p-5">
              <div className="flex items-baseline justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Link href={`/proyectos/${project.id}`} className="font-medium text-ink hover:text-cyan">
                    {project.code}
                  </Link>
                  {missingFicha(project.ficha_url, project.code) ? (
                    <FichaMissing href={`/proyectos/${project.id}`} />
                  ) : null}
                </div>
                <StatusSelect
                  value={project.status}
                  canWrite={session.canWrite}
                  onChange={updateProjectStatus.bind(null, project.id)}
                />
              </div>
              <p className="mt-1 text-sm text-muted">{clientName}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {(project.workstreams ?? []).map((ws) => (
                  <li key={ws.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/workstreams/${ws.id}`} className="hover:text-cyan">
                      {ws.name}
                    </Link>
                    <StatusSelect
                      value={ws.status}
                      canWrite={session.canWrite}
                      onChange={updateWorkstreamStatus.bind(null, ws.id)}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
